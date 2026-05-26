import * as assert from "node:assert/strict";
import {
  PROSPECTION_STATUS_LABELS,
  isProspectionApplicationQuestionsSchemaError,
  isClosedProspectionStatus,
  prospectionPrimaryLine,
  sortProspectionEntries,
} from "../lib/prospection";
import {
  cvGenerationTitle,
  normalizeTailoredCvSkills,
  sortProspectionCvGenerations,
  sortProspectionResumes,
} from "../lib/prospection-cv";

const now = new Date("2026-05-20T10:00:00Z");

assert.equal(PROSPECTION_STATUS_LABELS.TO_APPLY, "À postuler");
assert.equal(isClosedProspectionStatus("TO_APPLY"), false);
assert.equal(isClosedProspectionStatus("WON"), true);
assert.equal(
  prospectionPrimaryLine({ title: "Mission Next.js" }),
  "Mission Next.js",
);
assert.equal(prospectionPrimaryLine({ title: "Contact CTO" }), "Contact CTO");

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
assert.deepEqual(normalizeTailoredCvSkills(["Next.js", "Supabase"])[0], {
  name: "Next.js",
  level: 5,
});
assert.deepEqual(
  normalizeTailoredCvSkills([{ name: "Airtable", level: 12 }])[0],
  {
    name: "Airtable",
    level: 5,
  },
);
assert.equal(
  isProspectionApplicationQuestionsSchemaError({
    code: "PGRST205",
    details: null,
    hint: null,
    message:
      "Could not find the table 'public.prospection_application_question' in the schema cache",
  }),
  true,
);
assert.equal(
  isProspectionApplicationQuestionsSchemaError({
    code: "PGRST204",
    details: null,
    hint: null,
    message:
      "Could not find the 'order' column of 'prospection_application_question' in the schema cache",
  }),
  true,
);
assert.equal(
  isProspectionApplicationQuestionsSchemaError({
    code: "PGRST301",
    message: "JWT expired",
  }),
  false,
);

console.log("prospection tests passed");
