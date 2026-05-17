import * as assert from "node:assert/strict";
import {
  buildPreviewAutoAuthAbsoluteUrl,
  buildPreviewAutoAuthUrl,
  getConfiguredAppUrl,
  sanitizePreviewNextPath,
} from "../lib/todo-preview";

const originalEnv = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SITE_URL: process.env.SITE_URL,
  APP_URL: process.env.APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

function resetEnv() {
  for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearAppUrlEnv() {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
  delete process.env.APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
}

try {
  clearAppUrlEnv();
  process.env.NEXT_PUBLIC_SITE_URL = "https://facturation.example.com/";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "facturation-git-main-user.vercel.app";
  assert.equal(
    getConfiguredAppUrl(),
    "https://facturation.example.com",
    "explicit public site URL should be preferred and normalized",
  );

  clearAppUrlEnv();
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "facturation-git-main-user.vercel.app";
  assert.equal(
    getConfiguredAppUrl(),
    "https://facturation-git-main-user.vercel.app",
    "Vercel production URL should be used instead of request preview hosts",
  );

  clearAppUrlEnv();
  assert.equal(
    getConfiguredAppUrl(),
    null,
    "missing deployment URL should fall back to request headers",
  );

  assert.equal(sanitizePreviewNextPath("/projects/abc?tab=todo#task-53"), "/projects/abc?tab=todo#task-53");
  assert.equal(sanitizePreviewNextPath("https://evil.test/projects"), "/");
  assert.equal(sanitizePreviewNextPath("//evil.test/projects"), "/");
  assert.equal(
    buildPreviewAutoAuthUrl("/todo?task=53"),
    "/auth/preview?next=%2Ftodo%3Ftask%3D53",
    "auth preview URL should wrap the exact protected app path",
  );
  assert.equal(
    buildPreviewAutoAuthAbsoluteUrl("facturation-git-branch-user.vercel.app/", "/projects/p1"),
    "https://facturation-git-branch-user.vercel.app/auth/preview?next=%2Fprojects%2Fp1",
    "absolute preview auth URL should normalize the deployment origin",
  );
} finally {
  resetEnv();
}

console.log("todo preview URL tests passed");
