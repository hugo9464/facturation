export function timestampValue(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function parseSeenProjectTaskUpdates(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return null;
  }
}

export function hasUnseenTaskChange({
  taskUpdatedAt,
  projectSeenAt,
}: {
  taskUpdatedAt: string | null | undefined;
  projectSeenAt: number | null | undefined;
}) {
  return timestampValue(taskUpdatedAt) > (projectSeenAt ?? 0);
}
