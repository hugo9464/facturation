import type { Profile, ProspectionResume } from "@/db/schema";
import { createStructuredOpenAIResponse } from "@/lib/openai-responses";
import {
  fallbackResumeMemory,
  hasResumeMemory,
  type ResumeMemory,
} from "@/lib/prospection-cv";
import { createAdminClient } from "@/lib/supabase/admin";
import { toProfile, toProspectionResume } from "@/lib/supabase/db";

const COLLECTIVE_WORK_BASE_URL = "https://www.collective.work";
const DEFAULT_PAGES_TO_SCAN = 3;
const MAX_AI_CANDIDATES = 24;
export const COLLECTIVE_WORK_MATCH_THRESHOLD = 65;

type RawObject = Record<string, unknown>;

export type CollectiveWorkJob = {
  sourceId: string;
  slug: string;
  language: string;
  title: string;
  summary: string | null;
  descriptionText: string;
  organization: string | null;
  location: string | null;
  dailyRate: string | null;
  workPreferences: string[];
  skills: string[];
  applicationEmail: string | null;
  publishedAt: string | null;
  sourceUrl: string;
};

export type CollectiveWorkMatch = {
  sourceUrl: string;
  matches: boolean;
  score: number;
  reason: string;
};

export type CollectiveWorkProspectionScannedDetail = {
  title: string;
  organization: string | null;
  location: string | null;
  dailyRate: string | null;
  sourceUrl: string;
};

export type CollectiveWorkProspectionAnalyzedDetail =
  CollectiveWorkProspectionScannedDetail & {
    heuristicScore: number;
    matchedTerms: string[];
    fitSignals: string[];
    aiMatches: boolean | null;
    accepted: boolean | null;
    matches: boolean | null;
    score: number | null;
    reason: string | null;
  };

export type CollectiveWorkProspectionRunResult = {
  scanned: number;
  candidates: number;
  matched: number;
  inserted: number;
  emailed: number;
  users: number;
  errors: string[];
  details?: {
    scanned: CollectiveWorkProspectionScannedDetail[];
    analyzed: CollectiveWorkProspectionAnalyzedDetail[];
  };
};

type RankedJob = {
  job: CollectiveWorkJob;
  heuristicScore: number;
  matchedTerms: string[];
  fitSignals: string[];
};

type ReviewLearningExample = {
  decision: "positive" | "negative";
  title: string;
  organization: string | null;
  score: number | null;
  fitSignals: string[];
  reason: string | null;
};

const AUTOMATION_CANDIDATE_TERMS = [
  "automation",
  "automatisation",
  "automatises",
  "automatise",
  "api",
  "apis",
  "python",
  "selenium",
  "ci cd",
];

const AUTOMATION_JOB_SIGNAL_TERMS = [
  { label: "automation", terms: ["automation", "automatisation", "automatise"] },
  { label: "API", terms: ["api", "apis", "rest"] },
  { label: "Python", terms: ["python"] },
  { label: "IA", terms: ["ia", "ai", "intelligence artificielle", "chatgpt", "gemini"] },
  { label: "ERP / SI", terms: ["erp", "systeme information"] },
  { label: "data / flux", terms: ["data", "donnees", "master data", "flux"] },
  { label: "processus metier", terms: ["processus metier", "fonctionnel"] },
];

const STOP_WORDS = new Set([
  "avec",
  "aux",
  "dans",
  "des",
  "du",
  "elle",
  "for",
  "from",
  "les",
  "mission",
  "missions",
  "pour",
  "sur",
  "the",
  "une",
  "vous",
  "your",
]);

const collectiveMatchFormat = {
  type: "json_schema" as const,
  name: "collective_work_prospection_matches",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sourceUrl: { type: "string" },
            matches: { type: "boolean" },
            score: { type: "number", minimum: 0, maximum: 100 },
            reason: { type: "string" },
          },
          required: ["sourceUrl", "matches", "score", "reason"],
        },
      },
    },
    required: ["matches"],
  },
};

function isObject(value: unknown): value is RawObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(stringValue).filter((item) => item.length > 0)
    : [];
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[key] ?? match;
  });
}

export function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h[1-6]|ul|ol|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  ).replace(/[ \t]{2,}/g, " ");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addTerm(target: Set<string>, value: string) {
  const normalized = normalizeText(value);
  if (normalized.length < 3 || STOP_WORDS.has(normalized)) return;

  target.add(normalized);
  for (const token of normalized.split(" ")) {
    if (token.length >= 3 && !STOP_WORDS.has(token)) target.add(token);
  }
}

function termMatches(text: string, term: string) {
  if (term.includes(" ")) return text.includes(term);
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(
    text,
  );
}

function textMatchesAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => termMatches(text, term));
}

function boundedScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function normalizeCollectiveWorkMatch(
  match: CollectiveWorkMatch,
): CollectiveWorkMatch {
  const matches = Boolean(match.matches);
  let score = boundedScore(match.score);

  if (matches && score < COLLECTIVE_WORK_MATCH_THRESHOLD) {
    score = COLLECTIVE_WORK_MATCH_THRESHOLD;
  }
  if (!matches && score >= COLLECTIVE_WORK_MATCH_THRESHOLD) {
    score = COLLECTIVE_WORK_MATCH_THRESHOLD - 1;
  }

  return {
    sourceUrl: match.sourceUrl,
    matches,
    score,
    reason:
      match.reason.trim() ||
      (matches
        ? "Mission compatible avec le profil."
        : "Mission insuffisamment alignée avec le profil."),
  };
}

function isAcceptedMatch(match: CollectiveWorkMatch) {
  return match.matches && match.score >= COLLECTIVE_WORK_MATCH_THRESHOLD;
}

function normalizedJobText(job: CollectiveWorkJob) {
  return normalizeText(
    [
      job.title,
      job.summary,
      job.descriptionText,
      job.organization,
      job.location,
      job.skills.join(" "),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function automationFitSignals(text: string, matchedTerms: string[]) {
  if (!textMatchesAnyTerm(matchedTerms.join(" "), AUTOMATION_CANDIDATE_TERMS)) {
    return [];
  }

  const signals = AUTOMATION_JOB_SIGNAL_TERMS.flatMap((signal) =>
    textMatchesAnyTerm(text, signal.terms) ? [signal.label] : [],
  );
  return signals.includes("automation") && signals.length >= 3 ? signals : [];
}

function applyStrongFitFloor(
  match: CollectiveWorkMatch,
  ranked: RankedJob,
): CollectiveWorkMatch {
  if (ranked.fitSignals.length < 3) return match;

  const signalText = ranked.fitSignals.slice(0, 5).join(", ");
  const reason = match.reason.includes("Signal metier fort")
    ? match.reason
    : `${match.reason} Signal metier fort: ${signalText}.`;

  return normalizeCollectiveWorkMatch({
    ...match,
    matches: true,
    score: Math.max(match.score, COLLECTIVE_WORK_MATCH_THRESHOLD + 5),
    reason,
  });
}

function extractNextData(html: string) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("__NEXT_DATA__ introuvable sur Collective.work");
  return JSON.parse(match[1] ?? "{}") as RawObject;
}

function toCollectiveWorkJob(project: unknown): CollectiveWorkJob | null {
  if (!isObject(project)) return null;

  const slug = stringValue(project.slug);
  const title = stringValue(project.name);
  if (!slug || !title) return null;

  const language = stringValue(project.language) || "fr";
  const company = isObject(project.company) ? project.company : {};
  const location = isObject(project.location) ? project.location : {};
  const job = isObject(project.job) ? project.job : {};
  const descriptionText = htmlToText(stringValue(project.description));
  const sourceUrl = `${COLLECTIVE_WORK_BASE_URL}/jobs/${language}/${slug}`;

  return {
    sourceId: stringValue(project.id) || slug,
    slug,
    language,
    title,
    summary: stringValue(project.sumUp) || null,
    descriptionText,
    organization: stringValue(company.name) || null,
    location:
      stringValue(location.fullNameFrench) ||
      stringValue(location.fullNameEnglish) ||
      null,
    dailyRate: stringValue(project.budgetBrief) || null,
    workPreferences: stringArray(project.workPreferences),
    skills: [
      ...stringArray(project.projectTypes),
      ...stringArray(project.projectTypeSuggestions),
    ],
    applicationEmail:
      stringValue(job.applicationType) === "EMAIL" &&
      stringValue(job.applicationTypeValue).includes("@")
        ? stringValue(job.applicationTypeValue)
        : null,
    publishedAt: stringValue(project.publishedAt) || null,
    sourceUrl,
  };
}

export function parseCollectiveWorkJobsFromHtml(html: string) {
  const data = extractNextData(html);
  const queries = isObject(data.props)
    ? ((data.props as RawObject).pageProps as RawObject | undefined)
        ?.dehydratedState
    : null;
  const dehydratedQueries = isObject(queries)
    ? (queries.queries as unknown[])
    : null;
  if (!Array.isArray(dehydratedQueries)) return [];

  const jobs: CollectiveWorkJob[] = [];
  for (const query of dehydratedQueries) {
    if (!isObject(query) || !isObject(query.state)) continue;
    const result = ((query.state.data as RawObject | undefined)?.results ??
      null) as RawObject | null;
    if (!isObject(result) || !Array.isArray(result.projects)) continue;
    for (const project of result.projects) {
      const job = toCollectiveWorkJob(project);
      if (job) jobs.push(job);
    }
  }

  return dedupeJobs(jobs);
}

function dedupeJobs(jobs: CollectiveWorkJob[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.sourceUrl)) return false;
    seen.add(job.sourceUrl);
    return true;
  });
}

function jobDetail(job: CollectiveWorkJob): CollectiveWorkProspectionScannedDetail {
  return {
    title: job.title,
    organization: job.organization,
    location: job.location,
    dailyRate: job.dailyRate,
    sourceUrl: job.sourceUrl,
  };
}

async function fetchCollectiveWorkJobs(page: number) {
  const response = await fetch(`${COLLECTIVE_WORK_BASE_URL}/jobs/fr?page=${page}`, {
    headers: {
      "User-Agent":
        "facturation-prospection/1.0 (+https://www.collective.work/jobs/fr)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Collective.work a répondu avec le statut ${response.status}`);
  }

  return parseCollectiveWorkJobsFromHtml(await response.text());
}

async function fetchRecentCollectiveWorkJobs(pages: number) {
  const pageCount = Number.isFinite(pages)
    ? Math.max(1, Math.min(10, pages))
    : DEFAULT_PAGES_TO_SCAN;
  const pagesJobs = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => fetchCollectiveWorkJobs(index + 1)),
  );
  return dedupeJobs(pagesJobs.flat());
}

function resumeMemory(resume: ProspectionResume): ResumeMemory {
  return hasResumeMemory(resume.structuredContent)
    ? resume.structuredContent
    : fallbackResumeMemory(resume.title, resume.content);
}

function candidateTerms(profile: Profile, resumes: ProspectionResume[]) {
  const terms = new Set<string>();
  addTerm(terms, profile.businessName);

  for (const resume of resumes) {
    const memory = resumeMemory(resume);
    addTerm(terms, memory.candidate.headline);
    for (const role of memory.preferredRoles) addTerm(terms, role);
    for (const keyword of memory.keywords) addTerm(terms, keyword);
    for (const signal of memory.rawSignals) addTerm(terms, signal.slice(0, 120));
    for (const skill of memory.skills) addTerm(terms, skill.name);
    for (const experience of memory.experiences) {
      addTerm(terms, experience.role);
      for (const technology of experience.technologies) addTerm(terms, technology);
    }
  }

  return [...terms].slice(0, 120);
}

export function rankJobsForCandidate(jobs: CollectiveWorkJob[], terms: string[]) {
  const ranked: RankedJob[] = [];
  for (const job of jobs) {
    const normalizedJob = normalizedJobText(job);
    const matchedTerms = terms.filter((term) => termMatches(normalizedJob, term));
    if (matchedTerms.length === 0) continue;

    const titleText = normalizeText(job.title);
    const titleMatches = matchedTerms.filter((term) => termMatches(titleText, term));
    const fitSignals = automationFitSignals(normalizedJob, matchedTerms);
    ranked.push({
      job,
      heuristicScore:
        matchedTerms.length +
        titleMatches.length * 2 +
        Math.min(fitSignals.length * 2, 8),
      matchedTerms: matchedTerms.slice(0, 12),
      fitSignals,
    });
  }

  return ranked
    .sort((left, right) => right.heuristicScore - left.heuristicScore)
    .slice(0, MAX_AI_CANDIDATES);
}

function candidateContext(
  profile: Profile,
  resumes: ProspectionResume[],
  reviewLearning: ReviewLearningExample[],
) {
  const resumeBlocks = resumes.map((resume, index) => ({
    label: `CV ${index + 1}: ${resume.title}`,
    memory: resumeMemory(resume),
  }));

  return {
    profile: {
      businessName: profile.businessName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
    },
    resumes: resumeBlocks,
    reviewLearning,
  };
}

async function evaluateMatchesWithAi(
  profile: Profile,
  resumes: ProspectionResume[],
  rankedJobs: RankedJob[],
  reviewLearning: ReviewLearningExample[],
) {
  if (!process.env.OPENAI_API_KEY) {
    return rankedJobs.map<CollectiveWorkMatch>((ranked) => {
      const score = Math.min(80, ranked.heuristicScore * 12);
      return {
        sourceUrl: ranked.job.sourceUrl,
        score,
        matches: score >= COLLECTIVE_WORK_MATCH_THRESHOLD,
        reason: `Correspondance par mots-cles: ${ranked.matchedTerms.slice(0, 6).join(", ")}`,
      };
    });
  }

  const response = await createStructuredOpenAIResponse<{
    matches: CollectiveWorkMatch[];
  }>({
    system:
      [
        "Tu qualifies des missions freelance Collective.work pour un utilisateur.",
        "Tu dois etre selectif: retiens seulement les offres clairement alignées avec les competences, roles preferes, experiences ou technologies du candidat.",
        "Les fitSignals fournis par le systeme sont des indices forts. Une mission automation, IA, API, Python, data, flux ou SI peut etre compatible avec un profil automation/API meme si le titre n'est pas strictement QA.",
        "Tiens compte de reviewLearning: decision=positive signifie que l'utilisateur a importe une offre similaire; decision=negative signifie qu'il a archive une offre similaire. Ajuste la selection en consequence sans copier aveuglement.",
        `Le score est un nombre de 0 a 100. matches doit etre true si et seulement si score >= ${COLLECTIVE_WORK_MATCH_THRESHOLD}; sinon matches doit etre false.`,
        "Une raison positive comme 'fort match' doit avoir un score eleve. Un score faible doit expliquer ce qui manque ou ce qui est trop eloigne.",
        "Reponds en JSON strict.",
      ].join(" "),
    user: JSON.stringify({
      candidate: candidateContext(profile, resumes, reviewLearning),
      jobs: rankedJobs.map((ranked) => ({
        sourceUrl: ranked.job.sourceUrl,
        title: ranked.job.title,
        organization: ranked.job.organization,
        location: ranked.job.location,
        dailyRate: ranked.job.dailyRate,
        workPreferences: ranked.job.workPreferences,
        skills: ranked.job.skills,
        description: ranked.job.descriptionText.slice(0, 4_000),
        heuristicSignals: ranked.matchedTerms,
        fitSignals: ranked.fitSignals,
      })),
    }),
    format: collectiveMatchFormat,
  });

  const rankedSourceUrls = new Set(rankedJobs.map((ranked) => ranked.job.sourceUrl));
  const rankedByUrl = new Map(rankedJobs.map((ranked) => [ranked.job.sourceUrl, ranked]));
  return response.data.matches
    .filter((match) => rankedSourceUrls.has(match.sourceUrl))
    .map((match) => {
      const normalized = normalizeCollectiveWorkMatch(match);
      const ranked = rankedByUrl.get(normalized.sourceUrl);
      return ranked ? applyStrongFitFloor(normalized, ranked) : normalized;
    });
}

async function getReviewLearningExamples(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("prospection_offer_review")
    .select("status,title,organization,score,fit_signals,reason,reviewed_at,updated_at")
    .eq("user_id", userId)
    .in("status", ["IMPORTED", "ARCHIVED"])
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(24);
  if (error) throw error;

  return (data ?? []).map<ReviewLearningExample>((row) => ({
    decision: stringValue((row as RawObject).status) === "IMPORTED" ? "positive" : "negative",
    title: stringValue((row as RawObject).title),
    organization: stringValue((row as RawObject).organization) || null,
    score:
      (row as RawObject).score === null || (row as RawObject).score === undefined
        ? null
        : Number((row as RawObject).score),
    fitSignals: stringArray((row as RawObject).fit_signals),
    reason: stringValue((row as RawObject).reason) || null,
  }));
}

function notesForJob(job: CollectiveWorkJob, match: CollectiveWorkMatch) {
  const meta = [
    `Source: Collective.work`,
    job.organization ? `Organisation: ${job.organization}` : null,
    job.location ? `Lieu: ${job.location}` : null,
    job.dailyRate ? `TJM / budget: ${job.dailyRate}` : null,
    job.workPreferences.length
      ? `Mode de travail: ${job.workPreferences.join(", ")}`
      : null,
    job.skills.length ? `Competences: ${job.skills.join(", ")}` : null,
    job.publishedAt ? `Publie le: ${job.publishedAt}` : null,
    `Score matching: ${Math.round(match.score)}/100`,
    match.reason ? `Raison: ${match.reason}` : null,
  ].filter(Boolean);

  return `${meta.join("\n")}\n\n${job.descriptionText}`.slice(0, 11_500);
}

async function getKnownEntrySourceUrls(userId: string, sourceUrls: string[]) {
  if (sourceUrls.length === 0) return new Set<string>();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("prospection_entry")
    .select("source_url")
    .eq("user_id", userId)
    .in("source_url", sourceUrls);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => stringValue((row as RawObject).source_url))
      .filter(Boolean),
  );
}

async function getKnownReviewSourceUrls(userId: string, sourceUrls: string[]) {
  if (sourceUrls.length === 0) return new Set<string>();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("prospection_offer_review")
    .select("source_url")
    .eq("user_id", userId)
    .in("source_url", sourceUrls);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => stringValue((row as RawObject).source_url))
      .filter(Boolean),
  );
}

async function getBlockedSourceUrls(userId: string, sourceUrls: string[]) {
  const [entries, reviews] = await Promise.all([
    getKnownEntrySourceUrls(userId, sourceUrls),
    getKnownReviewSourceUrls(userId, sourceUrls),
  ]);
  return new Set([...entries, ...reviews]);
}

async function getUserResumes(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("prospection_resume")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map(toProspectionResume);
}

async function queueAnalyzedJobsForReview(
  profile: Profile,
  rankedJobs: RankedJob[],
  evaluationsByUrl: Map<string, CollectiveWorkMatch>,
  rankedJobsByUrl: Map<string, RankedJob>,
) {
  if (rankedJobs.length === 0) return [];
  const supabase = createAdminClient();
  const rows = rankedJobs.flatMap((rankedJob) => {
    const match =
      evaluationsByUrl.get(rankedJob.job.sourceUrl) ??
      normalizeCollectiveWorkMatch({
        sourceUrl: rankedJob.job.sourceUrl,
        matches: false,
        score: 0,
        reason: "Offre non retenue: evaluation IA absente.",
      });
    const ranked = rankedJobsByUrl.get(match.sourceUrl);
    const job = ranked?.job;
    if (!job) return [];
    const accepted = isAcceptedMatch(match);
    return [
      {
        user_id: profile.userId,
        status: "PENDING",
        title: job.title,
        source_id: job.sourceId,
        organization: job.organization,
        source_url: job.sourceUrl,
        location: job.location,
        daily_rate: job.dailyRate,
        notes: notesForJob(job, match),
        ai_matches: match.matches,
        accepted,
        score: match.score,
        heuristic_score: ranked.heuristicScore,
        matched_terms: ranked.matchedTerms,
        fit_signals: ranked.fitSignals,
        reason: match.reason,
      },
    ];
  });
  if (rows.length === 0) return [];

  const known = await getBlockedSourceUrls(
    profile.userId,
    rows.map((row) => row.source_url),
  );
  const rowsToInsert = rows.filter((row) => !known.has(row.source_url));
  if (rowsToInsert.length === 0) return [];

  const { data, error } = await supabase
    .from("prospection_offer_review")
    .insert(rowsToInsert)
    .select("*");
  if (error) throw error;

  return data ?? [];
}

async function profilesToScan(userId?: string) {
  const supabase = createAdminClient();
  let query = supabase.from("profile").select("*").order("created_at", {
    ascending: true,
  });
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toProfile);
}

async function runForProfile(profile: Profile, jobs: CollectiveWorkJob[]) {
  const known = await getBlockedSourceUrls(
    profile.userId,
    jobs.map((job) => job.sourceUrl),
  );
  const unseenJobs = jobs.filter((job) => !known.has(job.sourceUrl));
  const [resumes, reviewLearning] = await Promise.all([
    getUserResumes(profile.userId),
    getReviewLearningExamples(profile.userId),
  ]);
  const terms = candidateTerms(profile, resumes);
  if (terms.length === 0) {
    return {
      candidates: 0,
      matched: 0,
      inserted: 0,
      emailed: 0,
      analyzedDetails: [],
    };
  }

  const rankedJobs = rankJobsForCandidate(unseenJobs, terms);
  if (rankedJobs.length === 0) {
    return {
      candidates: 0,
      matched: 0,
      inserted: 0,
      emailed: 0,
      analyzedDetails: [],
    };
  }

  let evaluated: CollectiveWorkMatch[];
  try {
    evaluated = await evaluateMatchesWithAi(
      profile,
      resumes,
      rankedJobs,
      reviewLearning,
    );
  } catch (error) {
    evaluated = rankedJobs.map((ranked) => {
      const score = Math.min(80, ranked.heuristicScore * 12);
      return {
        sourceUrl: ranked.job.sourceUrl,
        matches: score >= COLLECTIVE_WORK_MATCH_THRESHOLD,
        score,
        reason:
          error instanceof Error
            ? `Fallback mots-cles apres erreur IA: ${error.message}`
            : "Fallback mots-cles apres erreur IA",
      };
    });
  }

  const rankedByUrl = new Map(rankedJobs.map((ranked) => [ranked.job.sourceUrl, ranked]));
  evaluated = evaluated.map((match) => {
    const normalized = normalizeCollectiveWorkMatch(match);
    const ranked = rankedByUrl.get(normalized.sourceUrl);
    return ranked ? applyStrongFitFloor(normalized, ranked) : normalized;
  });
  const evaluationsByUrl = new Map(
    evaluated.map((match) => [match.sourceUrl, match]),
  );
  const matches = evaluated.filter(isAcceptedMatch);
  const analyzedDetails = rankedJobs.map((ranked) => {
    const evaluation = evaluationsByUrl.get(ranked.job.sourceUrl);
    const accepted = evaluation ? isAcceptedMatch(evaluation) : null;
    return {
      ...jobDetail(ranked.job),
      heuristicScore: ranked.heuristicScore,
      matchedTerms: ranked.matchedTerms,
      fitSignals: ranked.fitSignals,
      aiMatches: evaluation?.matches ?? null,
      accepted,
      matches: accepted,
      score: evaluation?.score ?? null,
      reason: evaluation?.reason ?? null,
    };
  });
  const inserted = await queueAnalyzedJobsForReview(
    profile,
    rankedJobs,
    evaluationsByUrl,
    rankedByUrl,
  );

  return {
    candidates: rankedJobs.length,
    matched: matches.length,
    inserted: inserted.length,
    emailed: 0,
    analyzedDetails,
  };
}

export async function runCollectiveWorkProspection({
  userId,
  pages = Number(process.env.COLLECTIVE_WORK_SCAN_PAGES ?? DEFAULT_PAGES_TO_SCAN),
  includeDetails = false,
}: {
  userId?: string;
  pages?: number;
  includeDetails?: boolean;
} = {}): Promise<CollectiveWorkProspectionRunResult> {
  const result: CollectiveWorkProspectionRunResult = {
    scanned: 0,
    candidates: 0,
    matched: 0,
    inserted: 0,
    emailed: 0,
    users: 0,
    errors: [],
  };

  const jobs = await fetchRecentCollectiveWorkJobs(pages);
  result.scanned = jobs.length;
  if (includeDetails) {
    result.details = {
      scanned: jobs.map(jobDetail),
      analyzed: [],
    };
  }
  const profiles = await profilesToScan(userId);
  result.users = profiles.length;

  for (const profile of profiles) {
    try {
      const profileResult = await runForProfile(profile, jobs);
      result.candidates += profileResult.candidates;
      result.matched += profileResult.matched;
      result.inserted += profileResult.inserted;
      result.emailed += profileResult.emailed;
      if (result.details) {
        result.details.analyzed.push(...profileResult.analyzedDetails);
      }
    } catch (error) {
      result.errors.push(
        `${profile.email}: ${
          error instanceof Error ? error.message : "Erreur inconnue"
        }`,
      );
    }
  }

  return result;
}
