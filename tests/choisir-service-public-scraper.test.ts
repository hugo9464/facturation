import * as assert from "node:assert/strict";
import { parseChoisirServicePublicOffers, rankJobOffersForPreferences } from "../lib/job-offer-scraper";

const html = `
<div class="fr-card fr-card--horizontal fr-card--horizontal-tier fr-card--offer">
  <div class="fr-card__body">
    <div class="fr-card__content">
      <h3 class="fr-card__title">
        <a href="https://choisirleservicepublic.gouv.fr/offre-emploi/chef-de-projet-si-reference-2026-1/" aria-label="Chef de projet SI, nouvelle fenêtre">
          Chef de projet SI
        </a>
      </h3>
      <div class="fr-card__start">
        <ul class="fr-tags-group"><li><p class="fr-tag">Numérique</p></li></ul>
      </div>
      <ul class="fr-card__desc">
        <li class="fr-icon-map-pin-2-line fr-icon--sm"><span class="sr-only">Localisation : </span>Paris <strong>(75)</strong></li>
        <li class="fr-icon-file-line fr-icon--sm"><span class="sr-only">Fonction publique : </span>Fonction publique de l'État</li>
        <li class="fr-icon-user-line fr-icon--sm"><span class="sr-only">Employeur : </span>DINUM</li>
        <li class="fr-icon-calendar-line fr-icon--sm">En ligne depuis le 16 septembre 2026</li>
      </ul>
    </div>
  </div>
</div>
<div class="fr-card fr-card--horizontal fr-card--horizontal-tier fr-card--offer">
  <div class="fr-card__body">
    <div class="fr-card__content">
      <h3 class="fr-card__title">
        <a href="https://choisirleservicepublic.gouv.fr/offre-emploi/product-owner-reference-2026-2/">Product owner</a>
      </h3>
      <div class="fr-card__start"><ul class="fr-tags-group"><li><p class="fr-tag">Numérique</p></li></ul></div>
      <ul class="fr-card__desc">
        <li class="fr-icon-map-pin-2-line fr-icon--sm"><span class="sr-only">Localisation : </span>Créteil <strong>(94)</strong></li>
        <li class="fr-icon-file-line fr-icon--sm"><span class="sr-only">Fonction publique : </span>Fonction publique territoriale</li>
        <li class="fr-icon-user-line fr-icon--sm"><span class="sr-only">Employeur : </span>Conseil départemental du Val-de-Marne</li>
        <li class="fr-icon-calendar-line fr-icon--sm">En ligne depuis le 15 septembre 2026</li>
      </ul>
    </div>
  </div>
</div>
<div class="fr-card fr-card--horizontal fr-card--horizontal-tier fr-card--offer">
  <div class="fr-card__body">
    <div class="fr-card__content">
      <h3 class="fr-card__title">
        <a href="https://choisirleservicepublic.gouv.fr/offre-emploi/hors-zone-reference-2026-3/">Développeur web</a>
      </h3>
      <ul class="fr-card__desc">
        <li class="fr-icon-map-pin-2-line fr-icon--sm"><span class="sr-only">Localisation : </span>Lyon <strong>(69)</strong></li>
        <li class="fr-icon-user-line fr-icon--sm"><span class="sr-only">Employeur : </span>Ville de Lyon</li>
      </ul>
    </div>
  </div>
</div>
`;

const offers = parseChoisirServicePublicOffers(html);

assert.equal(offers.length, 2, "only Paris and Val-de-Marne numérique public-service offers should be retained");
assert.deepEqual(
  offers.map((offer) => offer.title),
  ["Chef de projet SI", "Product owner"],
);
assert.deepEqual(
  offers.map((offer) => offer.location),
  ["Paris (75)", "Créteil (94)"],
);
assert.equal(offers[0].company, "DINUM");
assert.equal(offers[0].contractType, "Fonction publique de l'État");
assert.equal(offers[0].publishedAt, "2026-09-16T00:00:00.000Z");
assert.deepEqual(offers[0].tags, ["Numérique", "Choisir le service public"]);

const ranked = rankJobOffersForPreferences(offers);
assert.deepEqual(
  ranked.map((offer) => offer.title),
  ["Chef de projet SI", "Product owner"],
  "public-service numérique offers matching Hugo's product/QA/search criteria should survive ranking",
);

console.log("choisir service public scraper tests passed");
