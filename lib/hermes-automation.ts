import { createHmac, timingSafeEqual } from "node:crypto";

export const IMPLEMENT_TASK_EVENT = "implement_task";

export type HermesWebhookHeaders = {
  "Content-Type": "application/json";
  "X-GitHub-Event": typeof IMPLEMENT_TASK_EVENT;
  "X-Hub-Signature-256": string;
};

export function hmacSha256Hex(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function createHermesWebhookHeaders(
  body: string,
  secret: string,
): HermesWebhookHeaders {
  return {
    "Content-Type": "application/json",
    "X-GitHub-Event": IMPLEMENT_TASK_EVENT,
    "X-Hub-Signature-256": `sha256=${hmacSha256Hex(body, secret)}`,
  };
}

export function implementationCallbackTokenFor(
  jobId: string,
  taskId: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${jobId}:${taskId}`)
    .digest("hex");
}

export function verifyImplementationCallbackToken(
  jobId: string,
  taskId: string,
  token: string,
  secret: string,
): boolean {
  const expected = implementationCallbackTokenFor(jobId, taskId, secret);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getHermesWebhookConfig() {
  return {
    url: process.env.HERMES_WEBHOOK_URL ?? "",
    secret: process.env.HERMES_WEBHOOK_SECRET ?? "",
  };
}

export function getImplementationCallbackSecret(): string {
  return (
    process.env.FACTURATION_CALLBACK_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    ""
  );
}
