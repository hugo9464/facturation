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
  "barista",
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
  "product owner",
  "chef de projet numérique",
  "chef de projet si",
  "qa engineer",
  "chef de projet ia",
  "consultant no-code",
  "consultant automatisation",
];

const MATCH_KEYWORDS = [
  "barista",
  "bubble tea",
  "coffee",
  "café",
  "product builder",
  "product owner",
  "product manager",
  "chef de projet",
  "no-code",
  "nocode",
  "low-code",
  "lowcode",
  "qualité",
  "quality",
  "qa",
  "recette",
  "test automation",
  "automatisation de tests",
  "système d'information",
  "systemes d'information",
  "systèmes d'information",
  "si",
  "data",
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
  "créteil",
  "creteil",
  "val-de-marne",
  "val de marne",
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
const CHOISIR_SERVICE_PUBLIC_BASE_URL = "https://choisirleservicepublic.gouv.fr/nos-offres/filtres/localisation/284-287/domaine/3522/";
const CHOISIR_SERVICE_PUBLIC_MAX_PAGES = 3;
const FRANCE_TRAVAIL_BARISTA_URLS = [
  "https://candidat.francetravail.fr/offres/recherche?motsCles=barista&lieux=75D,94D&offresPartenaires=true&range=0-19&tri=0",
  "https://candidat.francetravail.fr/offres/recherche?motsCles=barista&lieux=75D,94D&offresPartenaires=true&range=20-39&tri=0",
];

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractFirst(value: string, pattern: RegExp): string | null {
  const match = value.match(pattern);
  return match ? stripHtml(match[1]) : null;
}

function removeScreenReaderLabel(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/^(?:Localisation|Fonction publique|Employeur)\s*:\s*/i, "").trim();
  return cleaned || null;
}

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

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FacturationJobOfferAgent/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFrenchListingDate(value: string | null): string | null {
  if (!value) return null;
  const months: Record<string, number> = {
    janvier: 0,
    février: 1,
    fevrier: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    août: 7,
    aout: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    décembre: 11,
    decembre: 11,
  };
  const match = value.toLowerCase().match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = months[match[2]];
  const year = Number(match[3]);
  if (month == null || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, month, day)).toISOString();
}

function normalizeFranceTravailUrl(href: string): string | null {
  try {
    return new URL(decodeHtmlEntities(href), "https://candidat.francetravail.fr").toString();
  } catch {
    return null;
  }
}

function parseFranceTravailSubtext(value: string): { company: string | null; location: string | null } {
  const text = stripHtml(value).replace(/\s+/g, " ").trim();
  const locationMatch = text.match(/(?:^|[-–—]\s*)(\d{2}\s*-\s*[^-–—]+(?:\s+\d{1,2}(?:e|er)?(?:\s+Arrondissement)?)?)/i);
  const location = locationMatch ? locationMatch[1].trim() : null;
  const company = locationMatch
    ? text.slice(0, locationMatch.index).replace(/[-–—\s]+$/g, "").trim() || null
    : null;
  return { company, location };
}

export function parseFranceTravailOffers(html: string): RawJobOffer[] {
  const offers: RawJobOffer[] = [];
  const cardPattern = /<li\s+[^>]*data-id-offre="([^"]+)"[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?(?=<li\s+[^>]*data-id-offre=|<\/ul>)/gi;

  for (const match of Array.from(html.matchAll(cardPattern))) {
    const sourceId = decodeHtmlEntities(match[1]);
    const card = match[0];
    const linkMatch = card.match(/<a\s+[^>]*href="([^"]*\/offres\/recherche\/detail\/[^"]+)"[^>]*>/i);
    const title = extractFirst(card, /<span\s+class="media-heading-title">([\s\S]*?)<\/span>/i);
    if (!linkMatch || !title) continue;

    const sourceUrl = normalizeFranceTravailUrl(linkMatch[1]);
    if (!sourceUrl) continue;

    const subtext = extractFirst(card, /<p\s+[^>]*class="subtext"[^>]*>([\s\S]*?)<\/p>/i);
    const { company, location } = parseFranceTravailSubtext(subtext ?? "");
    if (!location || !/(^|\D)(75|94)\s*-/i.test(location)) continue;

    const description = extractFirst(card, /<p\s+class="description">([\s\S]*?)<\/p>/i);
    const contractType = extractFirst(card, /<p\s+class="contrat(?:\s+visible-xs)?">([\s\S]*?)<\/p>/i);
    const dateText = extractFirst(card, /<p\s+class="date">([\s\S]*?)<\/p>/i);

    offers.push({
      source: "France Travail",
      sourceId,
      sourceUrl,
      title,
      company,
      location,
      remote: false,
      contractType,
      salary: null,
      description: [description, contractType, dateText].filter(Boolean).join(" — ") || null,
      tags: ["barista", "France Travail"],
      publishedAt: null,
    });
  }

  return offers;
}

async function scrapeFranceTravailBarista(): Promise<RawJobOffer[]> {
  const results = await Promise.allSettled(
    FRANCE_TRAVAIL_BARISTA_URLS.map(async (url) => parseFranceTravailOffers(await fetchText(url))),
  );
  const byUrl = new Map<string, RawJobOffer>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const offer of result.value) byUrl.set(offer.sourceUrl, offer);
  }
  return Array.from(byUrl.values());
}

export function parseChoisirServicePublicOffers(html: string): RawJobOffer[] {
  const offers: RawJobOffer[] = [];
  const cardPattern = /<div class="fr-card fr-card--horizontal fr-card--horizontal-tier fr-card--offer">[\s\S]*?(?=<div class="fr-card fr-card--horizontal fr-card--horizontal-tier fr-card--offer">|<nav class="fr-pagination|<\/ul>\s*<\/div>\s*<\/div>\s*<\/div>)/g;
  const cards = html.match(cardPattern) ?? [];

  for (const card of cards) {
    const linkMatch = card.match(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const sourceUrl = normalizeUrl(decodeHtmlEntities(linkMatch[1]));
    const title = stripHtml(linkMatch[2]);
    if (!sourceUrl || !title) continue;

    const location = removeScreenReaderLabel(extractFirst(card, /<li class="fr-icon-map-pin-2-line fr-icon--sm">([\s\S]*?)<\/li>/i));
    if (!location || !/(\(75\)|\(94\)|paris|val[- ]de[- ]marne|créteil|creteil)/i.test(location)) continue;

    const contractType = removeScreenReaderLabel(extractFirst(card, /<li class="fr-icon-file-line fr-icon--sm">([\s\S]*?)<\/li>/i));
    const company = removeScreenReaderLabel(extractFirst(card, /<li class="fr-icon-user-line\s+fr-icon--sm">([\s\S]*?)<\/li>/i));
    const publishedText = extractFirst(card, /<li class="fr-icon-calendar-line\s+fr-icon--sm">([\s\S]*?)<\/li>/i);
    const tagMatches = Array.from(card.matchAll(/<p\s+class="fr-tag\s*"\s*>[\s\S]*?([^<>]+)[\s\S]*?<\/p>/gi))
      .map((match) => stripHtml(match[0]));
    const tags = unique([...tagMatches, "Choisir le service public"]);
    const sourceId = sourceUrl.match(/reference-([^/]+)\/?$/i)?.[1] ?? null;

    offers.push({
      source: "Choisir le service public",
      sourceId,
      sourceUrl,
      title,
      company,
      location,
      remote: false,
      contractType,
      salary: null,
      description: [title, company, contractType, location, ...tags].filter(Boolean).join(" — "),
      tags,
      publishedAt: parseFrenchListingDate(publishedText),
    });
  }

  return offers;
}

async function scrapeChoisirServicePublic(): Promise<RawJobOffer[]> {
  const maxPages = Math.max(1, Number(process.env.CHOISIR_SERVICE_PUBLIC_MAX_PAGES ?? CHOISIR_SERVICE_PUBLIC_MAX_PAGES));
  const pageUrls = Array.from({ length: maxPages }, (_unused, index) =>
    index === 0 ? CHOISIR_SERVICE_PUBLIC_BASE_URL : `${CHOISIR_SERVICE_PUBLIC_BASE_URL}page/${index + 1}/`,
  );
  const results = await Promise.allSettled(pageUrls.map(async (url) => parseChoisirServicePublicOffers(await fetchText(url))));
  const byUrl = new Map<string, RawJobOffer>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const offer of result.value) byUrl.set(offer.sourceUrl, offer);
  }
  return Array.from(byUrl.values());
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
  const results = await Promise.allSettled([
    scrapeFranceTravailBarista(),
    scrapeRemotive(),
    scrapeArbeitnow(),
    scrapeRemoteOk(),
    scrapeChoisirServicePublic(),
  ]);
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

export async function scrapeJobOffers(feedback?: string | null): Promise<RankedJobOffer[]> {
  const rawOffers = await scrapeRawJobOffers();
  return rankJobOffersForPreferences(rawOffers, parseJobOfferFeedbackPreferences(feedback));
}
