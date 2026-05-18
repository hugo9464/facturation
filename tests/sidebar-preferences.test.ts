import * as assert from "node:assert/strict";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
  parseSidebarPreferences,
  serializeSidebarPreferences,
} from "../lib/sidebar-preferences";

assert.equal(clampSidebarWidth(120), SIDEBAR_MIN_WIDTH);
assert.equal(clampSidebarWidth(999), SIDEBAR_MAX_WIDTH);
assert.equal(clampSidebarWidth(Number.NaN), SIDEBAR_DEFAULT_WIDTH);
assert.equal(clampSidebarWidth(255.6), 256);

assert.deepEqual(parseSidebarPreferences(null), null);
assert.deepEqual(parseSidebarPreferences("pas-json"), null);
assert.deepEqual(parseSidebarPreferences("[]"), null);
assert.deepEqual(parseSidebarPreferences('{"width":260,"collapsed":true}'), {
  width: 260,
  collapsed: true,
});
assert.deepEqual(parseSidebarPreferences('{"width":100,"collapsed":false}'), {
  width: SIDEBAR_MIN_WIDTH,
  collapsed: false,
});
assert.equal(
  serializeSidebarPreferences({ width: 999, collapsed: true }),
  JSON.stringify({ width: SIDEBAR_MAX_WIDTH, collapsed: true }),
);

console.log("sidebar preferences tests passed");
