import type { ProspectionCvGeneration, ProspectionResume } from "@/db/schema";

export type ProspectionResumeView = Omit<
  ProspectionResume,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type CvQuestion = {
  id: string;
  question: string;
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

export type TailoredCv = {
  fullName: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  summary: string;
  skills: string[];
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
