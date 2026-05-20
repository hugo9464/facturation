import * as assert from "node:assert/strict";
import {
  PROSPECTION_STATUS_LABELS,
  isClosedProspectionStatus,
  prospectionPrimaryLine,
  sortProspectionEntries,
} from "../lib/prospection";
import {
  cvGenerationTitle,
  sortProspectionCvGenerations,
  sortProspectionResumes,
} from "../lib/prospection-cv";

const now = new Date("2026-05-20T10:00:00Z");

assert.equal(PROSPECTION_STATUS_LABELS.TO_APPLY, "À candidater");
assert.equal(isClosedProspectionStatus("TO_APPLY"), false);
assert.equal(isClosedProspectionStatus("WON"), true);
assert.equal(
  prospectionPrimaryLine({ title: "Mission Next.js", organization: "Acme" }),
  "Mission Next.js · Acme",
);
assert.equal(
  prospectionPrimaryLine({ title: "Contact CTO", organization: null }),
  "Contact CTO",
);

const sorted = sortProspectionEntries([
  {
    status: "ARCHIVED",
    type: "CONTACT",
    createdAt: now,
    updatedAt: now,
  },
  {
    status: "TO_APPLY",
    type: "COMPANY",
    createdAt: now,
    updatedAt: now,
  },
  {
    status: "TO_APPLY",
    type: "OFFER",
    createdAt: now,
    updatedAt: new Date("2026-05-20T11:00:00Z"),
  },
]);

assert.deepEqual(
  sorted.map((entry) => `${entry.status}:${entry.type}`),
  ["TO_APPLY:OFFER", "TO_APPLY:COMPANY", "ARCHIVED:CONTACT"],
);

assert.equal(
  cvGenerationTitle("Lead Next.js freelance\nParis"),
  "Lead Next.js freelance",
);
assert.equal(
  sortProspectionResumes([
    { updatedAt: new Date("2026-05-19T10:00:00Z") },
    { updatedAt: new Date("2026-05-20T10:00:00Z") },
  ])[0]?.updatedAt.toISOString(),
  "2026-05-20T10:00:00.000Z",
);
assert.equal(
  sortProspectionCvGenerations([
    { createdAt: new Date("2026-05-19T10:00:00Z") },
    { createdAt: new Date("2026-05-20T10:00:00Z") },
  ])[0]?.createdAt.toISOString(),
  "2026-05-20T10:00:00.000Z",
);

console.log("prospection tests passed");
