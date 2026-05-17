import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPreviewAutoLoginCredentials,
  isPreviewAutoLoginAllowed,
  sanitizePreviewNextPath,
} from "@/lib/todo-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = sanitizePreviewNextPath(request.nextUrl.searchParams.get("next"));

  if (!isPreviewAutoLoginAllowed()) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url));
  }

  const credentials = getPreviewAutoLoginCredentials();
  if (!credentials) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}&previewAuth=missing`, request.url),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(next)}&previewAuth=failed`, request.url),
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
