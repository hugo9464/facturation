import * as assert from "node:assert/strict";
import {
  MERGE_TASK_EVENT,
  createHermesWebhookHeaders,
} from "../lib/hermes-automation";
import {
  shouldMoveTaskToValidationAfterCallback,
  canRequestHermesMerge,
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

console.log("todo implementation workflow tests passed");
