import type { SupabaseClient } from "@supabase/supabase-js";

export const TODO_ATTACHMENT_BUCKET = "todo-attachments";
export const TODO_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

const TODO_ATTACHMENT_SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

export function safeTodoAttachmentName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(TODO_ATTACHMENT_SAFE_NAME_RE, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return cleaned || "piece-jointe";
}

export function todoAttachmentMarkdown(name: string, url: string, type: string) {
  const escapedName = name.replace(/[\[\]]/g, "");
  return type.startsWith("image/")
    ? `![${escapedName}](${url})`
    : `[${escapedName}](${url})`;
}

export function isTodoAttachmentBucketMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const statusCode = "statusCode" in error ? String(error.statusCode) : "";
  const errorCode = "error" in error ? String(error.error) : "";
  return (
    /bucket not found/i.test(message) ||
    /not found/i.test(message) ||
    statusCode === "404" ||
    errorCode === "NoSuchBucket"
  );
}

export function isTodoAttachmentBucketAlreadyExists(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const statusCode = "statusCode" in error ? String(error.statusCode) : "";
  return /already exists|duplicate/i.test(message) || statusCode === "409";
}

type StorageAdminClient = Pick<SupabaseClient, "storage">;

export async function ensureTodoAttachmentBucketExists(admin: StorageAdminClient) {
  const existing = await admin.storage.getBucket(TODO_ATTACHMENT_BUCKET);
  if (!existing.error) return { ok: true as const };

  const created = await admin.storage.createBucket(TODO_ATTACHMENT_BUCKET, {
    public: true,
    fileSizeLimit: TODO_ATTACHMENT_MAX_BYTES,
  });

  if (!created.error || isTodoAttachmentBucketAlreadyExists(created.error)) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    error: created.error.message || "Bucket de pièces jointes indisponible",
  };
}
