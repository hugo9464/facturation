import * as assert from "node:assert/strict";
import {
  parseFranceTravailOffers,
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

const franceTravailHtml = `
<ul class="result-list list-unstyled">
  <li data-id-offre="213SPHR" class="result">
    <a id="pagelink" class="media with-fav" role="button" href="/offres/recherche/detail/213SPHR">
      <div class="media-body">
        <h2 data-intitule-offre="213SPHR" class="t4 media-heading"><span class="media-heading-title">Employé polyvalent / Bubble Tea Barista (H/F)</span></h2>
        <p translate="no" class="subtext">YI FANG CHOISY (FRUIT TEA &amp; BUBBLE TEA)&nbsp;-&nbsp;<span>75 - PARIS 13</span></p>
        <p class="description">Préparer l'ouverture de la boutique, accueillir les clients et préparer les boissons.</p>
        <p class="contrat visible-xs">CDI&nbsp;-&nbsp;Temps plein</p>
        <p class="date">Publié il y a 5 jours</p>
      </div>
    </a>
  </li>
</ul>`;

const franceTravailOffers = parseFranceTravailOffers(franceTravailHtml);
assert.equal(franceTravailOffers.length, 1, "France Travail barista results should be parsed");
assert.equal(franceTravailOffers[0]?.title, "Employé polyvalent / Bubble Tea Barista (H/F)");
assert.equal(franceTravailOffers[0]?.company, "YI FANG CHOISY (FRUIT TEA & BUBBLE TEA)");
assert.equal(franceTravailOffers[0]?.location, "75 - PARIS 13");

const rankedBarista = rankJobOffersForPreferences(franceTravailOffers);
assert.equal(rankedBarista.length, 1, "barista offers in Paris should pass ranking");
assert.ok(rankedBarista[0]?.matchedKeywords.includes("barista"));

console.log("job offer feedback tests passed");
