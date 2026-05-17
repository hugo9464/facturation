import { DIRECT_INSTRUCTION_EVENT } from "./hermes-automation";

export const HERMES_DIRECT_INSTRUCTION_EVENT = DIRECT_INSTRUCTION_EVENT;

export type HermesDirectInstructionPayload = {
  event_type: typeof HERMES_DIRECT_INSTRUCTION_EVENT;
  source: "facturation_global_terminal";
  instruction: string;
  context: {
    app: "Facturation";
    currentPath: string | null;
    userEmail: string | null;
  };
  automation: {
    mode: "hermes_direct";
    instructions: string;
  };
  createdAt: string;
};

export function normalizeHermesInstruction(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function buildHermesDirectInstructionPayload(input: {
  instruction: string;
  currentPath?: string | null;
  userEmail?: string | null;
  createdAt?: string;
}): HermesDirectInstructionPayload {
  const instruction = normalizeHermesInstruction(input.instruction);
  return {
    event_type: HERMES_DIRECT_INSTRUCTION_EVENT,
    source: "facturation_global_terminal",
    instruction,
    context: {
      app: "Facturation",
      currentPath: input.currentPath ?? null,
      userEmail: input.userEmail ?? null,
    },
    automation: {
      mode: "hermes_direct",
      instructions:
        "Instruction directe envoyée depuis le bouton global Facturation. Hermes doit traiter cette demande sur le VPS comme une instruction utilisateur directe, sans la rattacher à un projet Todo sauf si l'instruction le précise.",
    },
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function deriveHermesTerminalWebhookUrl(
  implementationWebhookUrl: string,
  terminalWebhookName = "facturation-terminal",
): string {
  if (!implementationWebhookUrl) return "";
  try {
    const url = new URL(implementationWebhookUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const webhooksIndex = parts.lastIndexOf("webhooks");
    if (webhooksIndex === -1 || webhooksIndex === parts.length - 1) {
      return implementationWebhookUrl;
    }
    parts[webhooksIndex + 1] = terminalWebhookName;
    url.pathname = `/${parts.join("/")}`;
    return url.toString();
  } catch {
    return implementationWebhookUrl;
  }
}

export function getHermesTerminalWebhookConfig() {
  const terminalWebhookName =
    process.env.HERMES_TERMINAL_WEBHOOK_NAME ?? "facturation-terminal";
  const fallbackUrl = deriveHermesTerminalWebhookUrl(
    process.env.HERMES_WEBHOOK_URL ?? "",
    terminalWebhookName,
  );
  return {
    url: process.env.HERMES_TERMINAL_WEBHOOK_URL ?? fallbackUrl,
    secret:
      process.env.HERMES_TERMINAL_WEBHOOK_SECRET ??
      process.env.HERMES_WEBHOOK_SECRET ??
      "",
    event:
      process.env.HERMES_TERMINAL_WEBHOOK_EVENT ?? HERMES_DIRECT_INSTRUCTION_EVENT,
  };
}
