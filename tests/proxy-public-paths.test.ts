import * as assert from "node:assert/strict";
import { isLocalhostHostHeader } from "../lib/local-dev-auth";
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
assert.equal(isLocalhostHostHeader("localhost:3000"), true);
assert.equal(isLocalhostHostHeader("127.0.0.1:3000"), true);
assert.equal(isLocalhostHostHeader("[::1]:3000"), true);
assert.equal(isLocalhostHostHeader("example.com"), false);

console.log("proxy public path tests passed");
