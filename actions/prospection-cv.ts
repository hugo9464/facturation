"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getProfile,
  getSupabaseDb,
  toProspectionCvGeneration,
  toProspectionResume,
} from "@/lib/supabase/db";
import {
  cvGenerationTitle,
  serializeProspectionCvGeneration,
  serializeProspectionResume,
  type CvAnswer,
  type CvQuestion,
  type ProspectionCvGenerationView,
  type ProspectionResumeView,
} from "@/lib/prospection-cv";
import { createStructuredOpenAIResponse } from "@/lib/openai-responses";

const photoSchema = z
  .union([
    z
      .string()
      .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/i, "Photo invalide")
      .max(650_000, "Photo trop lourde"),
    z.literal(""),
  ])
  .optional();

const resumeSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(160, "Titre trop long"),
  content: z
    .string()
    .trim()
    .min(100, "Colle au moins le contenu principal du CV")
    .max(35_000, "CV trop long"),
  photoDataUrl: photoSchema,
  notes: z.string().trim().max(2_000, "Notes trop longues").optional(),
});

const idSchema = z.string().uuid();

const questionInputSchema = z.object({
  offerDescription: z
    .string()
    .trim()
    .min(80, "Descriptif d'offre trop court")
    .max(25_000, "Descriptif d'offre trop long"),
  resumeIds: z.array(idSchema).min(1, "Sélectionne au moins un CV").max(5),
});

const answerSchema = z.object({
  question: z.string().trim().min(1).max(600),
  answer: z.string().trim().max(2_000),
});

const generationInputSchema = questionInputSchema.extend({
  title: z.string().trim().max(160).optional(),
  questions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        question: z.string().trim().min(1).max(600),
      }),
    )
    .max(5),
  answers: z.array(answerSchema).max(5),
});

const questionsOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        question: z.string().trim().min(1).max(600),
      }),
    )
    .min(2)
    .max(5),
});

const generatedCvSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  headline: z.string().trim().min(1).max(180),
  location: z.string().trim().max(120),
  email: z.string().trim().max(160),
  phone: z.string().trim().max(80),
  summary: z.string().trim().min(1).max(1_200),
  skills: z.array(z.string().trim().min(1).max(80)).min(6).max(18),
  experiences: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(140),
        organization: z.string().trim().max(140),
        period: z.string().trim().max(80),
        location: z.string().trim().max(120),
        bullets: z.array(z.string().trim().min(1).max(220)).min(2).max(5),
      }),
    )
    .min(1)
    .max(6),
  education: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        organization: z.string().trim().max(160),
        period: z.string().trim().max(80),
      }),
    )
    .max(5),
  certifications: z.array(z.string().trim().min(1).max(140)).max(8),
  languages: z.array(z.string().trim().min(1).max(80)).max(8),
});

export type ProspectionResumeActionResult =
  | { resume: ProspectionResumeView }
  | { ok: true }
  | { error: string };

export type CvQuestionsActionResult =
  | { questions: CvQuestion[] }
  | { error: string };

export type CvGenerationActionResult =
  | { generation: ProspectionCvGenerationView }
  | { error: string };

function optionalText(value: string | undefined) {
  return value?.trim() || null;
}

async function getOwnedResumes(userId: string, resumeIds: string[]) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_resume")
    .select("*")
    .eq("user_id", userId)
    .in("id", resumeIds);
  if (error) throw error;

  return (data ?? []).map(toProspectionResume);
}

function resumeContext(resumes: Awaited<ReturnType<typeof getOwnedResumes>>) {
  return resumes
    .map(
      (resume, index) =>
        `CV ${index + 1} - ${resume.title}\nNotes: ${resume.notes ?? "Aucune"}\nContenu:\n${resume.content}`,
    )
    .join("\n\n---\n\n");
}

const questionsFormat = {
  type: "json_schema" as const,
  name: "cv_refinement_questions",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      questions: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            question: { type: "string" },
          },
          required: ["id", "question"],
        },
      },
    },
    required: ["questions"],
  },
};

const generatedCvFormat = {
  type: "json_schema" as const,
  name: "tailored_cv",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      fullName: { type: "string" },
      headline: { type: "string" },
      location: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      summary: { type: "string" },
      skills: { type: "array", items: { type: "string" } },
      experiences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: { type: "string" },
            organization: { type: "string" },
            period: { type: "string" },
            location: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["role", "organization", "period", "location", "bullets"],
        },
      },
      education: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            organization: { type: "string" },
            period: { type: "string" },
          },
          required: ["label", "organization", "period"],
        },
      },
      certifications: { type: "array", items: { type: "string" } },
      languages: { type: "array", items: { type: "string" } },
    },
    required: [
      "fullName",
      "headline",
      "location",
      "email",
      "phone",
      "summary",
      "skills",
      "experiences",
      "education",
      "certifications",
      "languages",
    ],
  },
};

export async function createProspectionResumeAction(
  input: unknown,
): Promise<ProspectionResumeActionResult> {
  const user = await requireUser();
  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_resume")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      photo_data_url: optionalText(parsed.data.photoDataUrl),
      notes: optionalText(parsed.data.notes),
    })
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/prospection");
  return { resume: serializeProspectionResume(toProspectionResume(data)) };
}

export async function deleteProspectionResumeAction(
  id: string,
): Promise<ProspectionResumeActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Identifiant invalide" };

  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("prospection_resume")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/prospection");
  return { ok: true };
}

export async function askCvRefinementQuestionsAction(
  input: unknown,
): Promise<CvQuestionsActionResult> {
  const user = await requireUser();
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const resumes = await getOwnedResumes(user.id, parsed.data.resumeIds);
  if (resumes.length !== parsed.data.resumeIds.length) {
    return { error: "Un des CV sélectionnés est introuvable" };
  }

  try {
    const response = await createStructuredOpenAIResponse<unknown>({
      system:
        "Tu aides un freelance français à adapter son CV à une offre. Pose uniquement les questions nécessaires pour lever les incertitudes qui changeraient vraiment le CV. Réponds en français.",
      user: `Offre ou mission:\n${parsed.data.offerDescription}\n\nCV disponibles:\n${resumeContext(resumes)}`,
      format: questionsFormat,
    });
    const questions = questionsOutputSchema.parse(response.data).questions;
    return { questions };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de générer les questions",
    };
  }
}

export async function generateTailoredCvAction(
  input: unknown,
): Promise<CvGenerationActionResult> {
  const user = await requireUser();
  const parsed = generationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const [resumes, profile] = await Promise.all([
    getOwnedResumes(user.id, parsed.data.resumeIds),
    getProfile(user.id),
  ]);
  if (resumes.length !== parsed.data.resumeIds.length) {
    return { error: "Un des CV sélectionnés est introuvable" };
  }

  const answers = parsed.data.answers.filter((answer) => answer.answer.trim());
  const photoDataUrl =
    resumes.find((resume) => resume.photoDataUrl)?.photoDataUrl ?? null;
  const profileContext = profile
    ? `Profil app: ${profile.businessName}, ${profile.email}, ${profile.phone ?? ""}, ${profile.address}`
    : "Profil app absent.";

  try {
    const response = await createStructuredOpenAIResponse<unknown>({
      system:
        "Tu es un expert CV senior. Génère un CV français clair, honnête et ciblé pour maximiser l'adéquation avec l'offre. Ne fabrique pas d'employeurs, de diplômes ni de dates. Reformule et priorise les expériences issues des CV fournis. Évite les formules creuses.",
      user: `Contexte candidat:\n${profileContext}\n\nOffre ou mission:\n${parsed.data.offerDescription}\n\nCV sources:\n${resumeContext(resumes)}\n\nQuestions posées et réponses:\n${formatAnswers(parsed.data.questions, answers)}`,
      format: generatedCvFormat,
    });
    const generatedCv = generatedCvSchema.parse(response.data);
    const supabase = await getSupabaseDb();
    const { data, error } = await supabase
      .from("prospection_cv_generation")
      .insert({
        user_id: user.id,
        title:
          parsed.data.title?.trim() ||
          cvGenerationTitle(parsed.data.offerDescription),
        offer_description: parsed.data.offerDescription,
        resume_ids: parsed.data.resumeIds,
        questions: parsed.data.questions,
        answers,
        generated_cv: generatedCv,
        photo_data_url: photoDataUrl,
        model: response.model,
      })
      .select("*")
      .single();
    if (error) throw error;

    revalidatePath("/prospection");
    return {
      generation: serializeProspectionCvGeneration(
        toProspectionCvGeneration(data),
      ),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Impossible de générer le CV",
    };
  }
}

function formatAnswers(questions: CvQuestion[], answers: CvAnswer[]) {
  if (questions.length === 0) return "Aucune question posée.";
  return questions
    .map((question) => {
      const answer = answers.find(
        (candidate) => candidate.question === question.question,
      );
      return `- ${question.question}\n  Réponse: ${answer?.answer || "Non renseigné"}`;
    })
    .join("\n");
}
