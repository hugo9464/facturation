import * as assert from "node:assert/strict";
import { parseGithubPullRequestUrl } from "../lib/todo-task-summary-context";

assert.deepEqual(parseGithubPullRequestUrl("https://github.com/acme/app/pull/42"), {
  owner: "acme",
  repo: "app",
  number: "42",
});

assert.deepEqual(
  parseGithubPullRequestUrl("https://github.com/acme/app/pull/42/files#diff-abc"),
  {
    owner: "acme",
    repo: "app",
    number: "42",
  },
  "GitHub PR URLs with a path/hash should still be readable",
);

assert.equal(parseGithubPullRequestUrl("https://example.com/acme/app/pull/42"), null);
assert.equal(parseGithubPullRequestUrl(null), null);
