import * as assert from "node:assert/strict";
import { buildJobOfferDigestEmailContent, type JobOfferDigestEntry } from "../lib/email";

const entries: JobOfferDigestEntry[] = [
  {
    title: "Barista Serveur - 35H H/F",
    company: "French Theory",
    location: "75 - Paris 5e Arrondissement",
    contractType: "CDI - Temps plein",
    salary: null,
    matchScore: 26,
    matchedKeywords: ["barista", "coffee"],
    source: "France Travail",
    sourceUrl: "https://candidat.francetravail.fr/offres/recherche/detail/213TEST",
    description: "Service du matin, préparation des cafés et disponibilité le samedi.",
    tags: ["barista", "France Travail"],
  },
  {
    title: "Barista - Temps Partiel - Paris 75 H/F",
    company: "STARBUCKS FRANCE",
    location: "75 - Paris 15e Arrondissement",
    contractType: "CDI - Non renseigné",
    salary: null,
    matchScore: 26,
    matchedKeywords: ["barista"],
    source: "France Travail",
    sourceUrl: "https://candidat.francetravail.fr/offres/recherche/detail/213PART",
    description: "Poste à temps partiel. Accueil client et préparation de boissons.",
    tags: ["barista", "France Travail"],
  },
];

const content = buildJobOfferDigestEmailContent(entries);

assert.match(content.subject, /2 nouvelles offres/i);
assert.match(content.text, /35h\/semaine/i);
assert.match(content.text, /matin/i);
assert.match(content.text, /week-end/i);
assert.doesNotMatch(content.text, /75h\/semaine/i);
assert.match(content.html, /<html/i);
assert.match(content.html, /Barista Serveur - 35H H\/F/);
assert.match(content.html, /Résumé/);
assert.match(content.html, /35h\/semaine/);
assert.match(content.html, /Matin/);
assert.match(content.html, /Week-end/);
assert.doesNotMatch(content.html, /75h\/semaine/i, "Paris 75 should not be interpreted as weekly hours");
assert.doesNotMatch(content.html, /Volume/);
assert.doesNotMatch(content.html, /grid-template-columns/);
assert.match(content.html, /font-size:18px/, "cards should use a more compact title size");
assert.match(content.html, /35h\/semaine · Matin · Week-end/);
assert.match(content.html, /href="https:\/\/candidat\.francetravail\.fr\/offres\/recherche\/detail\/213TEST"/);
assert.match(content.html, /Voir l'offre/);

console.log("job offer email digest tests passed");
