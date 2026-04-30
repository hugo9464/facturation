import type { Profile } from "@/db/schema";

export const TVA_FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";

export const RECOVERY_FEE_MENTION =
  "En cas de retard de paiement, des pénalités au taux de 3 fois le taux d'intérêt légal en vigueur seront appliquées, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).";

export const NO_DISCOUNT_MENTION = "Pas d'escompte pour paiement anticipé.";

export const RCS_EXEMPTION_MENTION =
  "Dispensé d'immatriculation au RCS et au RM.";

export function buildLegalMention(profile: Profile): string {
  const parts = [
    TVA_FRANCHISE_MENTION,
    RECOVERY_FEE_MENTION,
    NO_DISCOUNT_MENTION,
  ];
  if (profile.rcsExempt) parts.push(RCS_EXEMPTION_MENTION);
  if (profile.legalMentionExtra?.trim()) parts.push(profile.legalMentionExtra.trim());
  return parts.join("\n");
}

export function buildPaymentTermsText(profile: Profile): string {
  const days = profile.defaultPaymentTermsDays;
  return `Règlement à ${days} jours par virement bancaire.`;
}

export const PLAFOND_LIMITS = {
  BNC: 77_700_00,
  BIC: 188_700_00,
} as const;

export function plafondLimitCents(type: "BNC" | "BIC"): number {
  return PLAFOND_LIMITS[type];
}
