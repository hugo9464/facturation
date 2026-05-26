import type {
  ProspectionApplicationQuestion,
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

export type ProspectionApplicationQuestionView = Omit<
  ProspectionApplicationQuestion,
  "createdAt" | "updatedAt" | "generatedAt"
> & {
  generatedAt: string | null;
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
  TO_APPLY: "À postuler",
  APPLIED: "Postulé",
  FOLLOW_UP: "Relance",
  INTERVIEW: "Entretien",
  WON: "Gagné",
  LOST: "Perdu",
  ARCHIVED: "Archivé",
};

export const PROSPECTION_STATUS_ORDER: ProspectionStatus[] = [
  "TO_APPLY",
  "APPLIED",
  "ARCHIVED",
  "FOLLOW_UP",
  "INTERVIEW",
  "WON",
  "LOST",
];

export const PROSPECTION_OFFER_STATUSES = [
  "TO_APPLY",
  "APPLIED",
  "ARCHIVED",
] as const satisfies readonly ProspectionStatus[];

export const PROSPECTION_TYPE_ORDER: ProspectionType[] = [
  "OFFER",
  "MISSION",
  "COMPANY",
  "CONTACT",
];

type SupabaseSchemaError = {
  code?: string;
  details?: unknown;
  hint?: unknown;
  message?: string;
};

export function isClosedProspectionStatus(status: ProspectionStatus) {
  return status === "WON" || status === "LOST" || status === "ARCHIVED";
}

export function isProspectionApplicationQuestionsSchemaError(
  error: SupabaseSchemaError | null | undefined,
) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    (error?.code === "PGRST205" &&
      message.includes("prospection_application_question")) ||
    (error?.code === "PGRST204" &&
      (message.includes("prospection_application_question") ||
        message.includes("'order'") ||
        message.includes('"order"'))) ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

export function prospectionApplicationQuestionsUnavailableMessage() {
  return "Les questions de candidature ne sont pas encore disponibles. Applique la dernière migration Supabase, puis réessaie.";
}

export function prospectionPrimaryLine(
  entry: Pick<ProspectionEntry, "title">,
) {
  return entry.title;
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

export function serializeProspectionApplicationQuestion(
  question: ProspectionApplicationQuestion,
): ProspectionApplicationQuestionView {
  return {
    ...question,
    generatedAt: question.generatedAt?.toISOString() ?? null,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

export function sortProspectionApplicationQuestions<
  T extends Pick<
    ProspectionApplicationQuestion,
    "order" | "createdAt" | "updatedAt"
  >,
>(questions: T[]) {
  return [...questions].sort(
    (left, right) =>
      left.order - right.order ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.updatedAt.getTime() - right.updatedAt.getTime(),
  );
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
