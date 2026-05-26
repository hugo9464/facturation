import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/local-dev-auth";
import { updateSession } from "@/lib/supabase/middleware";

export function isPublicTodoApiPath(path: string) {
  return (
    /^\/api\/todo\/tasks\/[^/]+\/preview$/.test(path) ||
    /^\/api\/todo\/implementation-jobs\/[^/]+\/callback$/.test(path)
  );
}

export function isPublicPreviewLoginPath(path: string) {
  return path === "/api/dev/preview-login";
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isLocalhostRequest(request)) {
    return NextResponse.next();
  }

  if (isPublicTodoApiPath(path) || isPublicPreviewLoginPath(path)) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
