"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  profile,
  todoProject,
  todoTask,
  todoStatusEnum,
  type TodoProject,
  type TodoTask,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextTodoStatus } from "@/lib/todo";

const statusSchema = z.enum(todoStatusEnum.enumValues);
const projectIdSchema = z.string().uuid();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "Nom trop long"),
});

const createSchema = z.object({
  projectId: projectIdSchema,
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional(),
  status: statusSchema.default("TODO"),
});

const updateSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional(),
  status: statusSchema,
});

const reorderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    status: statusSchema,
    order: z.number().int().min(0),
  }),
);

export type TodoTaskView = Omit<TodoTask, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type TodoProjectView = Omit<TodoProject, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function serializeTask(task: TodoTask): TodoTaskView {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeProject(project: TodoProject): TodoProjectView {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function getProjectForUser(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  projectId: string,
) {
  const [project] = await tx
    .select()
    .from(todoProject)
    .where(and(eq(todoProject.id, projectId), eq(todoProject.userId, userId)))
    .limit(1);
  return project ?? null;
}

async function nextOrderForProject(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
) {
  const [row] = await tx
    .select({
      nextOrder: sql<number>`coalesce(max(${todoProject.order}), -1) + 1`,
    })
    .from(todoProject)
    .where(eq(todoProject.userId, userId));
  return row?.nextOrder ?? 0;
}

async function nextOrderForStatus(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  projectId: string,
  status: z.infer<typeof statusSchema>,
) {
  const [row] = await tx
    .select({
      nextOrder: sql<number>`coalesce(max(${todoTask.order}), -1) + 1`,
    })
    .from(todoTask)
    .where(
      and(
        eq(todoTask.userId, userId),
        eq(todoTask.projectId, projectId),
        eq(todoTask.status, status),
      ),
    );
  return row?.nextOrder ?? 0;
}

export async function createTodoProjectAction(input: unknown) {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const project = await db.transaction(async (tx) => {
      const order = await nextOrderForProject(tx, user.id);
      const [row] = await tx
        .insert(todoProject)
        .values({
          userId: user.id,
          name: parsed.data.name,
          order,
        })
        .returning();

      return row;
    });

    revalidatePath("/todo");
    return { project: serializeProject(project) };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ce projet existe déjà" };
    throw error;
  }
}

export async function updateTodoProjectAction(id: string, input: unknown) {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const [project] = await db
      .update(todoProject)
      .set({
        name: parsed.data.name,
        updatedAt: new Date(),
      })
      .where(and(eq(todoProject.id, id), eq(todoProject.userId, user.id)))
      .returning();

    if (!project) return { error: "Projet introuvable" };

    revalidatePath("/todo");
    return { project: serializeProject(project) };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ce projet existe déjà" };
    throw error;
  }
}

export async function deleteTodoProjectAction(id: string) {
  const user = await requireUser();

  const result = await db.transaction(async (tx) => {
    const project = await getProjectForUser(tx, user.id, id);
    if (!project) return { error: "Projet introuvable" };

    const [taskCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(todoTask)
      .where(and(eq(todoTask.userId, user.id), eq(todoTask.projectId, id)));

    if ((taskCount?.count ?? 0) > 0) {
      return { error: "Impossible de supprimer un projet contenant des tâches" };
    }

    const [deleted] = await tx
      .delete(todoProject)
      .where(and(eq(todoProject.id, id), eq(todoProject.userId, user.id)))
      .returning({ id: todoProject.id });

    return { id: deleted.id };
  });

  if ("error" in result && result.error) return result;

  revalidatePath("/todo");
  return result;
}

export async function createTodoTaskAction(input: unknown) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const task = await db.transaction(async (tx) => {
    const project = await getProjectForUser(tx, user.id, parsed.data.projectId);
    if (!project) return null;

    const [numberRow] = await tx
      .update(profile)
      .set({
        nextTaskNumber: sql`${profile.nextTaskNumber} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(profile.userId, user.id))
      .returning({ next: profile.nextTaskNumber });

    if (!numberRow) throw new Error("Profil introuvable");

    const order = await nextOrderForStatus(
      tx,
      user.id,
      parsed.data.projectId,
      parsed.data.status,
    );
    const [row] = await tx
      .insert(todoTask)
      .values({
        userId: user.id,
        projectId: parsed.data.projectId,
        number: numberRow.next - 1,
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: parsed.data.status,
        order,
      })
      .returning();

    return row;
  });

  if (!task) return { error: "Projet introuvable" };

  revalidatePath("/todo");
  return { task: serializeTask(task) };
}

export async function updateTodoTaskAction(id: string, input: unknown) {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const task = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(todoTask)
      .where(and(eq(todoTask.id, id), eq(todoTask.userId, user.id)))
      .limit(1);

    if (!existing) return null;

    const order =
      existing.status === parsed.data.status
        ? existing.order
        : await nextOrderForStatus(
            tx,
            user.id,
            existing.projectId,
            parsed.data.status,
          );

    const [row] = await tx
      .update(todoTask)
      .set({
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: parsed.data.status,
        order,
        updatedAt: new Date(),
      })
      .where(and(eq(todoTask.id, id), eq(todoTask.userId, user.id)))
      .returning();

    return row;
  });

  if (!task) return { error: "Tâche introuvable" };

  revalidatePath("/todo");
  return { task: serializeTask(task) };
}

export async function deleteTodoTaskAction(id: string) {
  const user = await requireUser();
  const [row] = await db
    .delete(todoTask)
    .where(and(eq(todoTask.id, id), eq(todoTask.userId, user.id)))
    .returning({ id: todoTask.id });

  if (!row) return { error: "Tâche introuvable" };

  revalidatePath("/todo");
  return { id: row.id };
}

export async function advanceTodoTaskAction(id: string) {
  const user = await requireUser();
  const task = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(todoTask)
      .where(and(eq(todoTask.id, id), eq(todoTask.userId, user.id)))
      .limit(1);

    if (!existing) return null;

    const nextStatus = nextTodoStatus(existing.status);
    if (!nextStatus) return existing;

    const order = await nextOrderForStatus(
      tx,
      user.id,
      existing.projectId,
      nextStatus,
    );
    const [row] = await tx
      .update(todoTask)
      .set({
        status: nextStatus,
        order,
        updatedAt: new Date(),
      })
      .where(and(eq(todoTask.id, id), eq(todoTask.userId, user.id)))
      .returning();

    return row;
  });

  if (!task) return { error: "Tâche introuvable" };

  revalidatePath("/todo");
  return { task: serializeTask(task) };
}

export async function reorderTodoTasksAction(input: unknown) {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  await db.transaction(async (tx) => {
    for (const item of parsed.data) {
      await tx
        .update(todoTask)
        .set({
          status: item.status,
          order: item.order,
          updatedAt: new Date(),
        })
        .where(and(eq(todoTask.id, item.id), eq(todoTask.userId, user.id)));
    }
  });

  revalidatePath("/todo");
  return { success: true };
}
