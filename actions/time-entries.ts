"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { client, timeEntry } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

const createSchema = z.object({
  client_id: z.string().uuid(),
  date: z.string(),
  type: z.enum(["DAY", "HALF_DAY", "HOUR", "FORFAIT"]),
  quantity: z.coerce.number().positive(),
  rate_cents: z.coerce.number().int().nonnegative(),
  description: z.string().optional(),
});

export async function createTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const data = parsed.data;
  // Verify client ownership
  const [c] = await db
    .select({ id: client.id })
    .from(client)
    .where(and(eq(client.id, data.client_id), eq(client.userId, user.id)))
    .limit(1);
  if (!c) return { error: "Client introuvable" };

  await db.insert(timeEntry).values({
    userId: user.id,
    clientId: data.client_id,
    date: data.date,
    type: data.type,
    quantity: data.quantity.toString(),
    rateCents: data.rate_cents,
    description: data.description?.trim() || null,
  });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteTimeEntryAction(id: string) {
  const user = await requireUser();
  const [entry] = await db
    .select({ id: timeEntry.id, invoiceId: timeEntry.invoiceId })
    .from(timeEntry)
    .where(and(eq(timeEntry.id, id), eq(timeEntry.userId, user.id)))
    .limit(1);
  if (!entry) return { error: "Saisie introuvable" };
  if (entry.invoiceId) {
    return { error: "Saisie déjà facturée — annule la facture d'abord." };
  }
  await db.delete(timeEntry).where(eq(timeEntry.id, id));
  revalidatePath("/", "layout");
  return { success: true };
}
