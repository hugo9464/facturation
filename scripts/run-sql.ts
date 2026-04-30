import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/run-sql.ts <path-to-sql-file>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    const content = await readFile(resolve(file), "utf-8");
    console.log(`Running ${file}...`);
    await sql.unsafe(content);
    console.log("✓ Applied successfully");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});
