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
import {
  buildEmailTaskImportPrompt,
  extractEmailTaskCandidates,
  normalizeTaskFingerprint,
  parseEmailTaskProposals,
  type EmailTaskProposal,
} from "@/lib/email-task-import";
import { getAppUrl, previewTokenFor } from "@/lib/todo-preview";
import {
  createHermesWebhookHeaders,
  getHermesWebhookConfig,
  getImplementationCallbackSecret,
  IMPLEMENT_TASK_EVENT,
  MERGE_TASK_EVENT,
  implementationCallbackTokenFor,
} from "@/lib/hermes-automation";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureTodoAttachmentBucketExists,
  isTodoAttachmentBucketMissing,
  safeTodoAttachmentName,
  TODO_ATTACHMENT_BUCKET,
  TODO_ATTACHMENT_MAX_BYTES,
  todoAttachmentMarkdown,
} from "@/lib/todo-attachments";
import {
  canRequestHermesMerge,
  getHermesImplementationTestingContract,
  getTodoStatusAfterHermesStart,
  HERMES_MERGE_AGENT,
} from "@/lib/todo-implementation-workflow";
import { buildTodoSummaryImplementationContext } from "@/lib/todo-task-summary-context";

const statusSchema = z.enum(todoStatusEnum.enumValues);
const projectIdSchema = z.string().uuid();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "Nom trop long"),
  clientId: z.string().uuid().nullable().optional(),
});

const startImplementationSchema = z.object({
  taskId: z.string().uuid(),
  preferredCodingTool: z.enum(["codex", "claude", "hermes"]).default("codex"),
  instructions: z.string().trim().max(4_000, "Instructions trop longues").optional(),
});

const validateImplementationSchema = z.object({
  taskId: z.string().uuid(),
});

const implementationJobsRefreshSchema = z.object({
  taskIds: z.array(z.string().uuid()).max(100),
});

const createSchema = z.object({
  projectId: projectIdSchema,
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional(),
  status: statusSchema.default("TODO"),
});

const importEmailSchema = z.object({
  content: z.string().trim().min(20, "Colle le contenu de l’email client"),
  fallbackProjectId: projectIdSchema.optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional(),
  status: statusSchema,
});

const todoAttachmentSchema = z.object({
  taskId: z.string().uuid().optional(),
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
  implementationJobs: TodoImplementationJobView[];
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
    implementationJobs: [],
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

export async function uploadTodoTaskAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = todoAttachmentSchema.safeParse({
    taskId: formData.get("taskId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisis un fichier à joindre" };
  }
  if (file.size > TODO_ATTACHMENT_MAX_BYTES) {
    return { error: "Fichier trop lourd (8 Mo maximum)" };
  }

  const safeName = safeTodoAttachmentName(file.name);
  const folder = parsed.data.taskId ?? "draft";
  const path = `${user.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || "application/octet-stream";
  const storage = await createSupabase();
  let uploadError: { message?: string } | null = null;
  let uploadedWithAdmin = false;

  const firstUpload = await storage.storage
    .from(TODO_ATTACHMENT_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });
  uploadError = firstUpload.error;

  if (uploadError) {
    try {
      const admin = createAdminClient();
      if (isTodoAttachmentBucketMissing(uploadError)) {
        const bucket = await ensureTodoAttachmentBucketExists(admin);
        if (!bucket.ok) return { error: `Upload pièce jointe: ${bucket.error}` };
      }
      const retry = await admin.storage.from(TODO_ATTACHMENT_BUCKET).upload(path, file, {
        contentType,
        upsert: false,
      });
      uploadError = retry.error;
      uploadedWithAdmin = !retry.error;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: isTodoAttachmentBucketMissing(uploadError)
          ? "Upload pièce jointe: bucket todo-attachments introuvable et création automatique indisponible"
          : `Upload pièce jointe: ${message}`,
      };
    }
  }

  if (uploadError) return { error: `Upload pièce jointe: ${uploadError.message}` };

  const publicUrlClient = uploadedWithAdmin ? createAdminClient() : storage;
  const { data } = publicUrlClient.storage
    .from(TODO_ATTACHMENT_BUCKET)
    .getPublicUrl(path);
  const url = data.publicUrl;
  return {
    attachment: {
      name: file.name,
      url,
      contentType,
      markdown: todoAttachmentMarkdown(file.name, url, contentType),
    },
  };
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

export async function importTodoTasksFromEmailAction(input: unknown) {
  const user = await requireUser();
  const parsed = importEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const [projectsResult, tasksResult] = await Promise.all([
    supabase
      .from("todo_project")
      .select("*")
      .eq("user_id", user.id)
      .order("order", { ascending: true }),
    supabase
      .from("todo_task")
      .select("*")
      .eq("user_id", user.id)
      .order("number", { ascending: true }),
  ]);
  if (projectsResult.error) throw projectsResult.error;
  if (tasksResult.error) throw tasksResult.error;

  const projects = (projectsResult.data ?? []).map(toTodoProject);
  if (projects.length === 0) {
    return { error: "Crée au moins un projet avant d’importer un email" };
  }
  const fallbackProject = parsed.data.fallbackProjectId
    ? projects.find((project) => project.id === parsed.data.fallbackProjectId)
    : projects[0];
  if (!fallbackProject) return { error: "Projet sélectionné introuvable" };

  const existingTasks = (tasksResult.data ?? []).map(toTodoTask);
  const projectCatalog = projects
    .map((project) => `- ${project.id}: ${project.name}`)
    .join("\n");
  const existingTaskCatalog = existingTasks.length
    ? existingTasks
        .map((task) => {
          const project = projects.find((item) => item.id === task.projectId);
          return `- ${project?.name ?? "Projet inconnu"} (${task.projectId}) — UC-${task.number} [${TODO_STATUS_LABELS[task.status]}]: ${task.title}`;
        })
        .join("\n")
    : "Aucune tâche existante.";

  let proposals: EmailTaskProposal[];
  try {
    const response = await generateText({
      model: TASK_SUMMARY_MODEL,
      system:
        "Tu es Hermes, assistant de tri de demandes client. Tu transformes un email en tâches actionnables pour un kanban de développement, sans inventer de demande absente.",
      prompt: buildEmailTaskImportPrompt({
        projectCatalog,
        existingTaskCatalog,
        fallbackProjectId: fallbackProject.id,
        fallbackProjectName: fallbackProject.name,
        content: parsed.data.content,
      }),
      maxTokens: 4000,
    });
    proposals = parseEmailTaskProposals(response);
  } catch (error) {
    proposals = extractEmailTaskCandidates(parsed.data.content, fallbackProject.id);
    if (proposals.length === 0) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Hermes n’a pas pu analyser l’email",
      };
    }
  }

  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const knownFingerprints = new Set(
    existingTasks.map((task) => `${task.projectId}:${normalizeTaskFingerprint(task.title)}`),
  );
  const createdFingerprints = new Set<string>();
  const skipped: { title: string; projectName: string; reason: string }[] = [];
  const candidates: {
    projectId: string;
    title: string;
    description: string | null;
    status: "TODO";
    order: number;
  }[] = [];
  const nextOrderByProject = new Map<string, number>();
  for (const task of existingTasks) {
    if (task.status !== "TODO") continue;
    nextOrderByProject.set(
      task.projectId,
      Math.max(nextOrderByProject.get(task.projectId) ?? 0, task.order + 1),
    );
  }

  for (const proposal of proposals) {
    const project =
      (proposal.projectId ? projectsById.get(proposal.projectId) : null) ?? fallbackProject;
    const title = proposal.title.trim();
    if (!title) continue;
    const fingerprint = `${project.id}:${normalizeTaskFingerprint(title)}`;
    if (proposal.alreadyDone || knownFingerprints.has(fingerprint) || createdFingerprints.has(fingerprint)) {
      skipped.push({
        title,
        projectName: project.name,
        reason:
          proposal.reason ||
          (knownFingerprints.has(fingerprint)
            ? "Une tâche similaire existe déjà dans ce projet."
            : "Doublon détecté dans l’import."),
      });
      continue;
    }
    createdFingerprints.add(fingerprint);
    const order = nextOrderByProject.get(project.id) ?? 0;
    nextOrderByProject.set(project.id, order + 1);
    candidates.push({
      projectId: project.id,
      title,
      description: proposal.description?.trim() || null,
      status: "TODO",
      order,
    });
  }

  if (candidates.length === 0) {
    return { imported: [] as TodoTaskView[], skipped };
  }

  const profile = await getProfile(user.id);
  if (!profile) throw new Error("Profil introuvable");
  const rows = candidates.map((candidate, index) => ({
    user_id: user.id,
    project_id: candidate.projectId,
    number: profile.nextTaskNumber + index,
    title: candidate.title,
    description: candidate.description,
    status: candidate.status,
    order: candidate.order,
    completed_at: null,
  }));
  const { data: insertedRows, error: insertError } = await supabase
    .from("todo_task")
    .insert(rows)
    .select("*");
  if (insertError) throw insertError;

  const { error: profileError } = await supabase
    .from("profile")
    .update({
      next_task_number: profile.nextTaskNumber + rows.length,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (profileError) throw profileError;

  revalidatePath("/todo");
  for (const projectId of new Set(candidates.map((candidate) => candidate.projectId))) {
    revalidatePath(`/projects/${projectId}`);
  }

  return {
    imported: (insertedRows ?? []).map((row) => serializeTask(toTodoTask(row))),
    skipped,
  };
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

  let task = toTodoTask(taskRow);
  const hermesTaskStatus = getTodoStatusAfterHermesStart(task.status);
  if (task.status !== hermesTaskStatus) {
    const order = await nextTaskOrder(user.id, task.projectId, hermesTaskStatus);
    const { data: updatedTaskRow, error: updateTaskError } = await supabase
      .from("todo_task")
      .update({
        status: hermesTaskStatus,
        order,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updateTaskError) throw updateTaskError;
    task = toTodoTask(updatedTaskRow);
  }
  const project = await getProjectForUser(user.id, task.projectId);
  if (!project) return { error: "Projet introuvable" };
  const extraInstructions = parsed.data.instructions?.trim() || null;

  const hermes = getHermesWebhookConfig();
  if (!hermes.url || !hermes.secret) {
    return { error: "Variables HERMES_WEBHOOK_URL/HERMES_WEBHOOK_SECRET manquantes" };
  }
  const preferredCodingTool = parsed.data.preferredCodingTool;

  const { data: jobRow, error: jobError } = await supabase
    .from("todo_implementation_job")
    .insert({
      user_id: user.id,
      task_id: task.id,
      project_id: project.id,
      status: "QUEUED",
      agent: "hermes",
      instructions: extraInstructions,
      logs: extraInstructions
        ? `Job envoyé à Hermes (${preferredCodingTool}) avec instructions complémentaires.`
        : `Job envoyé à Hermes (${preferredCodingTool}).`,
    })
    .select("*")
    .single();
  if (jobError) throw jobError;

  const job = toTodoImplementationJob(jobRow);
  const appUrl = await getAppUrl();
  const testingContract = getHermesImplementationTestingContract();
  const callbackSecret = getImplementationCallbackSecret();
  const callbackToken = callbackSecret
    ? implementationCallbackTokenFor(job.id, task.id, callbackSecret)
    : "";

  const preferredCodingToolInstruction =
    preferredCodingTool === "claude"
      ? "Utilise Claude Code comme agent de code principal pour cette implémentation (particulièrement adapté UI/design). Hermes reste orchestrateur: il doit vérifier le résultat, lancer les checks, committer, pousser et ouvrir la PR."
      : preferredCodingTool === "codex"
        ? "Utilise Codex comme agent de code principal pour cette implémentation. N’utilise Claude Code que si la tâche nécessite une itération UI/design difficile. Hermes reste orchestrateur: il doit vérifier le résultat, lancer les checks, committer, pousser et ouvrir la PR."
        : "Implémente directement avec Hermes sans déléguer par défaut à Codex ou Claude Code, sauf si nécessaire. Hermes reste responsable des checks, du commit, du push et de la PR.";

  const payload = {
    event_type: IMPLEMENT_TASK_EVENT,
    jobId: job.id,
    task: {
      id: task.id,
      number: task.number,
      title: task.title,
      description: task.description,
      status: task.status,
      additionalInstructions: extraInstructions,
    },
    project: {
      id: project.id,
      name: project.name,
    },
    automation: {
      mode: "hermes",
      preferredCodingTool,
      repositoryResolution: "vps_hermes",
      instructions: extraInstructions
        ? `${preferredCodingToolInstruction} Résous le dépôt/projet côté VPS à partir du nom du projet et du contexte de la tâche; les champs repo* sont seulement des indices optionnels. Applique aussi le contrat testing ci-dessous: prépare le jeu de données nécessaire, documente les données de test et fournis une URL directe de preview vers la page à valider. Consignes complémentaires utilisateur à appliquer à cette itération: ${extraInstructions}`
        : `${preferredCodingToolInstruction} Résous le dépôt/projet côté VPS à partir du nom du projet et du contexte de la tâche; les champs repo* sont seulement des indices optionnels. Applique aussi le contrat testing ci-dessous: prépare le jeu de données nécessaire, documente les données de test et fournis une URL directe de preview vers la page à valider.`,
      testing: testingContract,
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
      task: serializeTask(task),
      job: failedRow
        ? serializeTodoImplementationJob(toTodoImplementationJob(failedRow))
        : serializeTodoImplementationJob(job),
    };
  }

  revalidatePath("/todo");
  revalidatePath(`/projects/${project.id}`);
  return { task: serializeTask(task), job: serializeTodoImplementationJob(job) };
}

export async function refreshTodoImplementationJobsAction(input: unknown) {
  const user = await requireUser();
  const parsed = implementationJobsRefreshSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const taskIds = Array.from(new Set(parsed.data.taskIds));
  if (taskIds.length === 0) {
    return { jobs: [] as TodoImplementationJobView[], tasks: [] as TodoTaskView[] };
  }

  const supabase = await getSupabaseDb();
  const { data: taskRows, error: taskError } = await supabase
    .from("todo_task")
    .select("*")
    .eq("user_id", user.id)
    .in("id", taskIds);
  if (taskError) throw taskError;

  const { data: jobRows, error } = await supabase
    .from("todo_implementation_job")
    .select("*")
    .eq("user_id", user.id)
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latestJobByTaskId = new Map<string, TodoImplementationJob>();
  for (const job of (jobRows ?? []).map(toTodoImplementationJob)) {
    if (!latestJobByTaskId.has(job.taskId)) latestJobByTaskId.set(job.taskId, job);
  }

  return {
    tasks: (taskRows ?? []).map((row) => serializeTask(toTodoTask(row))),
    jobs: Array.from(latestJobByTaskId.values()).map(serializeTodoImplementationJob),
  };
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
  prompt: z
    .string()
    .trim()
    .max(2_000, "Consigne trop longue")
    .optional(),
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

  const { data: jobRows, error: jobsError } = await supabase
    .from("todo_implementation_job")
    .select("*")
    .eq("user_id", user.id)
    .in(
      "task_id",
      tasks.map((task) => task.id),
    )
    .order("created_at", { ascending: false });
  if (jobsError) throw jobsError;

  const latestJobByTaskId = new Map<string, TodoImplementationJob>();
  for (const job of (jobRows ?? []).map(toTodoImplementationJob)) {
    if (!latestJobByTaskId.has(job.taskId)) latestJobByTaskId.set(job.taskId, job);
  }

  const taskList = tasks
    .map((task) => {
      const description = task.description?.trim();
      const job = latestJobByTaskId.get(task.id);
      return `- UC-${task.number} — ${task.title} [${TODO_STATUS_LABELS[task.status]}]${
        description ? `\n  Description: ${description}` : ""
      }${task.prUrl ? `\n  PR tâche: ${task.prUrl}` : ""}${
        job?.prUrl ? `\n  PR Hermes: ${job.prUrl}` : ""
      }${task.previewUrl || job?.previewUrl ? `\n  Preview: ${task.previewUrl ?? job?.previewUrl}` : ""}`;
    })
    .join("\n");
  const repoContext = await buildTodoSummaryImplementationContext(
    tasks.map((task) => {
      const job = latestJobByTaskId.get(task.id);
      return {
        taskNumber: task.number,
        taskTitle: task.title,
        taskDescription: task.description,
        taskPrUrl: task.prUrl,
        taskPreviewUrl: task.previewUrl,
        jobPrUrl: job?.prUrl,
        jobPreviewUrl: job?.previewUrl,
        jobBranchName: job?.branchName,
        jobLogs: job?.logs,
      };
    }),
  );
  const userPrompt = parsed.data.prompt;

  try {
    const summary = await generateText({
      model: TASK_SUMMARY_MODEL,
      system:
        "Tu es un assistant qui rédige des résumés de travail clairs et concis en français pour un développeur freelance. Tu peux utiliser le contexte GitHub/Hermes fourni pour comprendre les vrais changements de code, sans exposer de détails sensibles.",
      prompt: `Voici une liste de tâches réalisées sur un projet. Rédige un résumé synthétique des modifications effectuées, destiné à être communiqué à un client.

Commence ta réponse exactement par "Voilà le résumé des modifications effectuées :" puis présente les tâches sous forme de liste à puces, reformulées de manière professionnelle et lisible. Pas de jargon technique inutile, pas de numéros "UC-". Utilise le contexte repo/PR pour comprendre ce qui a réellement changé, mais ne cite pas les noms de fichiers sauf si c'est nécessaire pour la clarté. Reste factuel : ne rajoute rien qui ne soit pas étayé par les tâches, les PR, les logs ou les diffs fournis.

${
  userPrompt
    ? `Consigne complémentaire de mise en forme ou d'organisation à respecter si elle ne contredit pas les règles précédentes :\n${userPrompt}\n`
    : ""
}
Tâches :
${taskList}

Contexte repo, PR et logs Hermes à utiliser pour comprendre les changements :
${repoContext || "Aucun contexte repo disponible pour les tâches sélectionnées."}`,
      maxTokens: 1400,
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
