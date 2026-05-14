import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

// Jeton par tâche, dérivé de la secret key Supabase (jamais exposée côté client).
// Permet à un agent (Claude Code / Codex) d'enregistrer le lien de preview
// sans session Supabase : il prouve juste qu'il connaît le jeton de la tâche.
function previewSecret(): string | null {
  return process.env.SUPABASE_SECRET_KEY ?? null;
}

export function previewTokenFor(taskId: string): string | null {
  const secret = previewSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(taskId).digest("hex");
}

export function verifyPreviewToken(taskId: string, token: string): boolean {
  const expected = previewTokenFor(taskId);
  if (!expected || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function getAppUrl(): Promise<string> {
  const store = await headers();
  const host =
    store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";
  const proto =
    store.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
