import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function allocateInvoiceNumber(
  userId: string,
  issueDate: Date,
): Promise<string> {
  const year = issueDate.getFullYear();
  const [row] = await db
    .update(profile)
    .set({
      nextInvoiceNumber: sql`${profile.nextInvoiceNumber} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, userId))
    .returning({ next: profile.nextInvoiceNumber });
  if (!row) throw new Error("Profile not found — set up settings first");
  const seq = row.next - 1;
  return `${year}-${String(seq).padStart(3, "0")}`;
}

export async function allocateQuoteNumber(
  userId: string,
  issueDate: Date,
): Promise<string> {
  const year = issueDate.getFullYear();
  const [row] = await db
    .update(profile)
    .set({
      nextQuoteNumber: sql`${profile.nextQuoteNumber} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, userId))
    .returning({ next: profile.nextQuoteNumber });
  if (!row) throw new Error("Profile not found");
  const seq = row.next - 1;
  return `D${year}-${String(seq).padStart(3, "0")}`;
}
