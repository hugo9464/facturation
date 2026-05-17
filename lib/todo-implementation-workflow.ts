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

export type TodoPullRequestState = "default" | "ready" | "conflict" | "merged";

const MERGE_CONFLICT_PATTERN =
  /\b(merge conflict|merge conflicts|conflit(?:s)? de merge|conflit(?:s)? de fusion|mergeStateStatus\s*=\s*DIRTY|mergeable[^\n]*(?:false|null)|cannot be merged|can't automatically merge|not mergeable)\b/i;

export function getTodoPullRequestState({
  taskStatus,
  jobStatus,
  jobAgent,
  prUrl,
  logs,
  errorMessage,
}: {
  taskStatus: TodoStatus;
  jobStatus: TodoImplementationJobStatus | null | undefined;
  jobAgent: string | null | undefined;
  prUrl: string | null | undefined;
  logs: string | null | undefined;
  errorMessage: string | null | undefined;
}): TodoPullRequestState {
  if (!prUrl) return "default";

  if (taskStatus === "TO_TEST" || taskStatus === "DONE") {
    return "merged";
  }

  const diagnosticText = `${errorMessage ?? ""}\n${logs ?? ""}`;
  if (jobStatus === "FAILED" && MERGE_CONFLICT_PATTERN.test(diagnosticText)) {
    return "conflict";
  }

  if (
    canRequestHermesMerge({
      taskStatus,
      jobStatus: jobStatus ?? "QUEUED",
      prUrl,
    }) &&
    jobAgent !== HERMES_MERGE_AGENT
  ) {
    return "ready";
  }

  return "default";
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

export const HERMES_TESTING_LOG_SECTION = "Instructions de test";

export type HermesImplementationTestingContract = {
  dataset: string;
  finalLogs: string;
  preview: string;
};

export function getHermesImplementationTestingContract(): HermesImplementationTestingContract {
  return {
    dataset:
      "Avant de finaliser, crée ou documente le jeu de données adéquat pour tester la fonctionnalité dans la preview Vercel. Si la fonctionnalité dépend de données applicatives, prépare des données réalistes et indique leurs noms/valeurs dans les logs finaux.",
    finalLogs:
      `Dans le callback final, ajoute une section \"${HERMES_TESTING_LOG_SECTION}\" avec les étapes exactes à exécuter, les données de test créées/à utiliser, le résultat attendu et les limites éventuelles.`,
    preview:
      "Fournis un previewUrl pointant vers la page précise à tester dans la preview Vercel (pas seulement la racine) dès qu'elle est disponible.",
  };
}

export function extractHermesTestInstructions(logs: string | null | undefined) {
  if (!logs) return null;
  const match = logs.match(
    /(?:^|\n)\s*(?:#{1,6}\s*)?Instructions de test\s*:?\s*\n([\s\S]*)/i,
  );
  return match?.[1]?.trim() || null;
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
    testInstructions: extractHermesTestInstructions(logs),
  };
}
