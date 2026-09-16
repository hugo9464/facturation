import { sendJobOfferDigestEmail, type JobOfferDigestEntry } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseJobOfferFeedbackPreferences,
  rankJobOffersForPreferences,
  scrapeRawJobOffers,
  type RankedJobOffer,
} from "@/lib/job-offer-scraper";

export type JobOfferScrapeResult = {
  scraped: number;
  inserted: number;
  refreshed: number;
  users: number;
};

export type JobOfferScrapeOptions = {
  userIds?: string[];
};

function toInsertRow(userId: string, offer: RankedJobOffer) {
  return {
    user_id: userId,
    source: offer.source,
    source_id: offer.sourceId ?? null,
    source_url: offer.sourceUrl,
    title: offer.title,
    company: offer.company ?? null,
    location: offer.location ?? null,
    remote: offer.remote !== false,
    contract_type: offer.contractType ?? null,
    salary: offer.salary ?? null,
    description: offer.description ?? null,
    tags: offer.tags ?? [],
    matched_keywords: offer.matchedKeywords,
    match_score: offer.matchScore,
    status: "NEW" as const,
    published_at: offer.publishedAt ?? null,
    last_seen_at: new Date().toISOString(),
  };
}

function toDigestEntry(offer: RankedJobOffer): JobOfferDigestEntry {
  return {
    title: offer.title,
    company: offer.company ?? null,
    location: offer.location ?? null,
    contractType: offer.contractType ?? null,
    salary: offer.salary ?? null,
    matchScore: offer.matchScore,
    matchedKeywords: offer.matchedKeywords,
    source: offer.source,
    sourceUrl: offer.sourceUrl,
    description: offer.description ?? null,
    tags: offer.tags ?? [],
  };
}

async function sendNewJobOfferDigest(entries: JobOfferDigestEntry[]) {
  if (entries.length === 0) return;

  const to = process.env.JOB_OFFER_DIGEST_EMAIL?.trim() || "hugo.faye@gmail.com";
  const replyTo = process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    to;
  const result = await sendJobOfferDigestEmail({
    to,
    fromName: "Facturation",
    replyTo,
    entries,
  });
  if ("error" in result) throw new Error(result.error);
}

export async function runJobOfferScrape(options: JobOfferScrapeOptions = {}): Promise<JobOfferScrapeResult> {
  const admin = createAdminClient();
  const rawOffers = await scrapeRawJobOffers();
  if (rawOffers.length === 0) {
    return { scraped: 0, inserted: 0, refreshed: 0, users: 0 };
  }

  const profiles = options.userIds
    ? options.userIds.map((userId) => ({ user_id: userId }))
    : await (async () => {
        const { data, error } = await admin.from("profile").select("user_id");
        if (error) throw error;
        return data ?? [];
      })();

  const userIds = profiles.map((profile) => profile.user_id as string);
  const feedbackByUserId = new Map<string, string[]>();
  if (userIds.length > 0) {
    const { data: feedbackRows, error: feedbackError } = await admin
      .from("job_offer_agent_feedback")
      .select("user_id, message, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });
    if (feedbackError) throw feedbackError;

    for (const row of feedbackRows ?? []) {
      const userId = row.user_id as string;
      const existing = feedbackByUserId.get(userId) ?? [];
      if (existing.length >= 5) continue;
      feedbackByUserId.set(userId, [...existing, row.message as string]);
    }
  }

  let inserted = 0;
  let refreshed = 0;
  const pendingRows: ReturnType<typeof toInsertRow>[] = [];
  const digestEntries: JobOfferDigestEntry[] = [];
  const digestUrls = new Set<string>();
  const now = new Date().toISOString();

  for (const profile of profiles ?? []) {
    const userId = profile.user_id as string;
    const feedback = (feedbackByUserId.get(userId) ?? []).join("\n");
    const offers = rankJobOffersForPreferences(
      rawOffers,
      parseJobOfferFeedbackPreferences(feedback),
    );
    if (offers.length === 0) continue;
    const urls = offers.map((offer) => offer.sourceUrl);
    const { data: existingRows, error: existingError } = await admin
      .from("job_offer")
      .select("id, source_url")
      .eq("user_id", userId)
      .in("source_url", urls);
    if (existingError) throw existingError;

    const existingByUrl = new Map(
      (existingRows ?? []).map((row) => [row.source_url as string, row.id as string]),
    );
    const newOffers = offers.filter((offer) => !existingByUrl.has(offer.sourceUrl));
    const newRows = newOffers.map((offer) => toInsertRow(userId, offer));
    const existingIds = Array.from(existingByUrl.values());

    if (newRows.length > 0) {
      pendingRows.push(...newRows);
      for (const offer of newOffers) {
        if (digestUrls.has(offer.sourceUrl)) continue;
        digestUrls.add(offer.sourceUrl);
        digestEntries.push(toDigestEntry(offer));
      }
    }

    if (existingIds.length > 0) {
      const { error: updateError } = await admin
        .from("job_offer")
        .update({ last_seen_at: now, updated_at: now })
        .in("id", existingIds);
      if (updateError) throw updateError;
      refreshed += existingIds.length;
    }
  }

  await sendNewJobOfferDigest(digestEntries);

  if (pendingRows.length > 0) {
    const { error: insertError } = await admin.from("job_offer").insert(pendingRows);
    if (insertError) throw insertError;
    inserted = pendingRows.length;
  }

  return {
    scraped: rawOffers.length,
    inserted,
    refreshed,
    users: profiles?.length ?? 0,
  };
}
