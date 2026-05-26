import type { NextRequest } from "next/server";

const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function hostName(value: string | null) {
  if (!value) return "";
  const host = value.split(",")[0]?.trim() ?? "";
  if (host.startsWith("[")) return host.slice(1, host.indexOf("]"));
  return host.split(":")[0] ?? "";
}

function isLocalHostName(value: string) {
  return LOCALHOST_NAMES.has(value.toLowerCase());
}

export function isLocalhostRequest(request: NextRequest) {
  return (
    isLocalHostName(request.nextUrl.hostname) ||
    isLocalHostName(hostName(request.headers.get("host")))
  );
}

export function isLocalhostHostHeader(value: string | null) {
  return isLocalHostName(hostName(value));
}
