import type {
  ProspectionEntry,
  ProspectionStatus,
  ProspectionType,
} from "@/db/schema";

export type ProspectionEntryView = Omit<
  ProspectionEntry,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export const PROSPECTION_TYPE_LABELS: Record<ProspectionType, string> = {
  OFFER: "Offre",
  MISSION: "Mission",
  COMPANY: "Entreprise",
  CONTACT: "Contact",
};

export const PROSPECTION_STATUS_LABELS: Record<ProspectionStatus, string> = {
  TO_APPLY: "À candidater",
  APPLIED: "Candidaté",
  FOLLOW_UP: "Relance",
  INTERVIEW: "Entretien",
  WON: "Gagné",
  LOST: "Perdu",
  ARCHIVED: "Archivé",
};

export const PROSPECTION_STATUS_ORDER: ProspectionStatus[] = [
  "TO_APPLY",
  "APPLIED",
  "FOLLOW_UP",
  "INTERVIEW",
  "WON",
  "LOST",
  "ARCHIVED",
];

export const PROSPECTION_TYPE_ORDER: ProspectionType[] = [
  "OFFER",
  "MISSION",
  "COMPANY",
  "CONTACT",
];

export function isClosedProspectionStatus(status: ProspectionStatus) {
  return status === "WON" || status === "LOST" || status === "ARCHIVED";
}

export function prospectionPrimaryLine(
  entry: Pick<ProspectionEntry, "title" | "organization">,
) {
  return entry.organization
    ? `${entry.title} · ${entry.organization}`
    : entry.title;
}

export function serializeProspectionEntry(
  entry: ProspectionEntry,
): ProspectionEntryView {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function sortProspectionEntries<
  T extends Pick<
    ProspectionEntry,
    "status" | "type" | "updatedAt" | "createdAt"
  >,
>(
  entries: T[],
) {
  return [...entries].sort((left, right) => {
    const statusDelta =
      PROSPECTION_STATUS_ORDER.indexOf(left.status) -
      PROSPECTION_STATUS_ORDER.indexOf(right.status);
    if (statusDelta !== 0) return statusDelta;

    const typeDelta =
      PROSPECTION_TYPE_ORDER.indexOf(left.type) -
      PROSPECTION_TYPE_ORDER.indexOf(right.type);
    if (typeDelta !== 0) return typeDelta;

    return (
      right.updatedAt.getTime() - left.updatedAt.getTime() ||
      right.createdAt.getTime() - left.createdAt.getTime()
    );
  });
}
