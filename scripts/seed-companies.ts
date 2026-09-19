/**
 * Loads data/companies.seed.json into the companies table.
 * Idempotent: re-running updates existing boards rather than duplicating.
 *
 *   npx tsx scripts/seed-companies.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAdminClient } from "../src/lib/supabase/admin";

interface SeedRow {
  name: string;
  slug: string;
  ats: "greenhouse" | "lever" | "ashby" | "workday";
  workdayHost?: string;
  workdaySite?: string;
  sector?: string;
  active?: boolean;
}

async function main() {
  const file = path.join(process.cwd(), "data", "companies.seed.json");
  const seed = JSON.parse(readFileSync(file, "utf8")) as SeedRow[];

  const rows = seed.map((c) => ({
    name: c.name,
    slug: c.slug,
    ats: c.ats,
    workday_host: c.workdayHost ?? null,
    workday_site: c.workdaySite ?? null,
    sector: c.sector ?? null,
    active: c.active ?? true,
  }));

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("companies")
    .upsert(rows, { onConflict: "ats,slug,workday_site", count: "exact" });

  if (error) throw error;
  console.log(`Seeded ${count ?? rows.length} employer boards.`);

  const bySector = seed.reduce<Record<string, number>>((acc, c) => {
    acc[c.sector ?? "other"] = (acc[c.sector ?? "other"] ?? 0) + 1;
    return acc;
  }, {});
  console.table(bySector);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
