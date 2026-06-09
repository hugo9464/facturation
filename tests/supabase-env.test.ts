import * as assert from "node:assert/strict";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "../lib/supabase/env";

const original = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

  assert.equal(getSupabaseUrl(), "https://example.supabase.co");
  assert.equal(getSupabasePublishableKey(), "publishable-key");

  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.equal(getSupabasePublishableKey(), "anon-key");

  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.throws(
    () => getSupabasePublishableKey(),
    /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
  );
} finally {
  restoreEnv();
}

console.log("supabase env tests passed");
