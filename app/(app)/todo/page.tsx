import { requireUser } from "@/lib/auth";
import { TodoWorkspace } from "./todo-workspace";
import type {
  TodoImplementationJobView,
  TodoProjectView,
  TodoTaskView,
} from "@/actions/todo";
import {
  getProfile,
  getSupabaseDb,
  toTodoImplementationJob,
  toTodoProject,
  toTodoTask,
} from "@/lib/supabase/db";
import type { TodoImplementationJob, TodoProject, TodoTask } from "@/db/schema";
import { DEFAULT_TODO_PROMPT_TEMPLATE } from "@/lib/todo";
import { getAppUrl, previewTokenFor } from "@/lib/todo-preview";

function serializeTodoImplementationJob(
  job: TodoImplementationJob,
): TodoImplementationJobView {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeTask(
  task: TodoTask,
  implementationJob: TodoImplementationJob | null = null,
  implementationJobs: TodoImplementationJob[] = [],
): TodoTaskView {
  return {
    ...task,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    previewToken: previewTokenFor(task.id),
    implementationJob: implementationJob
      ? serializeTodoImplementationJob(implementationJob)
      : null,
    implementationJobs: implementationJobs.map(serializeTodoImplementationJob),
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

  const { data: jobRows, error: jobsError } = await supabase
    .from("todo_implementation_job")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (jobsError) throw jobsError;
  const latestJobByTaskId = new Map<string, TodoImplementationJob>();
  const jobsByTaskId = new Map<string, TodoImplementationJob[]>();
  for (const job of (jobRows ?? []).map(toTodoImplementationJob)) {
    if (!latestJobByTaskId.has(job.taskId)) latestJobByTaskId.set(job.taskId, job);
    jobsByTaskId.set(job.taskId, [...(jobsByTaskId.get(job.taskId) ?? []), job]);
  }

  const profile = await getProfile(user.id);
  const promptTemplate =
    profile?.todoPromptTemplate ?? DEFAULT_TODO_PROMPT_TEMPLATE;
  const appUrl = await getAppUrl();

  return (
    <TodoWorkspace
      initialProjects={projects.map(serializeProject)}
      initialTasks={tasks.map((task) =>
        serializeTask(
          task,
          latestJobByTaskId.get(task.id) ?? null,
          jobsByTaskId.get(task.id) ?? [],
        ),
      )}
      promptTemplate={promptTemplate}
      appUrl={appUrl}
    />
  );
}
