import type { Client, Profile } from "@/db/schema";

export type MissingField = {
  field: string;
  label: string;
};

export function getProfileMissingFields(
  profile: Profile | null | undefined,
): MissingField[] {
  if (!profile) {
    return [{ field: "profile", label: "Paramètres d'entreprise non renseignés" }];
  }
  const missing: MissingField[] = [];
  if (!profile.businessName?.trim())
    missing.push({ field: "businessName", label: "Nom commercial" });
  if (!profile.siret?.trim() || profile.siret.replace(/\s/g, "").length !== 14)
    missing.push({ field: "siret", label: "SIRET (14 chiffres)" });
  if (!profile.address?.trim())
    missing.push({ field: "address", label: "Adresse" });
  if (!profile.email?.trim())
    missing.push({ field: "email", label: "Email" });
  if (!profile.iban?.trim())
    missing.push({ field: "iban", label: "IBAN" });
  return missing;
}

export function getClientMissingFields(client: Client): MissingField[] {
  const missing: MissingField[] = [];
  if (!client.name?.trim())
    missing.push({ field: "name", label: "Nom du client" });
  if (!client.address?.trim())
    missing.push({ field: "address", label: "Adresse du client" });
  if (client.defaultRateCents <= 0)
    missing.push({ field: "defaultRate", label: "Tarif par défaut > 0" });
  return missing;
}

export function isProfileBillable(profile: Profile | null | undefined): boolean {
  return getProfileMissingFields(profile).length === 0;
}

export function isClientBillable(client: Client): boolean {
  return getClientMissingFields(client).length === 0;
}

export function formatMissingFieldsError(input: {
  profileMissing: MissingField[];
  clientMissing: MissingField[];
  clientName?: string;
}): string {
  const parts: string[] = [];
  if (input.profileMissing.length > 0) {
    parts.push(
      `Tes paramètres : ${input.profileMissing.map((m) => m.label).join(", ")}`,
    );
  }
  if (input.clientMissing.length > 0) {
    parts.push(
      `Client${input.clientName ? ` « ${input.clientName} »` : ""} : ${input.clientMissing
        .map((m) => m.label)
        .join(", ")}`,
    );
  }
  return `Informations manquantes — ${parts.join(" · ")}`;
}
