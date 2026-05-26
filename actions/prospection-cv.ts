"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getProfile,
  getSupabaseDb,
  toProspectionCvGeneration,
  toProspectionCvProfile,
  toProspectionResume,
} from "@/lib/supabase/db";
import {
  cvGenerationTitle,
  fallbackResumeMemory,
  hasResumeMemory,
  normalizeTailoredCvSkills,
  serializeProspectionCvGeneration,
  serializeProspectionCvProfile,
  serializeProspectionResume,
  type CvAnswer,
  type CvQuestion,
  type ProspectionCvGenerationView,
  type ProspectionCvProfileView,
  type ProspectionResumeView,
  type TailoredCv,
  type ResumeMemory,
} from "@/lib/prospection-cv";
import { createStructuredOpenAIResponse } from "@/lib/openai-responses";
import { PdfTextExtractionError, extractPdfText } from "@/lib/pdf-text";

const MAX_RESUME_PDF_BYTES = 5 * 1024 * 1024;

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
  pdfFile: z.instanceof(File).optional(),
});

const storedResumeSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(160, "Titre trop long"),
  content: z
    .string()
    .trim()
    .min(100, "Le PDF ne contient pas assez de texte exploitable")
    .max(35_000, "CV trop long"),
  sourceFileName: z.string().trim().max(240).optional(),
});

type PreparedResumeInput =
  | {
      data: z.output<typeof storedResumeSchema>;
      structuredContent: ResumeMemory;
    }
  | { error: string };

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

const generatedSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  level: z.coerce.number().int().min(1).max(5),
});

const generationInputSchema = questionInputSchema.extend({
  title: z.string().trim().max(160).optional(),
  questions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        question: z.string().trim().min(1).max(600),
        type: z.enum(["yes_no", "single_choice"]),
        options: z.array(z.string().trim().min(1).max(140)).min(2).max(6),
      }),
    )
    .max(10),
  answers: z.array(answerSchema).max(10),
});

const questionsOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        question: z.string().trim().min(1).max(600),
        type: z.enum(["yes_no", "single_choice"]),
        options: z.array(z.string().trim().min(1).max(140)).min(2).max(6),
      }),
    )
    .min(1)
    .max(10),
});

const generatedCvSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  headline: z.string().trim().min(1).max(180),
  location: z.string().trim().max(120),
  email: z.string().trim().max(160),
  phone: z.string().trim().max(80),
  summary: z.string().trim().min(1).max(1_200),
  skills: z.array(generatedSkillSchema).min(5).max(8),
  experiences: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(140),
        organization: z.string().trim().max(140),
        period: z.string().trim().max(80),
        location: z.string().trim().max(120),
        bullets: z.array(z.string().trim().min(1).max(220)).min(2).max(4),
      }),
    )
    .min(1)
    .max(5),
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

const generationSaveInputSchema = generationInputSchema.extend({
  generatedCv: generatedCvSchema,
  model: z.string().trim().min(1).max(120).optional(),
});

const resumeMemorySchema = z.object({
  candidate: z.object({
    fullName: z.string().trim().max(120),
    headline: z.string().trim().max(180),
    location: z.string().trim().max(120),
    email: z.string().trim().max(160),
    phone: z.string().trim().max(80),
    links: z.array(z.string().trim().min(1).max(220)).max(8),
  }),
  summary: z.string().trim().min(1).max(1_500),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        category: z.string().trim().max(80),
        evidence: z.string().trim().max(220),
      }),
    )
    .max(40),
  experiences: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(140),
        organization: z.string().trim().max(140),
        period: z.string().trim().max(80),
        location: z.string().trim().max(120),
        context: z.string().trim().max(500),
        achievements: z.array(z.string().trim().min(1).max(240)).max(8),
        technologies: z.array(z.string().trim().min(1).max(80)).max(20),
      }),
    )
    .max(12),
  education: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        organization: z.string().trim().max(160),
        period: z.string().trim().max(80),
      }),
    )
    .max(8),
  certifications: z.array(z.string().trim().min(1).max(140)).max(12),
  languages: z.array(z.string().trim().min(1).max(80)).max(10),
  preferredRoles: z.array(z.string().trim().min(1).max(120)).max(12),
  keywords: z.array(z.string().trim().min(1).max(80)).max(60),
  rawSignals: z.array(z.string().trim().min(1).max(260)).max(30),
});

export type ProspectionResumeActionResult =
  | { resume: ProspectionResumeView }
  | { ok: true }
  | { error: string };

export type ProspectionCvPhotoActionResult =
  | { profile: ProspectionCvProfileView }
  | { ok: true }
  | { error: string };

export type CvQuestionsActionResult =
  | { questions: CvQuestion[] }
  | { error: string };

export type CvGenerationActionResult =
  | { generation: ProspectionCvGenerationView }
  | { error: string };

export type CvDraftActionResult =
  | { cv: TailoredCv; model: string }
  | { error: string };

function optionalText(value: string | undefined) {
  return value?.trim() || null;
}

function cleanFileName(value: string | undefined) {
  return value?.trim().replace(/[^\w .()'_-]/g, "") || null;
}

function titleFromFileName(value: string | null) {
  if (!value) return "";
  return value.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
}

function inputFromFormData(input: FormData) {
  const pdfFile = input.get("pdfFile");
  return {
    pdfFile: pdfFile instanceof File && pdfFile.size > 0 ? pdfFile : undefined,
  };
}

const resumeMemoryFormat = {
  type: "json_schema" as const,
  name: "resume_memory",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      candidate: {
        type: "object",
        additionalProperties: false,
        properties: {
          fullName: { type: "string" },
          headline: { type: "string" },
          location: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          links: { type: "array", items: { type: "string" } },
        },
        required: [
          "fullName",
          "headline",
          "location",
          "email",
          "phone",
          "links",
        ],
      },
      summary: { type: "string" },
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["name", "category", "evidence"],
        },
      },
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
            context: { type: "string" },
            achievements: { type: "array", items: { type: "string" } },
            technologies: { type: "array", items: { type: "string" } },
          },
          required: [
            "role",
            "organization",
            "period",
            "location",
            "context",
            "achievements",
            "technologies",
          ],
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
      preferredRoles: { type: "array", items: { type: "string" } },
      keywords: { type: "array", items: { type: "string" } },
      rawSignals: { type: "array", items: { type: "string" } },
    },
    required: [
      "candidate",
      "summary",
      "skills",
      "experiences",
      "education",
      "certifications",
      "languages",
      "preferredRoles",
      "keywords",
      "rawSignals",
    ],
  },
};

function resumeMemoryToContent(memory: ResumeMemory) {
  const lines = [
    memory.candidate.fullName,
    memory.candidate.headline,
    memory.candidate.location,
    memory.candidate.email,
    memory.candidate.phone,
    memory.summary,
    memory.skills.length
      ? `Compétences: ${memory.skills
          .map((skill) => [skill.name, skill.category, skill.evidence].filter(Boolean).join(" - "))
          .join("; ")}`
      : "",
    ...memory.experiences.map((experience) =>
      [
        experience.role,
        experience.organization,
        experience.period,
        experience.location,
        experience.context,
        ...experience.achievements,
        experience.technologies.length
          ? `Technologies: ${experience.technologies.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    ...memory.education.map((education) =>
      [education.label, education.organization, education.period]
        .filter(Boolean)
        .join(" - "),
    ),
    memory.certifications.length
      ? `Certifications: ${memory.certifications.join(", ")}`
      : "",
    memory.languages.length ? `Langues: ${memory.languages.join(", ")}` : "",
    memory.rawSignals.join("\n"),
  ];

  return lines.filter(Boolean).join("\n\n").slice(0, 35_000);
}

async function createResumeMemoryFromText({
  title,
  sourceFileName,
  content,
}: {
  title: string;
  sourceFileName?: string;
  content: string;
}) {
  const response = await createStructuredOpenAIResponse<unknown>({
    system:
      "Tu lis un CV source une seule fois pour créer une mémoire structurée réutilisable. Extrait uniquement les informations présentes ou clairement déductibles du CV. Ne fabrique pas de dates, employeurs, diplômes ou résultats.",
    user: `Titre: ${title}\nFichier source: ${sourceFileName ?? "Non renseigné"}\n\nTexte extrait du CV:\n${content}`,
    format: resumeMemoryFormat,
  });

  return resumeMemorySchema.parse(response.data);
}

async function createResumeMemoryFromPdf({
  title,
  sourceFileName,
  buffer,
}: {
  title: string;
  sourceFileName?: string;
  buffer: Buffer;
}) {
  const response = await createStructuredOpenAIResponse<unknown>({
    system:
      "Tu lis un CV PDF une seule fois pour créer une mémoire structurée réutilisable. Le PDF peut être scanné ou avoir une extraction texte difficile. Extrait uniquement les informations présentes ou clairement visibles dans le CV. Ne fabrique pas de dates, employeurs, diplômes ou résultats.",
    content: [
      {
        type: "input_file",
        filename: sourceFileName ?? "cv.pdf",
        file_data: `data:application/pdf;base64,${buffer.toString("base64")}`,
      },
      {
        type: "input_text",
        text: `Analyse ce CV PDF (${title}) et retourne la mémoire structurée au format demandé.`,
      },
    ],
    format: resumeMemoryFormat,
  });

  return resumeMemorySchema.parse(response.data);
}

async function prepareResumeInput(input: unknown): Promise<PreparedResumeInput> {
  const raw = input instanceof FormData ? inputFromFormData(input) : input;
  const parsed = resumeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const pdfFile = parsed.data.pdfFile;
  if (!pdfFile) {
    return { error: "Ajoute un PDF" };
  }
  if (pdfFile.type && pdfFile.type !== "application/pdf") {
    return { error: "Le fichier doit être un PDF" };
  }
  if (pdfFile.size > MAX_RESUME_PDF_BYTES) {
    return { error: "PDF trop lourd, limite 5 Mo" };
  }

  const sourceFileName = cleanFileName(pdfFile.name);
  const title = titleFromFileName(sourceFileName) || "CV";
  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
  let content = "";
  let extractionError = "";
  try {
    content = await extractPdfText(pdfBuffer);
  } catch (error) {
    extractionError =
      error instanceof PdfTextExtractionError
        ? error.message
        : "Impossible de lire ce PDF. Réexporte-le en PDF standard, non protégé, puis réessaie.";
    if (extractionError === "Le fichier ne semble pas être un PDF valide.") {
      return { error: extractionError };
    }
  }

  try {
    const structuredContent =
      content.trim().length >= 100
        ? await createResumeMemoryFromText({
            title,
            sourceFileName: sourceFileName ?? undefined,
            content,
          })
        : await createResumeMemoryFromPdf({
            title,
            sourceFileName: sourceFileName ?? undefined,
            buffer: pdfBuffer,
          });
    const storedContent =
      content.trim().length >= 100
        ? content
        : resumeMemoryToContent(structuredContent);
    const stored = storedResumeSchema.safeParse({
      title,
      content: storedContent,
      sourceFileName: sourceFileName ?? undefined,
    });
    if (!stored.success) {
      return {
        error:
          extractionError ||
          stored.error.issues[0]?.message ||
          "Données invalides",
      };
    }

    return {
      data: stored.data,
      structuredContent,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de structurer la mémoire du CV",
    };
  }
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

async function getOwnedCvProfile(userId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_cv_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  return data ? toProspectionCvProfile(data) : null;
}

function resumeContext(resumes: Awaited<ReturnType<typeof getOwnedResumes>>) {
  return resumes
    .map((resume, index) => {
      const memory = hasResumeMemory(resume.structuredContent)
        ? resume.structuredContent
        : fallbackResumeMemory(resume.title, resume.content);
      return `CV ${index + 1} - ${resume.title}\nMémoire structurée:\n${JSON.stringify(memory, null, 2)}`;
    })
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
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            type: { type: "string", enum: ["yes_no", "single_choice"] },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 6,
              items: { type: "string" },
            },
          },
          required: ["id", "question", "type", "options"],
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
      skills: {
        type: "array",
        minItems: 5,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            level: { type: "integer" },
          },
          required: ["name", "level"],
        },
      },
      experiences: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: { type: "string" },
            organization: { type: "string" },
            period: { type: "string" },
            location: { type: "string" },
            bullets: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
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
  const prepared = await prepareResumeInput(input);
  if (!("data" in prepared)) {
    return { error: prepared.error };
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_resume")
    .insert({
      user_id: user.id,
      title: prepared.data.title,
      content: prepared.data.content,
      source_file_name: optionalText(prepared.data.sourceFileName),
      structured_content: prepared.structuredContent,
      photo_data_url: null,
      notes: null,
    })
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/prospection");
  return { resume: serializeProspectionResume(toProspectionResume(data)) };
}

export async function saveProspectionCvPhotoAction(
  input: unknown,
): Promise<ProspectionCvPhotoActionResult> {
  const user = await requireUser();
  const parsed = z.object({ photoDataUrl: photoSchema }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Photo invalide" };
  }

  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_cv_profile")
    .upsert({
      user_id: user.id,
      photo_data_url: optionalText(parsed.data.photoDataUrl),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/prospection");
  return { profile: serializeProspectionCvProfile(toProspectionCvProfile(data)) };
}

export async function deleteProspectionCvPhotoAction(): Promise<ProspectionCvPhotoActionResult> {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { error } = await supabase
    .from("prospection_cv_profile")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/prospection");
  return { ok: true };
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
        "Tu aides un freelance français à adapter son CV à une offre. Pose uniquement des questions qui changeraient vraiment le CV. Retourne entre 3 et 10 questions maximum, toutes en mode choix fermé: type yes_no avec options exactement [\"Oui\", \"Non\"] ou type single_choice avec 3 à 6 options courtes. Pour les single_choice, ajoute si utile une option \"Je ne sais pas\". Ne pose aucune question ouverte. Réponds en français.",
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
  const draft = await draftTailoredCvAction(input);
  if ("error" in draft) return draft;
  return saveTailoredCvAction({
    ...(input && typeof input === "object" ? input : {}),
    generatedCv: draft.cv,
    model: draft.model,
  });
}

export async function draftTailoredCvAction(
  input: unknown,
): Promise<CvDraftActionResult> {
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
  const profileContext = profile
    ? `Profil app: ${profile.businessName}, ${profile.email}, ${profile.phone ?? ""}, ${profile.address}`
    : "Profil app absent.";

  try {
    const response = await createStructuredOpenAIResponse<unknown>({
      system:
        "Tu es un expert CV senior. Génère un CV français clair, honnête, ciblé et compact pour maximiser l'adéquation avec l'offre. Le rendu final utilise un format A4 une page inspiré des CV source du candidat: synthèse courte, 5 à 8 compétences, 4 à 5 expériences maximum, 2 à 4 puces courtes par expérience. Chaque compétence doit inclure un niveau level entre 1 et 5, basé sur les preuves du CV source et l'adéquation avec l'offre. Ne fabrique pas d'employeurs, de diplômes ni de dates. Reformule et priorise les expériences issues des CV fournis. Évite les formules creuses.",
      user: `Contexte candidat:\n${profileContext}\n\nOffre ou mission:\n${parsed.data.offerDescription}\n\nCV sources:\n${resumeContext(resumes)}\n\nQuestions posées et réponses:\n${formatAnswers(parsed.data.questions, answers)}`,
      format: generatedCvFormat,
    });
    const generatedCv = generatedCvSchema.parse(response.data);
    return { cv: generatedCv, model: response.model };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Impossible de préparer le CV",
    };
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : [];
}

function normalizeGeneratedCvInput(value: unknown): TailoredCv | unknown {
  if (!value || typeof value !== "object") return value;
  const cv = value as Partial<TailoredCv>;

  return {
    fullName: text(cv.fullName),
    headline: text(cv.headline),
    location: text(cv.location),
    email: text(cv.email),
    phone: text(cv.phone),
    summary: text(cv.summary),
    skills: normalizeTailoredCvSkills(cv.skills),
    experiences: Array.isArray(cv.experiences)
      ? cv.experiences.map((experience) => ({
          role: text(experience.role),
          organization: text(experience.organization),
          period: text(experience.period),
          location: text(experience.location),
          bullets: textList(experience.bullets),
        }))
      : [],
    education: Array.isArray(cv.education)
      ? cv.education.map((education) => ({
          label: text(education.label),
          organization: text(education.organization),
          period: text(education.period),
        }))
      : [],
    certifications: textList(cv.certifications),
    languages: textList(cv.languages),
  };
}

function normalizeSaveInput(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const value = input as { generatedCv?: unknown };
  return {
    ...value,
    generatedCv: normalizeGeneratedCvInput(value.generatedCv),
  };
}

export async function saveTailoredCvAction(
  input: unknown,
): Promise<CvGenerationActionResult> {
  const user = await requireUser();
  const parsed = generationSaveInputSchema.safeParse(normalizeSaveInput(input));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const [resumes, cvProfile] = await Promise.all([
    getOwnedResumes(user.id, parsed.data.resumeIds),
    getOwnedCvProfile(user.id),
  ]);
  if (resumes.length !== parsed.data.resumeIds.length) {
    return { error: "Un des CV sélectionnés est introuvable" };
  }

  const answers = parsed.data.answers.filter((answer) => answer.answer.trim());
  const photoDataUrl = cvProfile?.photoDataUrl ?? null;

  try {
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
        generated_cv: parsed.data.generatedCv,
        photo_data_url: photoDataUrl,
        model: parsed.data.model ?? "validated-cv",
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
