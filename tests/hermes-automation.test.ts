import * as assert from "node:assert/strict";
import { createHermesWebhookHeaders, implementationCallbackTokenFor } from "../lib/hermes-automation";

const body = JSON.stringify({ event_type: "implement_task", payload: { jobId: "job-1" } });
const headers = createHermesWebhookHeaders(body, "secret-123");

assert.equal(headers["Content-Type"], "application/json");
assert.equal(headers["X-GitHub-Event"], "implement_task");
assert.match(headers["X-Hub-Signature-256"], /^sha256=[a-f0-9]{64}$/);
assert.equal(
  headers["X-Hub-Signature-256"],
  "sha256=6f24e9c836664d6214aac2bcc59e95d783a8a25e4952a9b8f37161f0c83d883b",
);

const tokenA = implementationCallbackTokenFor("job-1", "task-1", "secret-123");
const tokenB = implementationCallbackTokenFor("job-1", "task-2", "secret-123");
assert.match(tokenA, /^[a-f0-9]{64}$/);
assert.notEqual(tokenA, tokenB);

console.log("hermes-automation tests passed");
