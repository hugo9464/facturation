"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getProfile,
  getSupabaseDb,
  toTodoProject,
  toTodoTask,
} from "@/lib/supabase/db";
import {
  todoStatusEnum,
  type TodoProject,
  type TodoTask,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextTodoStatus, TODO_STATUS_LABELS } from "@/lib/todo";
import { generateText, TASK_SUMMARY_MODEL } from "@/lib/anthropic";
import { previewTokenFor } from "@/lib/todo-preview";

const statusSchema = z.enum(todoStatusEnum.enumValues);
const projectIdSchema = z.string().uuid();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "Nom trop long"),
  clientId: z.string().uuid().nullable().optional(),
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
  previewToken: string | null;
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
    previewToken: previewTokenFor(task.id),
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

async function getProjectForUser(userId: string, projectId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_project")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toTodoProject(data) : null;
}

async function nextProjectOrder(userId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_project")
    .select("order")
    .eq("user_id", userId)
    .order("order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.order ?? -1) + 1;
}

async function nextTaskOrder(
  userId: string,
  projectId: string,
  status: z.infer<typeof statusSchema>,
) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_task")
    .select("order")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("status", status)
    .order("order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.order ?? -1) + 1;
}

export async function createTodoProjectAction(input: unknown) {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  if (parsed.data.clientId) {
    const { data: clientRow, error } = await supabase
      .from("client")
      .select("id")
      .eq("id", parsed.data.clientId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!clientRow) return { error: "Client introuvable" };
  }

  const order = await nextProjectOrder(user.id);
  const { data, error } = await supabase
    .from("todo_project")
    .insert({
      user_id: user.id,
      client_id: parsed.data.clientId ?? null,
      name: parsed.data.name,
      order,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return { error: "Ce projet existe déjà" };
    throw error;
  }

  revalidatePath("/todo");
  revalidatePath("/projects");
  return { project: serializeProject(toTodoProject(data)) };
}

export async function updateTodoProjectAction(id: string, input: unknown) {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  if (parsed.data.clientId) {
    const { data: clientRow, error } = await supabase
      .from("client")
      .select("id")
      .eq("id", parsed.data.clientId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!clientRow) return { error: "Projet ou client introuvable" };
  }

  const { data, error } = await supabase
    .from("todo_project")
    .update({
      client_id: parsed.data.clientId ?? null,
      name: parsed.data.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) return { error: "Ce projet existe déjà" };
    throw error;
  }
  if (!data) return { error: "Projet ou client introuvable" };

  revalidatePath("/todo");
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { project: serializeProject(toTodoProject(data)) };
}

export async function deleteTodoProjectAction(id: string) {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const project = await getProjectForUser(user.id, id);
  if (!project) return { error: "Projet introuvable" };

  const [tasks, entries, invoices, quotes] = await Promise.all([
    supabase
      .from("todo_task")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("project_id", id),
    supabase
      .from("time_entry")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("project_id", id),
    supabase
      .from("invoice")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("project_id", id),
    supabase
      .from("quote")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("project_id", id),
  ]);

  for (const result of [tasks, entries, invoices, quotes]) {
    if (result.error) throw result.error;
  }

  if (
    (tasks.count ?? 0) > 0 ||
    (entries.count ?? 0) > 0 ||
    (invoices.count ?? 0) > 0 ||
    (quotes.count ?? 0) > 0
  ) {
    return {
      error:
        "Impossible de supprimer un projet contenant des tâches, temps, devis ou factures",
    };
  }

  const { data, error } = await supabase
    .from("todo_project")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/todo");
  revalidatePath("/projects");
  return { id: data.id };
}

export async function createTodoTaskAction(input: unknown) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const project = await getProjectForUser(user.id, parsed.data.projectId);
  if (!project) return { error: "Projet introuvable" };

  const profile = await getProfile(user.id);
  if (!profile) throw new Error("Profil introuvable");

  const supabase = await getSupabaseDb();
  const order = await nextTaskOrder(
    user.id,
    parsed.data.projectId,
    parsed.data.status,
  );
  const { data, error } = await supabase
    .from("todo_task")
    .insert({
      user_id: user.id,
      project_id: parsed.data.projectId,
      number: profile.nextTaskNumber,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      order,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("profile")
    .update({
      next_task_number: profile.nextTaskNumber + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  revalidatePath("/todo");
  return { task: serializeTask(toTodoTask(data)) };
}

export async function updateTodoTaskAction(id: string, input: unknown) {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data: existing, error: existingError } = await supabase
    .from("todo_task")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return { error: "Tâche introuvable" };

  const task = toTodoTask(existing);
  const order =
    task.status === parsed.data.status
      ? task.order
      : await nextTaskOrder(user.id, task.projectId, parsed.data.status);

  const { data, error } = await supabase
    .from("todo_task")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      order,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/todo");
  return { task: serializeTask(toTodoTask(data)) };
}

export async function deleteTodoTaskAction(id: string) {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_task")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: "Tâche introuvable" };

  revalidatePath("/todo");
  return { id: data.id };
}

export async function advanceTodoTaskAction(id: string) {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data: existing, error: existingError } = await supabase
    .from("todo_task")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return { error: "Tâche introuvable" };

  const task = toTodoTask(existing);
  const nextStatus = nextTodoStatus(task.status);
  if (!nextStatus) {
    revalidatePath("/todo");
    return { task: serializeTask(task) };
  }

  const order = await nextTaskOrder(user.id, task.projectId, nextStatus);
  const { data, error } = await supabase
    .from("todo_task")
    .update({
      status: nextStatus,
      order,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/todo");
  return { task: serializeTask(toTodoTask(data)) };
}

export async function reorderTodoTasksAction(input: unknown) {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const touchedProjectIds = new Set<string>();
  for (const item of parsed.data) {
    const { data, error } = await supabase
      .from("todo_task")
      .update({
        status: item.status,
        order: item.order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("user_id", user.id)
      .select("project_id")
      .maybeSingle();
    if (error) throw error;
    if (data?.project_id) touchedProjectIds.add(data.project_id);
  }

  revalidatePath("/todo");
  for (const projectId of touchedProjectIds) {
    revalidatePath(`/projects/${projectId}`);
  }
  return { success: true };
}

const summarizeSchema = z.object({
  taskIds: z
    .array(z.string().uuid())
    .min(1, "Sélectionne au moins une tâche")
    .max(100, "Trop de tâches sélectionnées"),
});

export async function summarizeTodoTasksAction(input: unknown) {
  const user = await requireUser();
  const parsed = summarizeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("todo_task")
    .select("*")
    .eq("user_id", user.id)
    .in("id", parsed.data.taskIds);
  if (error) throw error;

  const tasks = (data ?? []).map(toTodoTask).sort((a, b) => a.number - b.number);
  if (tasks.length === 0) return { error: "Aucune tâche trouvée" };

  const taskList = tasks
    .map((task) => {
      const description = task.description?.trim();
      return `- UC-${task.number} — ${task.title} [${TODO_STATUS_LABELS[task.status]}]${
        description ? `\n  ${description}` : ""
      }`;
    })
    .join("\n");

  try {
    const summary = await generateText({
      model: TASK_SUMMARY_MODEL,
      system:
        "Tu es un assistant qui rédige des résumés de travail clairs et concis en français pour un développeur freelance.",
      prompt: `Voici une liste de tâches réalisées sur un projet. Rédige un résumé synthétique des modifications effectuées, destiné à être communiqué à un client.

Commence ta réponse exactement par "Voilà le résumé des modifications effectuées :" puis présente les tâches sous forme de liste à puces, reformulées de manière professionnelle et lisible. Pas de jargon technique inutile, pas de numéros "UC-". Reste factuel : ne rajoute rien qui ne soit pas dans la liste.

Tâches :
${taskList}`,
      maxTokens: 1024,
    });
    return { summary };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Échec de la génération du résumé",
    };
  }
}
