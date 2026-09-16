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
];

const content = buildJobOfferDigestEmailContent(entries);

assert.match(content.subject, /1 nouvelle offre/i);
assert.match(content.text, /35h\/semaine/i);
assert.match(content.text, /matin/i);
assert.match(content.text, /week-end/i);
assert.match(content.html, /<html/i);
assert.match(content.html, /Barista Serveur - 35H H\/F/);
assert.match(content.html, /Résumé/);
assert.match(content.html, /35h\/semaine/);
assert.match(content.html, /Travail le matin/);
assert.match(content.html, /Week-end probable/);
assert.match(content.html, /href="https:\/\/candidat\.francetravail\.fr\/offres\/recherche\/detail\/213TEST"/);
assert.match(content.html, /Voir l'offre/);

console.log("job offer email digest tests passed");
