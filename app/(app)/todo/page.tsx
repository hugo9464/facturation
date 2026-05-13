import { requireUser } from "@/lib/auth";
import { TodoWorkspace } from "./todo-workspace";
import type { TodoProjectView, TodoTaskView } from "@/actions/todo";
import { getSupabaseDb, toTodoProject, toTodoTask } from "@/lib/supabase/db";
import type { TodoProject, TodoTask } from "@/db/schema";

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

export default async function TodoPage() {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data: projectRows, error: projectsError } = await supabase
    .from("todo_project")
    .select("*")
    .eq("user_id", user.id)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });
  if (projectsError) throw projectsError;
  let projects = (projectRows ?? []).map(toTodoProject);

  if (projects.length === 0) {
    const { data, error } = await supabase
      .from("todo_project")
      .insert({ user_id: user.id, name: "Général", order: 0 })
      .select("*")
      .single();
    if (error) throw error;
    projects = [toTodoProject(data)];
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from("todo_task")
    .select("*")
    .eq("user_id", user.id)
    .order("project_id", { ascending: true })
    .order("status", { ascending: true })
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });
  if (tasksError) throw tasksError;
  const tasks = (taskRows ?? []).map(toTodoTask);

  return (
    <TodoWorkspace
      initialProjects={projects.map(serializeProject)}
      initialTasks={tasks.map(serializeTask)}
    />
  );
}
