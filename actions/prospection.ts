"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getSupabaseDb, toProspectionEntry } from "@/lib/supabase/db";
import {
  prospectionStatusEnum,
  prospectionTypeEnum,
} from "@/db/schema";
import {
  serializeProspectionEntry,
  type ProspectionEntryView,
} from "@/lib/prospection";

const entrySchema = z.object({
  type: z.enum(prospectionTypeEnum.enumValues),
  status: z.enum(prospectionStatusEnum.enumValues),
  title: z.string().trim().min(1, "Titre requis").max(160, "Titre trop long"),
  organization: z
    .string()
    .trim()
    .max(160, "Organisation trop longue")
    .optional(),
  contactName: z.string().trim().max(160, "Contact trop long").optional(),
  email: z
    .union([z.string().trim().email("Email invalide"), z.literal("")])
    .optional(),
  phone: z.string().trim().max(40, "Téléphone trop long").optional(),
  sourceUrl: z
    .union([z.string().trim().url("Lien invalide"), z.literal("")])
    .optional(),
  location: z.string().trim().max(120, "Lieu trop long").optional(),
  targetDate: z.union([z.string().date(), z.literal("")]).optional(),
  appliedAt: z.union([z.string().date(), z.literal("")]).optional(),
  notes: z.string().trim().max(4_000, "Notes trop longues").optional(),
});

const idSchema = z.string().uuid();

export type ProspectionEntryInput = z.input<typeof entrySchema>;

export type ProspectionActionResult =
  | { entry: ProspectionEntryView }
  | { ok: true }
  | { error: string };

function optionalText(value: string | undefined) {
  return value?.trim() || null;
}

function payloadFor(userId: string, data: z.output<typeof entrySchema>) {
  return {
    user_id: userId,
    type: data.type,
    status: data.status,
    title: data.title,
    organization: optionalText(data.organization),
    contact_name: optionalText(data.contactName),
    email: optionalText(data.email),
    phone: optionalText(data.phone),
    source_url: optionalText(data.sourceUrl),
    location: optionalText(data.location),
    target_date: data.targetDate || null,
    applied_at: data.appliedAt || null,
    notes: optionalText(data.notes),
  };
}

export async function createProspectionEntryAction(
  input: unknown,
): Promise<ProspectionActionResult> {
  const user = await requireUser();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_entry")
    .insert(payloadFor(user.id, parsed.data))
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/prospection");
  return { entry: serializeProspectionEntry(toProspectionEntry(data)) };
}

export async function updateProspectionEntryAction(
  id: string,
  input: unknown,
): Promise<ProspectionActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_entry")
    .update({
      ...payloadFor(user.id, parsed.data),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/prospection");
  return { entry: serializeProspectionEntry(toProspectionEntry(data)) };
}

export async function deleteProspectionEntryAction(
  id: string,
): Promise<ProspectionActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("prospection_entry")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/prospection");
  return { ok: true };
}
