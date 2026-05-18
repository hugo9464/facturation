import * as assert from "node:assert/strict";
import {
  MERGE_TASK_EVENT,
  createHermesWebhookHeaders,
} from "../lib/hermes-automation";
import {
  shouldMoveTaskToValidationAfterCallback,
  canRequestHermesMerge,
  extractHermesTestInstructions,
  getHermesImplementationTestingContract,
  getHermesProgressView,
  getHermesStatusTransition,
  getTodoPullRequestState,
  isHermesJobActive,
  getTodoStatusAfterHermesStart,
  resolveCallbackErrorMessage,
} from "../lib/todo-implementation-workflow";

assert.equal(
  shouldMoveTaskToValidationAfterCallback({
    jobAgent: "hermes",
    callbackStatus: "SUCCEEDED",
  }),
  false,
  "an implementation success must keep the task in progress until the user validates it",
);

assert.equal(
  shouldMoveTaskToValidationAfterCallback({
    jobAgent: "hermes-merge",
    callbackStatus: "SUCCEEDED",
  }),
  true,
  "a merge success must move the task to validation",
);

assert.equal(
  resolveCallbackErrorMessage({
    callbackStatus: "SUCCEEDED",
    callbackErrorMessage: undefined,
    hasCallbackErrorMessage: false,
    storedErrorMessage: "GraphQL: Could not resolve to a Repository",
  }),
  null,
  "a successful callback must clear a stale error even when errorMessage is omitted",
);

assert.equal(
  resolveCallbackErrorMessage({
    callbackStatus: "FAILED",
    callbackErrorMessage: null,
    hasCallbackErrorMessage: true,
    storedErrorMessage: "old error",
  }),
  null,
  "an explicit null errorMessage must clear the stored error",
);

assert.equal(
  resolveCallbackErrorMessage({
    callbackStatus: "RUNNING",
    callbackErrorMessage: undefined,
    hasCallbackErrorMessage: false,
    storedErrorMessage: "previous diagnostic",
  }),
  "previous diagnostic",
  "non-terminal callbacks without errorMessage keep the current diagnostic",
);

assert.equal(
  canRequestHermesMerge({
    taskStatus: "IN_PROGRESS",
    jobStatus: "SUCCEEDED",
    prUrl: "https://github.com/acme/app/pull/12",
  }),
  true,
  "a completed Hermes implementation with a PR can be user-validated",
);

assert.equal(
  canRequestHermesMerge({
    taskStatus: "TO_TEST",
    jobStatus: "SUCCEEDED",
    prUrl: "https://github.com/acme/app/pull/12",
  }),
  false,
  "tasks already in validation should not request another merge",
);

const mergeHeaders = createHermesWebhookHeaders(
  JSON.stringify({ event_type: MERGE_TASK_EVENT }),
  "secret-123",
  MERGE_TASK_EVENT,
);
assert.equal(mergeHeaders["X-GitHub-Event"], MERGE_TASK_EVENT);

assert.equal(isHermesJobActive("QUEUED"), true);
assert.equal(isHermesJobActive("RUNNING"), true);
assert.equal(isHermesJobActive("WAITING_PREVIEW"), true);
assert.equal(isHermesJobActive("SUCCEEDED"), false);

assert.deepEqual(
  getHermesStatusTransition({
    taskStatus: "IN_PROGRESS",
    jobStatus: "RUNNING",
    jobAgent: "hermes",
  }),
  { from: "TODO", to: "IN_PROGRESS" },
  "an active Hermes implementation should be displayed between todo and in-progress",
);
assert.equal(
  getHermesStatusTransition({
    taskStatus: "IN_PROGRESS",
    jobStatus: "SUCCEEDED",
    jobAgent: "hermes",
  }),
  null,
  "completed implementation jobs should return to the normal status column",
);
assert.equal(
  getHermesStatusTransition({
    taskStatus: "IN_PROGRESS",
    jobStatus: "RUNNING",
    jobAgent: "hermes-merge",
  }),
  null,
  "merge jobs should not use the implementation transition lane",
);

assert.equal(
  getTodoStatusAfterHermesStart("TODO"),
  "IN_PROGRESS",
  "starting Hermes on a todo task must move it to in progress immediately",
);
assert.equal(
  getTodoStatusAfterHermesStart("TO_TEST"),
  "IN_PROGRESS",
  "restarting Hermes from validation must show that work is in progress again",
);

assert.deepEqual(
  getHermesProgressView({
    status: "RUNNING",
    logs: "Clone du dépôt\nTests en cours\nOuverture de la PR",
    updatedAt: "2026-05-17T20:00:00.000Z",
  }),
  {
    label: "En cours",
    tone: "active",
    detail: "Ouverture de la PR",
    steps: ["Clone du dépôt", "Tests en cours", "Ouverture de la PR"],
    testInstructions: null,
  },
);

assert.deepEqual(
  getHermesProgressView({
    status: "WAITING_PREVIEW",
    logs: "PR ouverte",
    updatedAt: "2026-05-17T20:00:00.000Z",
  }),
  {
    label: "Preview en attente",
    tone: "waiting",
    detail: "PR ouverte",
    steps: ["PR ouverte"],
    testInstructions: null,
  },
);

assert.match(
  getHermesImplementationTestingContract().dataset,
  /jeu de données adéquat/,
);
assert.match(
  getHermesImplementationTestingContract().finalLogs,
  /Instructions de test/,
);
assert.match(
  getHermesImplementationTestingContract().preview,
  /page précise/,
);
assert.equal(
  extractHermesTestInstructions(
    "PR ouverte\nInstructions de test:\n1. Ouvre la preview /todo\n2. Vérifie la tâche UC-42",
  ),
  "1. Ouvre la preview /todo\n2. Vérifie la tâche UC-42",
);

assert.equal(
  getTodoPullRequestState({
    taskStatus: "IN_PROGRESS",
    jobStatus: "SUCCEEDED",
    jobAgent: "hermes",
    prUrl: "https://github.com/acme/app/pull/12",
    logs: "PR ouverte",
    errorMessage: null,
  }),
  "ready",
  "a successful implementation PR should be shown as ready to merge",
);

assert.equal(
  getTodoPullRequestState({
    taskStatus: "IN_PROGRESS",
    jobStatus: "FAILED",
    jobAgent: "hermes-merge",
    prUrl: "https://github.com/acme/app/pull/12",
    logs: "mergeStateStatus=DIRTY",
    errorMessage: "Merge conflict detected",
  }),
  "conflict",
  "a merge-conflicted PR should be shown in red",
);

assert.equal(
  getTodoPullRequestState({
    taskStatus: "TO_TEST",
    jobStatus: "SUCCEEDED",
    jobAgent: "hermes-merge",
    prUrl: "https://github.com/acme/app/pull/12",
    logs: "PR mergée",
    errorMessage: null,
  }),
  "merged",
  "a merged PR should be shown in violet",
);

console.log("todo implementation workflow tests passed");
