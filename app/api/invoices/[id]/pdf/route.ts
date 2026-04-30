import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  client as clientTable,
  invoice,
  invoiceLine,
  profile,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { renderInvoicePDFToBuffer } from "@/lib/pdf-render";
import { createClient as createSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  const [inv] = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.id, id), eq(invoice.userId, user.id)))
    .limit(1);
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
  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  const [c] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, inv.clientId))
    .limit(1);
  const lines = await db
    .select()
    .from(invoiceLine)
    .where(eq(invoiceLine.invoiceId, id))
    .orderBy(invoiceLine.order);

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
