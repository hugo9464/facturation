import * as assert from "node:assert/strict";
import {
  parseJobOfferFeedbackPreferences,
  rankJobOffersForPreferences,
  type RawJobOffer,
} from "../lib/job-offer-scraper";

const preferences = parseJobOfferFeedbackPreferences(
  "Cherche uniquement des missions avec un salaire minimum de 60k€, idéalement remote.",
);

assert.equal(preferences.minimumAnnualSalaryEur, 60_000);

const offers: RawJobOffer[] = [
  {
    source: "Test",
    sourceUrl: "https://example.com/low",
    title: "Product builder IA",
    location: "Paris, France",
    remote: true,
    salary: "45k€",
    description: "No-code automation et workflows IA",
    tags: ["no-code", "automation"],
  },
  {
    source: "Test",
    sourceUrl: "https://example.com/high",
    title: "Product builder IA",
    location: "Paris, France",
    remote: true,
    salary: "70 000 € annuel",
    description: "No-code automation et workflows IA",
    tags: ["no-code", "automation"],
  },
  {
    source: "Test",
    sourceUrl: "https://example.com/unknown",
    title: "Product builder IA",
    location: "Paris, France",
    remote: true,
    salary: null,
    description: "No-code automation et workflows IA",
    tags: ["no-code", "automation"],
  },
];

const ranked = rankJobOffersForPreferences(offers, preferences);

assert.deepEqual(
  ranked.map((offer) => offer.sourceUrl),
  ["https://example.com/high"],
  "a salary feedback should keep only offers with an advertised salary above the requested minimum",
);

console.log("job offer feedback tests passed");
