import type { TodoImplementationJobStatus, TodoStatus } from "../db/schema";

export const HERMES_MERGE_AGENT = "hermes-merge";

export type HermesProgressTone = "queued" | "active" | "waiting" | "success" | "error" | "muted";

const HERMES_PROGRESS_LABELS: Record<TodoImplementationJobStatus, string> = {
  QUEUED: "En file",
  RUNNING: "En cours",
  WAITING_PREVIEW: "Preview en attente",
  SUCCEEDED: "Terminé",
  FAILED: "Erreur",
  CANCELLED: "Annulé",
};

const HERMES_PROGRESS_TONES: Record<TodoImplementationJobStatus, HermesProgressTone> = {
  QUEUED: "queued",
  RUNNING: "active",
  WAITING_PREVIEW: "waiting",
  SUCCEEDED: "success",
  FAILED: "error",
  CANCELLED: "muted",
};

export function shouldMoveTaskToValidationAfterCallback({
  jobAgent,
  callbackStatus,
}: {
  jobAgent: string;
  callbackStatus: TodoImplementationJobStatus;
}) {
  return jobAgent === HERMES_MERGE_AGENT && callbackStatus === "SUCCEEDED";
}

export function canRequestHermesMerge({
  taskStatus,
  jobStatus,
  prUrl,
}: {
  taskStatus: TodoStatus;
  jobStatus: TodoImplementationJobStatus;
  prUrl: string | null | undefined;
}) {
  return taskStatus === "IN_PROGRESS" && jobStatus === "SUCCEEDED" && Boolean(prUrl);
}

export function isHermesJobActive(status: TodoImplementationJobStatus) {
  return status === "QUEUED" || status === "RUNNING" || status === "WAITING_PREVIEW";
}

export function getTodoStatusAfterHermesStart(status: TodoStatus): TodoStatus {
  void status;
  return "IN_PROGRESS";
}

export function parseHermesProgressSteps(logs: string | null | undefined) {
  if (!logs) return [];
  return logs
    .split(/\r?\n+/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•]\s*/, "")
        .replace(/^\[[^\]]+\]\s*/, ""),
    )
    .filter(Boolean)
    .slice(-5);
}

export function getHermesProgressView({
  status,
  logs,
}: {
  status: TodoImplementationJobStatus;
  logs: string | null | undefined;
  updatedAt: string;
}) {
  const steps = parseHermesProgressSteps(logs);
  return {
    label: HERMES_PROGRESS_LABELS[status],
    tone: HERMES_PROGRESS_TONES[status],
    detail: steps.at(-1) ?? HERMES_PROGRESS_LABELS[status],
    steps,
  };
}
