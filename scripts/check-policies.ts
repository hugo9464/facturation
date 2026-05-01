import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const rows = await sql`
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname IN ('public', 'storage')
      ORDER BY tablename, policyname
    `;
    console.log("Active RLS policies:");
    for (const r of rows) {
      console.log(`  ${r.schemaname}.${r.tablename} → ${r.policyname}`);
    }
    const tables = await sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log("\nRLS enabled per table:");
    for (const t of tables) {
      console.log(`  ${t.tablename} → ${t.rowsecurity ? "ON" : "OFF"}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
