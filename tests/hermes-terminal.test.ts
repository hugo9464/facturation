import * as assert from "node:assert/strict";
import {
  buildHermesDirectInstructionPayload,
  createHermesTerminalResponseDetails,
  deriveHermesTerminalWebhookUrl,
  formatHermesTerminalResponseStatus,
  normalizeHermesInstruction,
  redactHermesTerminalString,
  redactHermesTerminalValue,
} from "../lib/hermes-terminal";

assert.equal(normalizeHermesInstruction("  vérifie les logs\r\nmerci  "), "vérifie les logs\nmerci");
assert.equal(
  deriveHermesTerminalWebhookUrl(
    "https://vps.example.com/webhooks/facturation-implement-task",
  ),
  "https://vps.example.com/webhooks/facturation-terminal",
);

const payload = buildHermesDirectInstructionPayload({
  instruction: "  Lance /status dans Hermes  ",
  currentPath: "/todo",
  userEmail: "user@example.com",
  createdAt: "2026-05-17T20:00:00.000Z",
});

assert.equal(payload.event_type, "direct_instruction");
assert.equal(payload.source, "facturation_global_terminal");
assert.equal(payload.instruction, "Lance /status dans Hermes");
assert.equal(payload.context.app, "Facturation");
assert.equal(payload.context.currentPath, "/todo");
assert.equal(payload.context.userEmail, "user@example.com");
assert.equal(payload.automation.mode, "hermes_direct");
assert.match(payload.automation.instructions, /instruction utilisateur directe/i);
assert.equal(payload.createdAt, "2026-05-17T20:00:00.000Z");
assert.equal(JSON.stringify(payload).includes("secret"), false);

const fakeBearer = ["Bearer", "fixture", "value"].join(" ");
const fakeSignature = `sha256=${"0".repeat(16)}`;
const responseDetails = createHermesTerminalResponseDetails({
  ok: true,
  status: 202,
  statusText: "Accepted",
  contentType: "application/json; charset=utf-8",
  bodyText: JSON.stringify({
    message: "queued",
    webhookSecret: "redaction-fixture",
    nested: { authorization: fakeBearer, visible: "ok" },
  }),
});

assert.equal(responseDetails.ok, true);
assert.equal(responseDetails.status, 202);
assert.equal(responseDetails.statusText, "Accepted");
assert.equal(responseDetails.contentType, "application/json; charset=utf-8");
assert.deepEqual(responseDetails.json, {
  message: "queued",
  webhookSecret: "[redacted]",
  nested: { authorization: "[redacted]", visible: "ok" },
});
assert.match(responseDetails.bodyExcerpt ?? "", /"message": "queued"/);
assert.equal((responseDetails.bodyExcerpt ?? "").includes("redaction-fixture"), false);
assert.equal(formatHermesTerminalResponseStatus(responseDetails), "OK HTTP 202 Accepted · application/json; charset=utf-8");

const textDetails = createHermesTerminalResponseDetails({
  ok: false,
  status: 500,
  statusText: "Internal Server Error",
  contentType: "text/plain",
  bodyText: `failed with Authorization: ${fakeBearer}`,
  excerptLimit: 24,
});

assert.equal(textDetails.json, null);
assert.equal(textDetails.truncated, true);
assert.equal((textDetails.bodyExcerpt ?? "").includes("fixture value"), false);
assert.equal(formatHermesTerminalResponseStatus(textDetails), "ERROR HTTP 500 Internal Server Error · text/plain");

assert.deepEqual(
  redactHermesTerminalValue({
    apiKey: "key-123",
    output: [fakeBearer, { safe: "value" }],
  }),
  {
    apiKey: "[redacted]",
    output: ["Bearer [redacted] value", { safe: "value" }],
  },
);
assert.equal(
  redactHermesTerminalString(`url=https://example.test/webhooks/x?token=*** ${fakeSignature}`),
  "url=https://example.test/webhooks/x?token=[redacted] sha256=[redacted]",
);

console.log("hermes-terminal tests passed");
