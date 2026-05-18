import * as assert from "node:assert/strict";
import { isPublicPreviewLoginPath, isPublicTodoApiPath } from "../proxy";

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
assert.equal(isPublicPreviewLoginPath("/api/dev/preview-login"), true);
assert.equal(isPublicPreviewLoginPath("/api/dev/preview-login/extra"), false);
assert.equal(isPublicPreviewLoginPath("/login"), false);

console.log("proxy public path tests passed");
