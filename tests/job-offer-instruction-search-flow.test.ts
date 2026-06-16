import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actionsSource = readFileSync("actions/job-offers.ts", "utf8");
const searchButtonSource = readFileSync("app/(app)/job-offers/retrigger-search-button.tsx", "utf8");
const controlsSource = readFileSync("app/(app)/job-offers/job-offer-agent-controls.tsx", "utf8");
const pageSource = readFileSync("app/(app)/job-offers/page.tsx", "utf8");

assert.match(
  actionsSource,
  /retriggerJobOfferSearchAction\(instruction\?: string\)/,
  "manual job offer search should accept the current instruction text",
);
assert.match(
  actionsSource,
  /saveJobOfferAgentFeedbackMessage\(user\.id, instruction\)/,
  "manual search should persist a provided instruction before scraping so it affects that run",
);
assert.match(
  searchButtonSource,
  /instruction\?: string/,
  "the manual search button should receive the current instruction from the UI",
);
assert.match(
  controlsSource,
  /<RetriggerSearchButton\s+instruction={agentInstruction}/,
  "the instruction textarea value should be passed to the manual search trigger",
);
assert.match(
  pageSource,
  /<JobOfferAgentControls \/>/,
  "the job offer page should use the combined instruction + search controls",
);

console.log("job offer instruction search flow tests passed");
