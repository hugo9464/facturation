"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { eurosToCents } from "@/lib/money";
import { getSupabaseDb } from "@/lib/supabase/db";

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
  const supabase = await getSupabaseDb();
  const { data: row, error } = await supabase
    .from("client")
    .insert({
      user_id: user.id,
      name: data.name,
      contact_name: data.contact_name || null,
      email: data.email || null,
      address: data.address || null,
      siret: data.siret || null,
      vat_number: data.vat_number || null,
      default_rate_cents: eurosToCents(data.default_rate),
      default_rate_type: data.default_rate_type,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) throw error;
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
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("client")
    .update({
      name: data.name,
      contact_name: data.contact_name || null,
      email: data.email || null,
      address: data.address || null,
      siret: data.siret || null,
      vat_number: data.vat_number || null,
      default_rate_cents: eurosToCents(data.default_rate),
      default_rate_type: data.default_rate_type,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: "Client mis à jour." };
}

export async function archiveClientAction(
  id: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("client")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/clients");
  return {};
}

export async function unarchiveClientAction(
  id: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("client")
    .update({ archived: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/clients");
  return {};
}
