function sanitizePreviewPath(value: string | null | undefined): string {
  if (!value?.trim()) return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  try {
    const parsed = new URL(trimmed, "https://facturation.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function buildTodoTaskPreviewPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function isGenericPreviewPath(path: string): boolean {
  return path === "/" || path === "/login";
}

export function buildTodoTaskPreviewUrl(
  previewUrl: string | null | undefined,
  projectId: string,
): string | null {
  if (!previewUrl) return null;

  const targetPath = buildTodoTaskPreviewPath(projectId);

  try {
    const url = new URL(previewUrl);
    const currentPath = `${url.pathname}${url.search}${url.hash}`;

    if (url.pathname === "/auth/preview" || url.pathname === "/api/dev/preview-login") {
      const next = sanitizePreviewPath(url.searchParams.get("next"));
      if (isGenericPreviewPath(next)) {
        url.searchParams.set("next", targetPath);
      }
      return url.toString();
    }

    if (isGenericPreviewPath(sanitizePreviewPath(currentPath))) {
      url.pathname = targetPath;
      url.search = "";
      url.hash = "";
    }

    return url.toString();
  } catch {
    return previewUrl;
  }
}
