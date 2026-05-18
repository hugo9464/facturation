import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPreviewLoginCredentials,
  getPreviewLoginSecret,
  isPreviewLoginEnabled,
  sanitizePreviewNextPath,
} from "@/lib/preview-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isPreviewLoginEnabled()) {
    return new NextResponse("Preview login disabled", { status: 404 });
  }

  const configuredToken = getPreviewLoginSecret();
  const providedToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!configuredToken || providedToken !== configuredToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const credentials = getPreviewLoginCredentials();
  if (!credentials) {
    return new NextResponse("Preview login credentials missing", { status: 500 });
  }

  const next = sanitizePreviewNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    return new NextResponse("Preview login failed", { status: 401 });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
