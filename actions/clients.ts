"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { client } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { eurosToCents } from "@/lib/money";

const baseSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  contact_name: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  address: z.string().optional(),
  siret: z.string().optional(),
  vat_number: z.string().optional(),
  default_rate: z.string().min(1, "Tarif requis"),
  default_rate_type: z.enum(["DAY", "HALF_DAY", "HOUR", "FORFAIT"]),
  notes: z.string().optional(),
});

function parseClient(formData: FormData) {
  return baseSchema.safeParse(Object.fromEntries(formData.entries()));
}

export async function createClientAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const parsed = parseClient(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const data = parsed.data;
  const [row] = await db
    .insert(client)
    .values({
      userId: user.id,
      name: data.name,
      contactName: data.contact_name || null,
      email: data.email || null,
      address: data.address || null,
      siret: data.siret || null,
      vatNumber: data.vat_number || null,
      defaultRateCents: eurosToCents(data.default_rate),
      defaultRateType: data.default_rate_type,
      notes: data.notes || null,
    })
    .returning({ id: client.id });
  revalidatePath("/clients");
  redirect(`/clients/${row.id}`);
}

export async function updateClientAction(id: string, formData: FormData) {
  const user = await requireUser();
  const parsed = parseClient(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const data = parsed.data;
  await db
    .update(client)
    .set({
      name: data.name,
      contactName: data.contact_name || null,
      email: data.email || null,
      address: data.address || null,
      siret: data.siret || null,
      vatNumber: data.vat_number || null,
      defaultRateCents: eurosToCents(data.default_rate),
      defaultRateType: data.default_rate_type,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(client.id, id), eq(client.userId, user.id)));
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: "Client mis à jour." };
}

export async function archiveClientAction(
  id: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  await db
    .update(client)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(client.id, id), eq(client.userId, user.id)));
  revalidatePath("/clients");
  return {};
}

export async function unarchiveClientAction(
  id: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  await db
    .update(client)
    .set({ archived: false, updatedAt: new Date() })
    .where(and(eq(client.id, id), eq(client.userId, user.id)));
  revalidatePath("/clients");
  return {};
}
