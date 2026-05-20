"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createHermesWebhookHeaders } from "@/lib/hermes-automation";
import {
  buildHermesDirectInstructionPayload,
  createHermesTerminalResponseDetails,
  getHermesTerminalWebhookConfig,
  redactHermesTerminalString,
  type HermesTerminalResponseDetails,
} from "@/lib/hermes-terminal";

const hermesTerminalInstructionSchema = z.object({
  instruction: z.string().trim().min(1, "Instruction obligatoire").max(8_000, "Instruction trop longue"),
  currentPath: z.string().trim().max(500).optional().nullable(),
});

type HermesTerminalInstructionActionResult = {
  ok?: true;
  error?: string;
  response?: HermesTerminalResponseDetails;
};

export async function sendHermesTerminalInstructionAction(
  input: unknown,
): Promise<HermesTerminalInstructionActionResult> {
  const user = await requireUser();
  const parsed = hermesTerminalInstructionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const hermes = getHermesTerminalWebhookConfig();
  if (!hermes.url || !hermes.secret) {
    return {
      error:
        "Variables HERMES_TERMINAL_WEBHOOK_URL/HERMES_TERMINAL_WEBHOOK_SECRET ou HERMES_WEBHOOK_URL/HERMES_WEBHOOK_SECRET manquantes",
    };
  }

  const payload = buildHermesDirectInstructionPayload({
    instruction: parsed.data.instruction,
    currentPath: parsed.data.currentPath ?? null,
    userEmail: user.email ?? null,
  });
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(hermes.url, {
      method: "POST",
      headers: createHermesWebhookHeaders(body, hermes.secret, hermes.event),
      body,
    });
    const text = await response.text().catch(() => "");
    const responseDetails = createHermesTerminalResponseDetails({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyText: text,
    });

    if (!response.ok) {
      return {
        error: `Hermes HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
        response: responseDetails,
      };
    }

    return { ok: true, response: responseDetails };
  } catch (error) {
    const message = redactHermesTerminalString(
      error instanceof Error ? error.message : "Échec appel Hermes",
    );
    return { error: message };
  }
}
