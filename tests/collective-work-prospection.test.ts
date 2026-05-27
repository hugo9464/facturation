import * as assert from "node:assert/strict";
import {
  COLLECTIVE_WORK_MATCH_THRESHOLD,
  htmlToText,
  normalizeCollectiveWorkMatch,
  parseCollectiveWorkJobsFromHtml,
  rankJobsForCandidate,
} from "../lib/collective-work-prospection";

assert.equal(
  htmlToText("<p>Mission <strong>Next.js</strong>&nbsp;&amp; Supabase</p>"),
  "Mission Next.js & Supabase",
);

const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
  {
    props: {
      pageProps: {
        dehydratedState: {
          queries: [
            {
              state: {
                data: {
                  results: {
                    projects: [
                      {
                        id: "job_1",
                        slug: "developpeur-nextjs-supabase",
                        name: "Développeur Next.js Supabase",
                        sumUp: "Mission fullstack",
                        description:
                          "<p>Construire une application SaaS avec Next.js.</p>",
                        language: "fr",
                        budgetBrief: "650",
                        workPreferences: ["REMOTE"],
                        projectTypes: ["NEXT_JS"],
                        projectTypeSuggestions: ["SUPABASE"],
                        publishedAt: "2026-05-26T16:00:00.000Z",
                        company: { name: "Acme" },
                        location: { fullNameFrench: "Paris, France" },
                        job: {
                          applicationType: "EMAIL",
                          applicationTypeValue: "jobs@example.com",
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
)}</script></body></html>`;

const jobs = parseCollectiveWorkJobsFromHtml(html);
assert.equal(jobs.length, 1);
assert.equal(jobs[0]?.title, "Développeur Next.js Supabase");
assert.equal(jobs[0]?.organization, "Acme");
assert.equal(jobs[0]?.location, "Paris, France");
assert.equal(jobs[0]?.dailyRate, "650");
assert.equal(jobs[0]?.applicationEmail, "jobs@example.com");
assert.equal(
  jobs[0]?.sourceUrl,
  "https://www.collective.work/jobs/fr/developpeur-nextjs-supabase",
);
assert.deepEqual(jobs[0]?.skills, ["NEXT_JS", "SUPABASE"]);
assert.equal(
  jobs[0]?.descriptionText,
  "Construire une application SaaS avec Next.js.",
);

assert.deepEqual(
  normalizeCollectiveWorkMatch({
    sourceUrl: "https://example.com/strong-match",
    matches: true,
    score: 1,
    reason: "Tres fort match",
  }),
  {
    sourceUrl: "https://example.com/strong-match",
    matches: true,
    score: COLLECTIVE_WORK_MATCH_THRESHOLD,
    reason: "Tres fort match",
  },
);

assert.deepEqual(
  normalizeCollectiveWorkMatch({
    sourceUrl: "https://example.com/weak-match",
    matches: false,
    score: 100,
    reason: "Trop eloigne",
  }),
  {
    sourceUrl: "https://example.com/weak-match",
    matches: false,
    score: COLLECTIVE_WORK_MATCH_THRESHOLD - 1,
    reason: "Trop eloigne",
  },
);

const automationJob = {
  sourceId: "job_automation_si",
  slug: "charge-de-mission-si-and-projets-automation-c9ev",
  language: "fr",
  title: "Chargé de Mission SI & Projets Automation",
  summary: "Chargé de Mission SI & Projets Automation",
  descriptionText: [
    "Analyste SI, Automation & IA.",
    "Supervision des flux automatisés et résolution des erreurs post-automatisation.",
    "Maîtrise de ChatGPT, Gemini, Make, Zapier, Python et APIs.",
    "Documentation des flux et amélioration des processus métier.",
  ].join("\n"),
  organization: "Cherry Pick",
  location: "Paris, France",
  dailyRate: null,
  workPreferences: ["HYBRID"],
  skills: ["IA"],
  applicationEmail: null,
  publishedAt: "2026-05-27T08:00:00.000Z",
  sourceUrl:
    "https://www.collective.work/jobs/fr/charge-de-mission-si-and-projets-automation-c9ev",
};

const automationRanked = rankJobsForCandidate([automationJob], [
  "automation",
  "automatisation",
  "apis",
  "python",
]);

assert.equal(automationRanked.length, 1);
assert.deepEqual(automationRanked[0]?.fitSignals.slice(0, 4), [
  "automation",
  "API",
  "Python",
  "IA",
]);
assert.ok(
  automationRanked[0] && automationRanked[0].heuristicScore >= 12,
  "automation SI/API jobs should receive a strong prefilter score",
);

console.log("collective work prospection tests passed");
