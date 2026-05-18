export function getPreviewLoginSecret(): string | null {
  return process.env.PREVIEW_LOGIN_SECRET?.trim() || null;
}

export function getPreviewLoginCredentials(): {
  email: string;
  password: string;
} | null {
  const email = process.env.PREVIEW_LOGIN_EMAIL?.trim();
  const password = process.env.PREVIEW_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function isPreviewLoginEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function sanitizePreviewNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function buildPreviewAccessUrl(
  previewUrl: string | null | undefined,
  options: {
    previewLoginSecret?: string | null;
    vercelAutomationBypassSecret?: string | null;
  } = {},
): string | null {
  if (!previewUrl) return null;

  const loginSecret = options.previewLoginSecret?.trim();
  if (!loginSecret) return previewUrl;

  const url = new URL(previewUrl);
  const nextPath = sanitizePreviewNextPath(
    `${url.pathname}${url.search}${url.hash}`,
  );

  url.pathname = "/api/dev/preview-login";
  url.search = "";
  url.hash = "";
  url.searchParams.set("token", loginSecret);
  url.searchParams.set("next", nextPath);

  const vercelSecret = options.vercelAutomationBypassSecret?.trim();
  if (vercelSecret) {
    url.searchParams.set("x-vercel-protection-bypass", vercelSecret);
    url.searchParams.set("x-vercel-set-bypass-cookie", "true");
  }

  return url.toString();
}

export function buildPreviewAccessUrlFromEnv(
  previewUrl: string | null | undefined,
): string | null {
  return buildPreviewAccessUrl(previewUrl, {
    previewLoginSecret: getPreviewLoginSecret(),
    vercelAutomationBypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  });
}
