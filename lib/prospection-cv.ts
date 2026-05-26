import type {
  ProspectionCvGeneration,
  ProspectionCvProfile,
  ProspectionResume,
} from "@/db/schema";

export type ResumeMemorySkill = {
  name: string;
  category: string;
  evidence: string;
};

export type ResumeMemoryExperience = {
  role: string;
  organization: string;
  period: string;
  location: string;
  context: string;
  achievements: string[];
  technologies: string[];
};

export type ResumeMemoryEducation = {
  label: string;
  organization: string;
  period: string;
};

export type ResumeMemory = {
  candidate: {
    fullName: string;
    headline: string;
    location: string;
    email: string;
    phone: string;
    links: string[];
  };
  summary: string;
  skills: ResumeMemorySkill[];
  experiences: ResumeMemoryExperience[];
  education: ResumeMemoryEducation[];
  certifications: string[];
  languages: string[];
  preferredRoles: string[];
  keywords: string[];
  rawSignals: string[];
};

export type ProspectionResumeView = Omit<
  ProspectionResume,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type ProspectionCvProfileView = Omit<
  ProspectionCvProfile,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type CvQuestion = {
  id: string;
  question: string;
  type: "yes_no" | "single_choice";
  options: string[];
};

export type CvAnswer = {
  question: string;
  answer: string;
};

export type TailoredCvExperience = {
  role: string;
  organization: string;
  period: string;
  location: string;
  bullets: string[];
};

export type TailoredCvEducation = {
  label: string;
  organization: string;
  period: string;
};

export type TailoredCvSkill = {
  name: string;
  level: number;
};

export type TailoredCv = {
  fullName: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  summary: string;
  skills: TailoredCvSkill[];
  experiences: TailoredCvExperience[];
  education: TailoredCvEducation[];
  certifications: string[];
  languages: string[];
};

export type ProspectionCvGenerationView = Omit<
  ProspectionCvGeneration,
  "questions" | "answers" | "generatedCv" | "createdAt" | "updatedAt"
> & {
  questions: CvQuestion[];
  answers: CvAnswer[];
  generatedCv: TailoredCv;
  createdAt: string;
  updatedAt: string;
};

export function serializeProspectionResume(
  resume: ProspectionResume,
): ProspectionResumeView {
  return {
    ...resume,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

export function serializeProspectionCvProfile(
  profile: ProspectionCvProfile,
): ProspectionCvProfileView {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function serializeProspectionCvGeneration(
  generation: ProspectionCvGeneration,
): ProspectionCvGenerationView {
  return {
    ...generation,
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
  };
}

export function sortProspectionResumes<T extends Pick<ProspectionResume, "updatedAt">>(
  resumes: T[],
) {
  return [...resumes].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
}

export function sortProspectionCvGenerations<
  T extends Pick<ProspectionCvGeneration, "createdAt">,
>(generations: T[]) {
  return [...generations].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

export function cvGenerationTitle(offerDescription: string) {
  const firstLine =
    offerDescription
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "CV adapté";
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
}

export function clampSkillLevel(value: unknown) {
  const level = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(level)) return 4;

  return Math.min(5, Math.max(1, Math.round(level)));
}

export function normalizeTailoredCvSkills(value: unknown): TailoredCvSkill[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          name: item.trim(),
          level: index < 3 ? 5 : index < 6 ? 4 : 3,
        };
      }

      if (!item || typeof item !== "object") return null;
      const candidate = item as { name?: unknown; level?: unknown };
      const name =
        typeof candidate.name === "string" ? candidate.name.trim() : "";
      if (!name) return null;

      return {
        name,
        level: clampSkillLevel(candidate.level),
      };
    })
    .filter((skill): skill is TailoredCvSkill => skill !== null);
}

export function hasResumeMemory(value: unknown): value is ResumeMemory {
  return (
    value !== null &&
    typeof value === "object" &&
    "candidate" in value &&
    "experiences" in value &&
    "skills" in value
  );
}

export function fallbackResumeMemory(title: string, content: string): ResumeMemory {
  return {
    candidate: {
      fullName: "",
      headline: title,
      location: "",
      email: "",
      phone: "",
      links: [],
    },
    summary: content.slice(0, 1_500),
    skills: [],
    experiences: [],
    education: [],
    certifications: [],
    languages: [],
    preferredRoles: [],
    keywords: [],
    rawSignals: [content.slice(0, 4_000)],
  };
}
