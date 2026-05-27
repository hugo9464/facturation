"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getProfile,
  getSupabaseDb,
  toProspectionApplicationQuestion,
  toProspectionEntry,
  toProspectionOfferReview,
  toProspectionResume,
} from "@/lib/supabase/db";
import { prospectionTypeEnum } from "@/db/schema";
import {
  PROSPECTION_OFFER_STATUSES,
  isProspectionApplicationQuestionsSchemaError,
  isProspectionOfferReviewSchemaError,
  prospectionApplicationQuestionsUnavailableMessage,
  prospectionOfferReviewUnavailableMessage,
  serializeProspectionApplicationQuestion,
  serializeProspectionEntry,
  serializeProspectionOfferReview,
  type ProspectionApplicationQuestionView,
  type ProspectionEntryView,
  type ProspectionOfferReviewView,
} from "@/lib/prospection";
import {
  fallbackResumeMemory,
  hasResumeMemory,
  type ResumeMemory,
} from "@/lib/prospection-cv";
import {
  type CollectiveWorkProspectionAnalyzedDetail,
  type CollectiveWorkProspectionScannedDetail,
  runCollectiveWorkProspection,
} from "@/lib/collective-work-prospection";
import { createStructuredOpenAIResponse } from "@/lib/openai-responses";

const entrySchema = z.object({
  type: z.enum(prospectionTypeEnum.enumValues).optional().default("OFFER"),
  status: z.enum(PROSPECTION_OFFER_STATUSES),
  title: z.string().trim().min(1, "Nom requis").max(160, "Nom trop long"),
  sourceUrl: z
    .union([z.string().trim().url("Lien invalide"), z.literal("")])
    .optional(),
  notes: z
    .string()
    .trim()
    .max(12_000, "Contenu de l'offre trop long")
    .optional(),
});

const idSchema = z.string().uuid();
const statusSchema = z.enum(PROSPECTION_OFFER_STATUSES);
const questionTextSchema = z
  .string()
  .trim()
  .min(1, "Question requise")
  .max(1_200, "Question trop longue");
const answerTextSchema = z
  .string()
  .trim()
  .max(5_000, "Réponse trop longue")
  .optional();
const applicationQuestionInputSchema = z.object({
  entryId: idSchema,
  question: questionTextSchema,
  answer: answerTextSchema,
});
const applicationQuestionUpdateSchema = z.object({
  question: questionTextSchema,
  answer: answerTextSchema,
});

export type ProspectionEntryInput = z.input<typeof entrySchema>;

export type ProspectionActionResult =
  | { entry: ProspectionEntryView }
  | { ok: true }
  | { error: string };

export type ProspectionApplicationQuestionActionResult =
  | { question: ProspectionApplicationQuestionView }
  | { ok: true }
  | { error: string };

export type ProspectionOfferReviewActionResult =
  | { review: ProspectionOfferReviewView; entry?: ProspectionEntryView }
  | { ok: true }
  | { error: string };

export type ProspectionScanActionResult =
  | {
      ok: true;
      scanned: number;
      candidates: number;
      matched: number;
      inserted: number;
      emailed: number;
      errors: string[];
      details?: {
        scanned: CollectiveWorkProspectionScannedDetail[];
        analyzed: CollectiveWorkProspectionAnalyzedDetail[];
      };
    }
  | { error: string };

function applicationQuestionErrorResult(error: unknown) {
  return isProspectionApplicationQuestionsSchemaError(
    error as { code?: string; message?: string } | null,
  )
    ? { error: prospectionApplicationQuestionsUnavailableMessage() }
    : null;
}

function offerReviewErrorResult(error: unknown) {
  return isProspectionOfferReviewSchemaError(
    error as { code?: string; message?: string } | null,
  )
    ? { error: prospectionOfferReviewUnavailableMessage() }
    : null;
}

function optionalText(value: string | undefined) {
  return value?.trim() || null;
}

function payloadFor(userId: string, data: z.output<typeof entrySchema>) {
  return {
    user_id: userId,
    type: "OFFER" as const,
    status: data.status,
    title: data.title,
    organization: null,
    contact_name: null,
    email: null,
    phone: null,
    source_url: optionalText(data.sourceUrl),
    location: null,
    target_date: null,
    applied_at: null,
    notes: optionalText(data.notes),
  };
}

function entryPayloadForReview(userId: string, review: {
  title: string;
  organization: string | null;
  sourceUrl: string;
  location: string | null;
  notes: string | null;
}) {
  return {
    user_id: userId,
    type: "OFFER" as const,
    status: "TO_APPLY" as const,
    title: review.title,
    organization: review.organization,
    contact_name: null,
    email: null,
    phone: null,
    source_url: review.sourceUrl,
    location: review.location,
    target_date: null,
    applied_at: null,
    notes: review.notes,
  };
}

async function ensureOwnedEntry(userId: string, entryId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_entry")
    .select("*")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  return toProspectionEntry(data);
}

async function ensureOwnedOfferReview(userId: string, reviewId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_offer_review")
    .select("*")
    .eq("id", reviewId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  return toProspectionOfferReview(data);
}

async function nextApplicationQuestionOrder(userId: string, entryId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_application_question")
    .select("order")
    .eq("user_id", userId)
    .eq("entry_id", entryId)
    .order("order", { ascending: false })
    .limit(1);
  if (error) throw error;

  const current = Number(data?.[0]?.order ?? -1);
  return Number.isFinite(current) ? current + 1 : 0;
}

async function getOwnedApplicationQuestion(userId: string, id: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_application_question")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  return toProspectionApplicationQuestion(data);
}

async function getRecentResumeMemories(userId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_resume")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  return (data ?? []).map(toProspectionResume);
}

function resumeMemoryContext(
  resumes: Awaited<ReturnType<typeof getRecentResumeMemories>>,
) {
  if (resumes.length === 0) return "Aucun CV enregistré.";

  return resumes
    .map((resume, index) => {
      const memory: ResumeMemory = hasResumeMemory(resume.structuredContent)
        ? resume.structuredContent
        : fallbackResumeMemory(resume.title, resume.content);
      return `CV ${index + 1} - ${resume.title}\n${JSON.stringify(memory, null, 2)}`;
    })
    .join("\n\n---\n\n");
}

const applicationAnswerOutputSchema = z.object({
  answer: z.string().trim().min(1).max(4_000),
});

const applicationAnswerFormat = {
  type: "json_schema" as const,
  name: "prospection_application_answer",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
    },
    required: ["answer"],
  },
};

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

export async function runCollectiveWorkProspectionAction(): Promise<ProspectionScanActionResult> {
  const user = await requireUser();

  try {
    const result = await runCollectiveWorkProspection({
      userId: user.id,
      includeDetails: true,
    });
    revalidatePath("/prospection");
    return {
      ok: true,
      scanned: result.scanned,
      candidates: result.candidates,
      matched: result.matched,
      inserted: result.inserted,
      emailed: result.emailed,
      errors: result.errors,
      details: result.details,
    };
  } catch (error) {
    const reviewSchemaError = offerReviewErrorResult(error);
    if (reviewSchemaError) return reviewSchemaError;
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de scanner Collective.work",
    };
  }
}

export async function importProspectionOfferReviewAction(
  id: string,
): Promise<ProspectionOfferReviewActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  try {
    const review = await ensureOwnedOfferReview(user.id, parsedId.data);
    if (review.status === "ARCHIVED") {
      return { error: "Cette offre est archivée." };
    }

    const supabase = await getSupabaseDb();
    const { data: existingEntries, error: existingError } = await supabase
      .from("prospection_entry")
      .select("*")
      .eq("user_id", user.id)
      .eq("source_url", review.sourceUrl)
      .limit(1);
    if (existingError) throw existingError;

    const entry = existingEntries?.[0]
      ? toProspectionEntry(existingEntries[0])
      : await (async () => {
          const { data, error } = await supabase
            .from("prospection_entry")
            .insert(entryPayloadForReview(user.id, review))
            .select("*")
            .single();
          if (error) throw error;
          return toProspectionEntry(data);
        })();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("prospection_offer_review")
      .update({
        status: "IMPORTED",
        entry_id: entry.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", review.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;

    revalidatePath("/prospection");
    return {
      review: serializeProspectionOfferReview(toProspectionOfferReview(data)),
      entry: serializeProspectionEntry(entry),
    };
  } catch (error) {
    const schemaError = offerReviewErrorResult(error);
    if (schemaError) return schemaError;
    throw error;
  }
}

export async function archiveProspectionOfferReviewAction(
  id: string,
): Promise<ProspectionOfferReviewActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  try {
    await ensureOwnedOfferReview(user.id, parsedId.data);
    const now = new Date().toISOString();
    const supabase = await getSupabaseDb();
    const { data, error } = await supabase
      .from("prospection_offer_review")
      .update({
        status: "ARCHIVED",
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", parsedId.data)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;

    revalidatePath("/prospection");
    return {
      review: serializeProspectionOfferReview(toProspectionOfferReview(data)),
    };
  } catch (error) {
    const schemaError = offerReviewErrorResult(error);
    if (schemaError) return schemaError;
    throw error;
  }
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

export async function updateProspectionEntryStatusAction(
  id: string,
  status: unknown,
): Promise<ProspectionActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Statut invalide" };

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_entry")
    .update({
      status: parsedStatus.data,
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

export async function createProspectionApplicationQuestionAction(
  input: unknown,
): Promise<ProspectionApplicationQuestionActionResult> {
  const user = await requireUser();
  const parsed = applicationQuestionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    await ensureOwnedEntry(user.id, parsed.data.entryId);
    const order = await nextApplicationQuestionOrder(
      user.id,
      parsed.data.entryId,
    );
    const supabase = await getSupabaseDb();
    const { data, error } = await supabase
      .from("prospection_application_question")
      .insert({
        user_id: user.id,
        entry_id: parsed.data.entryId,
        question: parsed.data.question,
        answer: optionalText(parsed.data.answer) ?? "",
        order,
      })
      .select("*")
      .single();
    if (error) throw error;

    revalidatePath("/prospection");
    return {
      question: serializeProspectionApplicationQuestion(
        toProspectionApplicationQuestion(data),
      ),
    };
  } catch (error) {
    const schemaError = applicationQuestionErrorResult(error);
    if (schemaError) return schemaError;
    throw error;
  }
}

export async function updateProspectionApplicationQuestionAction(
  id: string,
  input: unknown,
): Promise<ProspectionApplicationQuestionActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  const parsed = applicationQuestionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const existing = await getOwnedApplicationQuestion(user.id, parsedId.data);
    await ensureOwnedEntry(user.id, existing.entryId);

    const supabase = await getSupabaseDb();
    const { data, error } = await supabase
      .from("prospection_application_question")
      .update({
        question: parsed.data.question,
        answer: optionalText(parsed.data.answer) ?? "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsedId.data)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;

    revalidatePath("/prospection");
    return {
      question: serializeProspectionApplicationQuestion(
        toProspectionApplicationQuestion(data),
      ),
    };
  } catch (error) {
    const schemaError = applicationQuestionErrorResult(error);
    if (schemaError) return schemaError;
    throw error;
  }
}

export async function deleteProspectionApplicationQuestionAction(
  id: string,
): Promise<ProspectionApplicationQuestionActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  try {
    const supabase = await getSupabaseDb();
    const { error } = await supabase
      .from("prospection_application_question")
      .delete()
      .eq("id", parsedId.data)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/prospection");
    return { ok: true };
  } catch (error) {
    const schemaError = applicationQuestionErrorResult(error);
    if (schemaError) return schemaError;
    throw error;
  }
}

export async function generateProspectionApplicationAnswerAction(
  id: string,
  input: unknown,
): Promise<ProspectionApplicationQuestionActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  const parsed = applicationQuestionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const existing = await getOwnedApplicationQuestion(user.id, parsedId.data);
    const [entry, profile, resumes] = await Promise.all([
      ensureOwnedEntry(user.id, existing.entryId),
      getProfile(user.id),
      getRecentResumeMemories(user.id),
    ]);
    const profileContext = profile
      ? `Profil app: ${profile.businessName}, ${profile.email}, ${profile.phone ?? ""}, ${profile.address}`
      : "Profil app absent.";

    const response = await createStructuredOpenAIResponse<unknown>({
      system:
        "Tu aides un freelance français à répondre à une question de candidature. Réponds en français, à la première personne, de façon concrète, honnête, concise et prête à copier. N'invente pas d'expérience, d'employeur, de diplôme ni de métrique. Pas de markdown.",
      user: `Offre: ${entry.title}\n\nContenu de l'offre:\n${entry.notes ?? "Non renseigné"}\n\n${profileContext}\n\nCV disponibles:\n${resumeMemoryContext(resumes)}\n\nQuestion de candidature:\n${parsed.data.question}\n\nBrouillon actuel éventuel:\n${parsed.data.answer ?? ""}`,
      format: applicationAnswerFormat,
    });
    const generated = applicationAnswerOutputSchema.parse(response.data);
    const supabase = await getSupabaseDb();
    const { data, error } = await supabase
      .from("prospection_application_question")
      .update({
        question: parsed.data.question,
        answer: generated.answer,
        model: response.model,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsedId.data)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;

    revalidatePath("/prospection");
    return {
      question: serializeProspectionApplicationQuestion(
        toProspectionApplicationQuestion(data),
      ),
    };
  } catch (error) {
    const schemaError = applicationQuestionErrorResult(error);
    if (schemaError) return schemaError;
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de générer la réponse",
    };
  }
}
