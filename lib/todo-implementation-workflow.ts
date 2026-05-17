import type { TodoImplementationJobStatus, TodoStatus } from "../db/schema";

export const HERMES_MERGE_AGENT = "hermes-merge";

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
