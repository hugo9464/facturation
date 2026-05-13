import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { renderQuotePDFToBuffer } from "@/lib/pdf-render";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toQuote,
  toQuoteLine,
} from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data: quoteRow, error: quoteError } = await supabase
    .from("quote")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (quoteError) throw quoteError;
  const q = quoteRow ? toQuote(quoteRow) : null;
  if (!q) return new NextResponse("Not found", { status: 404 });

  const [profileRow, clientResult, linesResult] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("client")
      .select("*")
      .eq("id", q.clientId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("quote_line")
      .select("*")
      .eq("quote_id", id)
      .order("order", { ascending: true }),
  ]);
  if (clientResult.error) throw clientResult.error;
  if (linesResult.error) throw linesResult.error;
  const c = clientResult.data ? toClient(clientResult.data) : null;
  const lines = (linesResult.data ?? []).map(toQuoteLine);

  if (!profileRow || !c) {
    return new NextResponse("Profile or client missing", { status: 500 });
  }

  const buffer = await renderQuotePDFToBuffer({
    quote: q,
    lines,
    client: c,
    profile: profileRow,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.number ?? "brouillon"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
