"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSupabaseDb } from "@/lib/supabase/db";

const createSchema = z.object({
  project_id: z.string().uuid(),
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
  const supabase = await getSupabaseDb();
  const { data: project, error: projectError } = await supabase
    .from("todo_project")
    .select("id, client_id")
    .eq("id", data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return { error: "Projet introuvable" };
  if (!project.client_id) {
    return { error: "Associe ce projet à un client avant de logger du temps." };
  }

  const { error } = await supabase.from("time_entry").insert({
    user_id: user.id,
    client_id: project.client_id,
    project_id: data.project_id,
    date: data.date,
    type: data.type,
    quantity: data.quantity.toString(),
    rate_cents: data.rate_cents,
    description: data.description?.trim() || null,
  });
  if (error) throw error;
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateTimeEntryAction(id: string, formData: FormData) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const data = parsed.data;
  const supabase = await getSupabaseDb();

  const { data: existing, error: existingError } = await supabase
    .from("time_entry")
    .select("id, invoice_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return { error: "Saisie introuvable" };
  if (existing.invoice_id) {
    return { error: "Saisie déjà facturée — modification impossible." };
  }

  const { data: project, error: projectError } = await supabase
    .from("todo_project")
    .select("id, client_id")
    .eq("id", data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return { error: "Projet introuvable" };
  if (!project.client_id) {
    return { error: "Associe ce projet à un client avant de logger du temps." };
  }

  const { error } = await supabase
    .from("time_entry")
    .update({
      client_id: project.client_id,
      project_id: data.project_id,
      date: data.date,
      type: data.type,
      quantity: data.quantity.toString(),
      rate_cents: data.rate_cents,
      description: data.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteTimeEntryAction(id: string) {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data: entry, error: entryError } = await supabase
    .from("time_entry")
    .select("id, invoice_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (entryError) throw entryError;
  if (!entry) return { error: "Saisie introuvable" };
  if (entry.invoice_id) {
    return { error: "Saisie déjà facturée — annule la facture d'abord." };
  }
  const { error } = await supabase
    .from("time_entry")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/", "layout");
  return { success: true };
}
