import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  client as clientTable,
  profile,
  quote,
  quoteLine,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { renderQuotePDFToBuffer } from "@/lib/pdf-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  const [q] = await db
    .select()
    .from(quote)
    .where(and(eq(quote.id, id), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) return new NextResponse("Not found", { status: 404 });

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  const [c] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, q.clientId))
    .limit(1);
  const lines = await db
    .select()
    .from(quoteLine)
    .where(eq(quoteLine.quoteId, id))
    .orderBy(quoteLine.order);

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
