import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { renderInvoicePDFToBuffer } from "@/lib/pdf-render";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toInvoice,
  toInvoiceLine,
} from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  const supabaseDb = await getSupabaseDb();
  const { data: invoiceRow, error: invoiceError } = await supabaseDb
    .from("invoice")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  const inv = invoiceRow ? toInvoice(invoiceRow) : null;
  if (!inv) return new NextResponse("Not found", { status: 404 });

  // For finalized invoices with stored PDF, redirect to signed URL
  if (inv.status !== "DRAFT" && inv.pdfStoragePath) {
    const supabase = await createSupabase();
    const { data, error } = await supabase.storage
      .from("invoices")
      .createSignedUrl(inv.pdfStoragePath, 60 * 60);
    if (data?.signedUrl && !error) {
      return NextResponse.redirect(data.signedUrl);
    }
  }

  // Otherwise render live (DRAFT or fallback)
  const [profileRow, clientResult, linesResult] = await Promise.all([
    getProfile(user.id),
    supabaseDb
      .from("client")
      .select("*")
      .eq("id", inv.clientId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabaseDb
      .from("invoice_line")
      .select("*")
      .eq("invoice_id", id)
      .order("order", { ascending: true }),
  ]);
  if (clientResult.error) throw clientResult.error;
  if (linesResult.error) throw linesResult.error;
  const c = clientResult.data ? toClient(clientResult.data) : null;
  const lines = (linesResult.data ?? []).map(toInvoiceLine);

  if (!profileRow || !c) {
    return new NextResponse("Profile or client missing", { status: 500 });
  }

  const buffer = await renderInvoicePDFToBuffer({
    invoice: inv,
    lines,
    client: c,
    profile: profileRow,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${inv.number ?? "brouillon"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
