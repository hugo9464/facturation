import * as assert from "node:assert/strict";
import {
  buildHermesDirectInstructionPayload,
  deriveHermesTerminalWebhookUrl,
  normalizeHermesInstruction,
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

console.log("hermes-terminal tests passed");
