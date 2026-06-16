export type RawJobOffer = {
  source: string;
  sourceId?: string | null;
  sourceUrl: string;
  title: string;
  company?: string | null;
  location?: string | null;
  remote?: boolean;
  contractType?: string | null;
  salary?: string | null;
  description?: string | null;
  tags?: string[];
  publishedAt?: string | null;
};

export type RankedJobOffer = RawJobOffer & {
  matchedKeywords: string[];
  matchScore: number;
};

export type JobOfferFeedbackPreferences = {
  rawFeedback: string;
  minimumAnnualSalaryEur: number | null;
};

const SEARCH_TERMS = [
  "product builder",
  "product builder france",
  "no-code",
  "no-code france",
  "low-code",
  "low-code france",
  "ai automation",
  "ai automation france",
  "ai product",
  "ai product france",
  "automation specialist",
  "automation specialist france",
  "technical builder",
  "product manager france",
  "chef de projet ia",
  "consultant no-code",
  "consultant automatisation",
];

const MATCH_KEYWORDS = [
  "product builder",
  "no-code",
  "nocode",
  "low-code",
  "lowcode",
  "ai",
  "ia",
  "llm",
  "agent",
  "automation",
  "workflow",
  "zapier",
  "make.com",
  "integromat",
  "n8n",
  "airtable",
  "bubble",
  "webflow",
  "retool",
  "claude",
  "codex",
  "openai",
  "prompt",
  "product ops",
  "growth ops",
  "revops",
];

const NEGATIVE_KEYWORDS = [
  "senior backend",
  "java",
  "c++",
  "embedded",
  "devops engineer",
  "data scientist phd",
];

const FRANCE_KEYWORDS = [
  "france",
  "french",
  "français",
  "francaise",
  "française",
  "paris",
  "lyon",
  "marseille",
  "toulouse",
  "bordeaux",
  "lille",
  "nantes",
  "rennes",
  "montpellier",
  "strasbourg",
  "nice",
  "grenoble",
  "remote france",
  "france remote",
  "remote from france",
  "télétravail",
  "teletravail",
];

const MAX_DESCRIPTION_LENGTH = 1800;

function compactText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.slice(0, MAX_DESCRIPTION_LENGTH);
}

function normalizeUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    return new URL(url.trim()).toString();
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function parseJobOfferFeedbackPreferences(feedback: string | null | undefined): JobOfferFeedbackPreferences {
  const rawFeedback = typeof feedback === "string" ? feedback.trim() : "";
  const normalized = rawFeedback.toLowerCase().replace(/\s+/g, " ");
  const salaryContext = /(?:salaire|rémunération|remuneration|tj[mh]|minimum|min|au moins|à partir de|a partir de)/i;
  let minimumAnnualSalaryEur: number | null = null;

  for (const match of Array.from(normalized.matchAll(/(\d{2,3})(?:\s?)(k|000)?\s?(?:€|eur|euros|k€)?/gi))) {
    const index = match.index ?? 0;
    const context = normalized.slice(Math.max(0, index - 45), Math.min(normalized.length, index + 45));
    if (!salaryContext.test(context)) continue;
    const base = Number(match[1]);
    const amount = match[2] === "000" || match[2] === "k" || base < 1000 ? base * 1000 : base;
    if (amount >= 10_000) minimumAnnualSalaryEur = Math.max(minimumAnnualSalaryEur ?? 0, amount);
  }

  return { rawFeedback, minimumAnnualSalaryEur };
}

function salaryBoundsAnnualEur(salary: string | null | undefined): { min: number; max: number } | null {
  if (!salary) return null;
  const normalized = salary.toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");
  const values = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)(?:\s?)(k|000)?\s?(?:€|eur|euros|k€)?/gi))
    .map((match) => {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) return null;
      let amount = match[2] === "000" || match[2] === "k" || value < 1000 ? value * 1000 : value;
      if (/(?:jour|day|daily|tj[mh])/.test(normalized)) amount *= 220;
      if (/(?:mois|month|mensuel)/.test(normalized)) amount *= 12;
      return Math.round(amount);
    })
    .filter((value): value is number => value !== null && value >= 1000);

  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function keywordMatches(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = keyword.length <= 4 || !keyword.includes(" ")
    ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i")
    : new RegExp(escaped.replace(/\\ /g, "\\s+"), "i");
  return pattern.test(haystack);
}

function rankOffer(offer: RawJobOffer): RankedJobOffer | null {
  const haystack = [
    offer.title,
    offer.company,
    offer.location,
    offer.contractType,
    offer.salary,
    offer.description,
    ...(offer.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isFranceOffer = FRANCE_KEYWORDS.some((keyword) =>
    keywordMatches(haystack, keyword),
  );
  if (!isFranceOffer) return null;

  const matchedKeywords = MATCH_KEYWORDS.filter((keyword) =>
    keywordMatches(haystack, keyword),
  );
  const negativeMatches = NEGATIVE_KEYWORDS.filter((keyword) =>
    keywordMatches(haystack, keyword),
  );

  const title = offer.title.toLowerCase();
  const titleBoost = MATCH_KEYWORDS.filter((keyword) =>
    keywordMatches(title, keyword),
  ).length;
  const remoteBoost = offer.remote !== false ? 4 : 0;
  const score = matchedKeywords.length * 8 + titleBoost * 10 + remoteBoost - negativeMatches.length * 12;

  if (score < 12) return null;
  return {
    ...offer,
    tags: unique(offer.tags ?? []),
    matchedKeywords: unique(matchedKeywords),
    matchScore: score,
  };
}

export function rankJobOffersForPreferences(
  offers: RawJobOffer[],
  preferences: JobOfferFeedbackPreferences = parseJobOfferFeedbackPreferences(null),
): RankedJobOffer[] {
  const byUrl = new Map<string, RankedJobOffer>();
  for (const rawOffer of offers) {
    const ranked = rankOffer(rawOffer);
    if (!ranked) continue;

    if (preferences.minimumAnnualSalaryEur != null) {
      const bounds = salaryBoundsAnnualEur(ranked.salary);
      if (!bounds || bounds.max < preferences.minimumAnnualSalaryEur) continue;
      ranked.matchScore += 8;
    }

    const existing = byUrl.get(ranked.sourceUrl);
    if (!existing || ranked.matchScore > existing.matchScore) {
      byUrl.set(ranked.sourceUrl, ranked);
    }
  }

  return Array.from(byUrl.values()).sort((a, b) => b.matchScore - a.matchScore);
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FacturationJobOfferAgent/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function scrapeRemotive(): Promise<RawJobOffer[]> {
  const offers: RawJobOffer[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const payload = await fetchJson(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}`,
    );
    const jobs = Array.isArray((payload as { jobs?: unknown[] }).jobs)
      ? (payload as { jobs: Record<string, unknown>[] }).jobs
      : [];

    for (const job of jobs) {
      const url = normalizeUrl(job.url);
      const title = compactText(job.title);
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      offers.push({
        source: "Remotive",
        sourceId: job.id == null ? null : String(job.id),
        sourceUrl: url,
        title,
        company: compactText(job.company_name),
        location: compactText(job.candidate_required_location),
        remote: true,
        contractType: compactText(job.job_type),
        salary: compactText(job.salary),
        description: compactText(job.description),
        tags: Array.isArray(job.tags) ? job.tags.map(String) : [],
        publishedAt: parseDate(job.publication_date),
      });
    }
  }

  return offers;
}

async function scrapeArbeitnow(): Promise<RawJobOffer[]> {
  const payload = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  const jobs = Array.isArray((payload as { data?: unknown[] }).data)
    ? (payload as { data: Record<string, unknown>[] }).data
    : [];

  return jobs
    .map((job): RawJobOffer | null => {
      const url = normalizeUrl(job.url);
      const title = compactText(job.title);
      if (!url || !title) return null;
      const tags = Array.isArray(job.tags) ? job.tags.map(String) : [];
      const createdAt = typeof job.created_at === "number"
        ? new Date(job.created_at * 1000).toISOString()
        : parseDate(job.created_at);
      return {
        source: "Arbeitnow",
        sourceId: job.slug == null ? null : String(job.slug),
        sourceUrl: url,
        title,
        company: compactText(job.company_name),
        location: compactText(job.location),
        remote: tags.some((tag) => tag.toLowerCase().includes("remote")) ||
          String(job.remote ?? "").toLowerCase() === "true",
        contractType: tags.find((tag) => /full|part|contract|freelance/i.test(tag)) ?? null,
        salary: null,
        description: compactText(job.description),
        tags,
        publishedAt: createdAt,
      };
    })
    .filter((offer): offer is RawJobOffer => offer !== null);
}

async function scrapeRemoteOk(): Promise<RawJobOffer[]> {
  const payload = await fetchJson("https://remoteok.com/api");
  const jobs = Array.isArray(payload) ? (payload.slice(1) as Record<string, unknown>[]) : [];

  return jobs
    .map((job): RawJobOffer | null => {
      const url = normalizeUrl(job.url ?? job.apply_url);
      const title = compactText(job.position);
      if (!url || !title) return null;
      const tags = Array.isArray(job.tags) ? job.tags.map(String) : [];
      return {
        source: "RemoteOK",
        sourceId: job.id == null ? null : String(job.id),
        sourceUrl: url,
        title,
        company: compactText(job.company),
        location: compactText(job.location),
        remote: true,
        contractType: null,
        salary: compactText(job.salary),
        description: compactText(job.description),
        tags,
        publishedAt: parseDate(job.date),
      };
    })
    .filter((offer): offer is RawJobOffer => offer !== null);
}

export async function scrapeRawJobOffers(): Promise<RawJobOffer[]> {
  const results = await Promise.allSettled([scrapeRemotive(), scrapeArbeitnow(), scrapeRemoteOk()]);
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

export async function scrapeJobOffers(feedback?: string | null): Promise<RankedJobOffer[]> {
  const rawOffers = await scrapeRawJobOffers();
  return rankJobOffersForPreferences(rawOffers, parseJobOfferFeedbackPreferences(feedback));
}
