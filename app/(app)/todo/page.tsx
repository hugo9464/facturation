import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { todoProject, todoTask } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { TodoWorkspace } from "./todo-workspace";
import type { TodoProjectView, TodoTaskView } from "@/actions/todo";

function serializeTask(task: typeof todoTask.$inferSelect): TodoTaskView {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeProject(project: typeof todoProject.$inferSelect): TodoProjectView {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export default async function TodoPage() {
  const user = await requireUser();
  let projects = await db
    .select()
    .from(todoProject)
    .where(eq(todoProject.userId, user.id))
    .orderBy(asc(todoProject.order), asc(todoProject.createdAt));

  if (projects.length === 0) {
    const [project] = await db
      .insert(todoProject)
      .values({ userId: user.id, name: "Général", order: 0 })
      .returning();
    projects = project ? [project] : [];
  }

  const tasks = await db
    .select()
    .from(todoTask)
    .where(eq(todoTask.userId, user.id))
    .orderBy(
      asc(todoTask.projectId),
      asc(todoTask.status),
      asc(todoTask.order),
      asc(todoTask.createdAt),
    );

  return (
    <TodoWorkspace
      initialProjects={projects.map(serializeProject)}
      initialTasks={tasks.map(serializeTask)}
    />
  );
}
