"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

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
  const existing = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(profile).values({
      userId: user.id,
      businessName: data.business_name,
      siret: data.siret.replace(/\s/g, ""),
      address: data.address,
      email: data.email,
      phone: data.phone || null,
      iban: data.iban || null,
      bic: data.bic || null,
      defaultPaymentTermsDays: data.default_payment_terms_days,
      plafondType: data.plafond_type,
      legalMentionExtra: data.legal_mention_extra || null,
      rcsExempt: data.rcs_exempt ?? true,
    });
  } else {
    await db
      .update(profile)
      .set({
        businessName: data.business_name,
        siret: data.siret.replace(/\s/g, ""),
        address: data.address,
        email: data.email,
        phone: data.phone || null,
        iban: data.iban || null,
        bic: data.bic || null,
        defaultPaymentTermsDays: data.default_payment_terms_days,
        plafondType: data.plafond_type,
        legalMentionExtra: data.legal_mention_extra || null,
        rcsExempt: data.rcs_exempt ?? true,
        updatedAt: new Date(),
      })
      .where(eq(profile.userId, user.id));
  }
  revalidatePath("/", "layout");
  if (existing.length === 0) {
    redirect("/");
  }
  return { success: "Paramètres enregistrés." };
}
