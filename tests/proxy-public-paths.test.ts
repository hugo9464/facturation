import * as assert from "node:assert/strict";
import { isPublicTodoApiPath } from "../proxy";

assert.equal(
  isPublicTodoApiPath("/api/todo/tasks/task-1/preview"),
  true,
);
assert.equal(
  isPublicTodoApiPath("/api/todo/implementation-jobs/job-1/callback"),
  true,
);
assert.equal(isPublicTodoApiPath("/api/todo/implementation-jobs/job-1"), false);
assert.equal(isPublicTodoApiPath("/todo"), false);

console.log("proxy public path tests passed");
