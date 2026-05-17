"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getProfile,
  getSupabaseDb,
  toTodoImplementationJob,
  toTodoProject,
  toTodoTask,
} from "@/lib/supabase/db";
import {
  todoStatusEnum,
  type TodoImplementationJob,
  type TodoProject,
  type TodoTask,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextTodoStatus, TODO_STATUS_LABELS } from "@/lib/todo";
import { generateText, TASK_SUMMARY_MODEL } from "@/lib/anthropic";
import { getAppUrl, previewTokenFor } from "@/lib/todo-preview";
import {
  createHermesWebhookHeaders,
  getHermesWebhookConfig,
  getImplementationCallbackSecret,
  IMPLEMENT_TASK_EVENT,
  MERGE_TASK_EVENT,
  implementationCallbackTokenFor,
} from "@/lib/hermes-automation";
import {
  canRequestHermesMerge,
  HERMES_MERGE_AGENT,
} from "@/lib/todo-implementation-workflow";

const statusSchema = z.enum(todoStatusEnum.enumValues);
const projectIdSchema = z.string().uuid();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "Nom trop long"),
  clientId: z.string().uuid().nullable().optional(),
});

const startImplementationSchema = z.object({
  taskId: z.string().uuid(),
  preferredCodingTool: z.enum(["codex", "claude", "hermes"]).default("codex"),
});

const validateImplementationSchema = z.object({
  taskId: z.string().uuid(),
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

export type TodoTaskView = Omit<
  TodoTask,
  "completedAt" | "createdAt" | "updatedAt"
> & {
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  previewToken: string | null;
  implementationJob: TodoImplementationJobView | null;
};

export type TodoImplementationJobView = Omit<
  TodoImplementationJob,
  "createdAt" | "updatedAt"
> & {
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
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    previewToken: previewTokenFor(task.id),
    implementationJob: null,
  };
}

function serializeTodoImplementationJob(
  job: TodoImplementationJob,
): TodoImplementationJobView {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

// La date de fin est posée quand la tâche passe en "à valider" (TO_TEST) ou
// "terminé" (DONE), conservée tant qu'elle y reste, et effacée si elle revient
// en amont.
function resolveCompletedAt(
  status: z.infer<typeof statusSchema>,
  existing: string | null,
): string | null {
  if (status === "TO_TEST" || status === "DONE") {
    return existing ?? new Date().toISOString();
  }
  return null;
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
      completed_at: resolveCompletedAt(parsed.data.status, null),
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
      completed_at: resolveCompletedAt(
        parsed.data.status,
        (existing.completed_at as string | null) ?? null,
      ),
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
      completed_at: resolveCompletedAt(
        nextStatus,
        (existing.completed_at as string | null) ?? null,
      ),
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

export async function startTodoImplementationAction(input: unknown) {
  const user = await requireUser();
  const parsed = startImplementationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data: taskRow, error: taskError } = await supabase
    .from("todo_task")
    .select("*")
    .eq("id", parsed.data.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!taskRow) return { error: "Tâche introuvable" };

  const task = toTodoTask(taskRow);
  const project = await getProjectForUser(user.id, task.projectId);
  if (!project) return { error: "Projet introuvable" };


  const hermes = getHermesWebhookConfig();
  if (!hermes.url || !hermes.secret) {
    return { error: "Variables HERMES_WEBHOOK_URL/HERMES_WEBHOOK_SECRET manquantes" };
  }

  const { data: jobRow, error: jobError } = await supabase
    .from("todo_implementation_job")
    .insert({
      user_id: user.id,
      task_id: task.id,
      project_id: project.id,
      status: "QUEUED",
      agent: "hermes",
      logs: `Job envoyé à Hermes (${parsed.data.preferredCodingTool}).`,
    })
    .select("*")
    .single();
  if (jobError) throw jobError;

  const job = toTodoImplementationJob(jobRow);
  const appUrl = await getAppUrl();
  const callbackSecret = getImplementationCallbackSecret();
  const callbackToken = callbackSecret
    ? implementationCallbackTokenFor(job.id, task.id, callbackSecret)
    : "";

  const payload = {
    event_type: IMPLEMENT_TASK_EVENT,
    jobId: job.id,
    task: {
      id: task.id,
      number: task.number,
      title: task.title,
      description: task.description,
      status: task.status,
    },
    project: {
      id: project.id,
      name: project.name,
    },
    automation: {
      mode: "hermes",
      preferredCodingTool: parsed.data.preferredCodingTool,
      repositoryResolution: "vps_hermes",
      instructions:
        "Résous le dépôt/projet côté VPS à partir du nom du projet et du contexte de la tâche; les champs repo* sont seulement des indices optionnels.",
    },
    callback: {
      url: `${appUrl}/api/todo/implementation-jobs/${job.id}/callback`,
      token: callbackToken,
    },
  };
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(hermes.url, {
      method: "POST",
      headers: createHermesWebhookHeaders(body, hermes.secret),
      body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Hermes HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec appel Hermes";
    const { data: failedRow } = await supabase
      .from("todo_implementation_job")
      .update({
        status: "FAILED",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    return {
      error: message,
      job: failedRow
        ? serializeTodoImplementationJob(toTodoImplementationJob(failedRow))
        : serializeTodoImplementationJob(job),
    };
  }

  revalidatePath("/todo");
  revalidatePath(`/projects/${project.id}`);
  return { job: serializeTodoImplementationJob(job) };
}

export async function validateTodoImplementationAction(input: unknown) {
  const user = await requireUser();
  const parsed = validateImplementationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data: taskRow, error: taskError } = await supabase
    .from("todo_task")
    .select("*")
    .eq("id", parsed.data.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!taskRow) return { error: "Tâche introuvable" };

  const task = toTodoTask(taskRow);
  const project = await getProjectForUser(user.id, task.projectId);
  if (!project) return { error: "Projet introuvable" };

  const { data: sourceJobRow, error: sourceJobError } = await supabase
    .from("todo_implementation_job")
    .select("*")
    .eq("task_id", task.id)
    .eq("user_id", user.id)
    .eq("agent", "hermes")
    .eq("status", "SUCCEEDED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sourceJobError) throw sourceJobError;
  if (!sourceJobRow) return { error: "Aucune PR Hermes prête à merger" };

  const sourceJob = toTodoImplementationJob(sourceJobRow);
  if (
    !canRequestHermesMerge({
      taskStatus: task.status,
      jobStatus: sourceJob.status,
      prUrl: task.prUrl ?? sourceJob.prUrl,
    })
  ) {
    return { error: "Cette tâche n'est pas prête à être validée" };
  }

  const hermes = getHermesWebhookConfig();
  if (!hermes.url || !hermes.secret) {
    return { error: "Variables HERMES_WEBHOOK_URL/HERMES_WEBHOOK_SECRET manquantes" };
  }

  const { data: jobRow, error: jobError } = await supabase
    .from("todo_implementation_job")
    .insert({
      user_id: user.id,
      task_id: task.id,
      project_id: project.id,
      status: "QUEUED",
      agent: HERMES_MERGE_AGENT,
      branch_name: sourceJob.branchName,
      pr_url: sourceJob.prUrl ?? task.prUrl,
      preview_url: sourceJob.previewUrl ?? task.previewUrl,
      logs: "Validation utilisateur envoyée à Hermes pour merge dans main.",
    })
    .select("*")
    .single();
  if (jobError) throw jobError;

  const job = toTodoImplementationJob(jobRow);
  const appUrl = await getAppUrl();
  const callbackSecret = getImplementationCallbackSecret();
  const callbackToken = callbackSecret
    ? implementationCallbackTokenFor(job.id, task.id, callbackSecret)
    : "";
  const prUrl = sourceJob.prUrl ?? task.prUrl;

  const payload = {
    event_type: MERGE_TASK_EVENT,
    jobId: job.id,
    sourceJobId: sourceJob.id,
    task: {
      id: task.id,
      number: task.number,
      title: task.title,
      description: task.description,
      status: task.status,
      prUrl,
      previewUrl: sourceJob.previewUrl ?? task.previewUrl,
    },
    project: {
      id: project.id,
      name: project.name,
    },
    automation: {
      mode: "hermes_merge",
      repositoryResolution: "vps_hermes",
      mergeMethod: "squash_or_merge",
      instructions:
        "Merge la PR fournie dans la branche main/default du dépôt cible. Ne modifie pas le code. Après merge réussi, callback SUCCEEDED; sinon callback FAILED avec logs.",
    },
    pullRequest: {
      url: prUrl,
      branchName: sourceJob.branchName,
    },
    callback: {
      url: `${appUrl}/api/todo/implementation-jobs/${job.id}/callback`,
      token: callbackToken,
    },
  };
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(hermes.url, {
      method: "POST",
      headers: createHermesWebhookHeaders(body, hermes.secret, MERGE_TASK_EVENT),
      body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Hermes HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec appel Hermes";
    const { data: failedRow } = await supabase
      .from("todo_implementation_job")
      .update({
        status: "FAILED",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    return {
      error: message,
      job: failedRow
        ? serializeTodoImplementationJob(toTodoImplementationJob(failedRow))
        : serializeTodoImplementationJob(job),
    };
  }

  revalidatePath("/todo");
  revalidatePath(`/projects/${project.id}`);
  return { job: serializeTodoImplementationJob(job) };
}

export async function reorderTodoTasksAction(input: unknown) {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data: existingRows, error: existingError } = await supabase
    .from("todo_task")
    .select("id, completed_at")
    .eq("user_id", user.id)
    .in(
      "id",
      parsed.data.map((item) => item.id),
    );
  if (existingError) throw existingError;
  const completedById = new Map(
    (existingRows ?? []).map((row) => [
      row.id as string,
      (row.completed_at as string | null) ?? null,
    ]),
  );

  const touchedProjectIds = new Set<string>();
  for (const item of parsed.data) {
    const { data, error } = await supabase
      .from("todo_task")
      .update({
        status: item.status,
        order: item.order,
        completed_at: resolveCompletedAt(
          item.status,
          completedById.get(item.id) ?? null,
        ),
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
