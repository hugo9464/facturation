import { DIRECT_INSTRUCTION_EVENT } from "./hermes-automation";

export const HERMES_DIRECT_INSTRUCTION_EVENT = DIRECT_INSTRUCTION_EVENT;
export const HERMES_TERMINAL_RESPONSE_EXCERPT_LIMIT = 1_200;

const SENSITIVE_KEY_PATTERN =
  /(?:secret|token|password|passwd|authorization|signature|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)/i;
const SENSITIVE_STRING_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi,
    replacement: "$1 [redacted]",
  },
  {
    pattern: /\b(hmac|sha256|sha1)=[A-Fa-f0-9]{16,}\b/g,
    replacement: "$1=[redacted]",
  },
  {
    pattern:
      /\b(secret|token|password|passwd|api[_-]?key|client[_-]?secret)=([^&\s]+)/gi,
    replacement: "$1=[redacted]",
  },
];

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

export type HermesTerminalResponseDetails = {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string | null;
  bodyExcerpt: string | null;
  json: unknown | null;
  truncated: boolean;
};

export function normalizeHermesInstruction(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function redactHermesTerminalString(value: string): string {
  return SENSITIVE_STRING_PATTERNS.reduce(
    (redacted, { pattern, replacement }) => redacted.replace(pattern, replacement),
    value,
  );
}

export function redactHermesTerminalValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactHermesTerminalString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactHermesTerminalValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[redacted]"
          : redactHermesTerminalValue(nestedValue),
      ]),
    );
  }
  return value;
}

export function createHermesTerminalResponseDetails(input: {
  ok: boolean;
  status: number;
  statusText?: string;
  contentType?: string | null;
  bodyText?: string | null;
  excerptLimit?: number;
}): HermesTerminalResponseDetails {
  const limit = input.excerptLimit ?? HERMES_TERMINAL_RESPONSE_EXCERPT_LIMIT;
  const rawBody = input.bodyText ?? "";
  const contentType = input.contentType?.trim() || null;
  let json: unknown | null = null;
  let excerptSource = rawBody;

  if (rawBody.trim()) {
    try {
      json = redactHermesTerminalValue(JSON.parse(rawBody));
      excerptSource = JSON.stringify(json, null, 2);
    } catch {
      json = null;
    }
  }

  const redactedExcerpt = redactHermesTerminalString(excerptSource).trim();
  const truncated = redactedExcerpt.length > limit;

  return {
    ok: input.ok,
    status: input.status,
    statusText: input.statusText?.trim() ?? "",
    contentType,
    bodyExcerpt: redactedExcerpt
      ? redactedExcerpt.slice(0, limit) + (truncated ? "\n[truncated]" : "")
      : null,
    json: truncated ? null : json,
    truncated,
  };
}

export function formatHermesTerminalResponseStatus(
  response: Pick<HermesTerminalResponseDetails, "ok" | "status" | "statusText" | "contentType">,
): string {
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const contentType = response.contentType ? ` · ${response.contentType}` : "";
  return `${response.ok ? "OK" : "ERROR"} HTTP ${response.status}${statusText}${contentType}`;
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
