"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseDb } from "@/lib/supabase/db";

const profileSchema = z.object({
  business_name: z.string().min(1, "Nom requis"),
  siret: z
    .string()
    .min(14, "SIRET = 14 chiffres")
    .max(17, "SIRET trop long")
    .regex(/^[\d ]+$/, "Chiffres uniquement"),
  address: z.string().min(1, "Adresse requise"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  default_payment_terms_days: z.coerce.number().int().min(0).max(365),
  plafond_type: z.enum(["BNC", "BIC"]),
  legal_mention_extra: z.string().optional(),
  rcs_exempt: z.coerce.boolean().optional(),
});

export async function upsertProfileAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const raw = Object.fromEntries(formData.entries());
  const parsed = profileSchema.safeParse({
    ...raw,
    rcs_exempt: formData.get("rcs_exempt") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const data = parsed.data;
  const supabase = await getSupabaseDb();
  const { data: existing, error: existingError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await supabase.from("profile").insert({
      user_id: user.id,
      business_name: data.business_name,
      siret: data.siret.replace(/\s/g, ""),
      address: data.address,
      email: data.email,
      phone: data.phone || null,
      iban: data.iban || null,
      bic: data.bic || null,
      default_payment_terms_days: data.default_payment_terms_days,
      plafond_type: data.plafond_type,
      legal_mention_extra: data.legal_mention_extra || null,
      rcs_exempt: data.rcs_exempt ?? true,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("profile")
      .update({
        business_name: data.business_name,
        siret: data.siret.replace(/\s/g, ""),
        address: data.address,
        email: data.email,
        phone: data.phone || null,
        iban: data.iban || null,
        bic: data.bic || null,
        default_payment_terms_days: data.default_payment_terms_days,
        plafond_type: data.plafond_type,
        legal_mention_extra: data.legal_mention_extra || null,
        rcs_exempt: data.rcs_exempt ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (error) throw error;
  }
  revalidatePath("/", "layout");
  if (!existing) {
    redirect("/");
  }
  return { success: "Paramètres enregistrés." };
}
