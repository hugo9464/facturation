import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(app)/job-offers/retrigger-search-button.tsx", "utf8");

assert.match(
  source,
  /const \[isSearching, setIsSearching\] = useState\(false\)/,
  "manual search button should keep its own pending state while the async server action runs",
);
assert.match(
  source,
  /setStatusMessage\("Recherche en cours/,
  "manual search button should show immediate inline feedback after click",
);
assert.match(
  source,
  /role="status" aria-live="polite"/,
  "manual search result should remain visible and accessible after the toast disappears",
);
assert.match(
  source,
  /aucune nouvelle offre pertinente trouvée/,
  "manual search should explain successful runs that find no matching new offers",
);

console.log("job offer manual search button tests passed");
