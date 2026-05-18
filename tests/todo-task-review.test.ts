import * as assert from "node:assert/strict";
import {
  hasUnseenTaskChange,
  parseSeenProjectTaskUpdates,
  timestampValue,
} from "../lib/todo-task-review";

assert.equal(timestampValue("2026-05-18T12:00:00.000Z"), Date.UTC(2026, 4, 18, 12));
assert.equal(timestampValue("date-invalide"), 0);
assert.equal(timestampValue(null), 0);

assert.deepEqual(
  parseSeenProjectTaskUpdates('{"project-a":1770000000000,"bad":"nope","nan":null}'),
  { "project-a": 1770000000000 },
);
assert.equal(parseSeenProjectTaskUpdates("[]"), null);
assert.equal(parseSeenProjectTaskUpdates("not-json"), null);

assert.equal(
  hasUnseenTaskChange({
    taskUpdatedAt: "2026-05-18T12:05:00.000Z",
    projectSeenAt: Date.UTC(2026, 4, 18, 12),
  }),
  true,
  "a task modified after the project baseline needs the same dot indicator as the sidebar project",
);
assert.equal(
  hasUnseenTaskChange({
    taskUpdatedAt: "2026-05-18T11:55:00.000Z",
    projectSeenAt: Date.UTC(2026, 4, 18, 12),
  }),
  false,
  "tasks older than the project baseline should not be marked to review",
);
assert.equal(
  hasUnseenTaskChange({
    taskUpdatedAt: "date-invalide",
    projectSeenAt: Date.UTC(2026, 4, 18, 12),
  }),
  false,
  "invalid task timestamps should not create review dots",
);

console.log("todo task review tests passed");
