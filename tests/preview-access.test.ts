import * as assert from "node:assert/strict";
import {
  buildPreviewAccessUrl,
  sanitizePreviewNextPath,
} from "../lib/preview-access";

const previewUrl = "https://facturation-git-task-12.vercel.app/projects/abc?tab=todo#notes";

assert.equal(
  sanitizePreviewNextPath("/projects/abc?tab=todo"),
  "/projects/abc?tab=todo",
);
assert.equal(sanitizePreviewNextPath(""), "/");
assert.equal(sanitizePreviewNextPath("https://evil.test/phish"), "/");
assert.equal(sanitizePreviewNextPath("//evil.test/phish"), "/");

assert.equal(
  buildPreviewAccessUrl(previewUrl, {
    previewLoginSecret: "login-secret",
    vercelAutomationBypassSecret: "vercel-secret",
  }),
  "https://facturation-git-task-12.vercel.app/api/dev/preview-login?token=login-secret&next=%2Fprojects%2Fabc%3Ftab%3Dtodo%23notes&x-vercel-protection-bypass=vercel-secret&x-vercel-set-bypass-cookie=true",
);

assert.equal(
  buildPreviewAccessUrl(previewUrl, {
    previewLoginSecret: "login-secret",
  }),
  "https://facturation-git-task-12.vercel.app/api/dev/preview-login?token=login-secret&next=%2Fprojects%2Fabc%3Ftab%3Dtodo%23notes",
);

assert.equal(
  buildPreviewAccessUrl(previewUrl, {}),
  previewUrl,
);

console.log("preview access tests passed");
