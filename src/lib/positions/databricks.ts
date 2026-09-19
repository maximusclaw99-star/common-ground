import { query } from "@/lib/databricks/sql";
import type { Position, PositionRequirement, PositionsProvider, PositionsQuery } from "./types";

/**
 * Openings from the warehouse: `positions` + `companies` + `position_requirements`
 * in workspace.jobsearch (databricks/sql/00_schema.sql).
 *
 * Scoring happens in the app (`./score.ts`), not in `v_student_position_matches`,
 * because the student on the page is whoever is signed in — or the demo student
 * held in memory — and neither is a row in the warehouse's `students` table.
 * The view and the TS scorer carry the same weights, so a number seen here and
 * a number queried in Genie agree.
 *
 * The whole pool is 120 rows, so it is fetched once per request and ordered
 * in memory: target-company postings first, then by opening date. Filtering by
 * company would be wrong for the same reason it is wrong for people — a role
 * the student did not think to name is still a role.
 */
export const databricksPositionsProvider: PositionsProvider = {
  name: "databricks",
  async getPositions({ companies, limit = 400 }: PositionsQuery): Promise<Position[]> {
    const rows = await query(`
      select p.id, p.title, c.name as company, p.company_id, p.type, p.vertical, p.location,
             cast(p.opens_on as string) as opens_on, cast(p.closes_on as string) as closes_on,
             p.target_grad_years, p.description, p.posted_url,
             (select collect_list(named_struct('requirement', r.requirement, 'kind', r.kind, 'required', r.required))
                from workspace.jobsearch.position_requirements r where r.position_id = p.id) as requirements
      from workspace.jobsearch.positions p
      join workspace.jobsearch.companies c on c.id = p.company_id
      order by p.opens_on, p.id
      limit ${Number(limit)}
    `);
    const positions = rows.map(toPosition);
    const wanted = new Set(companies.map((c) => c.trim().toLowerCase()));
    const matched = positions.filter((p) => wanted.has(p.company.toLowerCase()));
    const rest = positions.filter((p) => !matched.includes(p));
    return [...matched, ...rest];
  },
};

/** ARRAY and STRUCT columns arrive as JSON text; everything else is a string or null. */
const parse = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== "string" || v === "") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};
const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

const KINDS = new Set(["skill", "certification", "degree", "experience"]);

/** Warehouse row -> Position. Exported for the parsing test. */
export function toPosition(row: Record<string, unknown>): Position {
  const type = String(row.type ?? "internship");
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    companyId: str(row.company_id),
    type: (type === "full_time" || type === "research" ? type : "internship"),
    vertical: String(row.vertical ?? ""),
    location: str(row.location),
    opensOn: String(row.opens_on ?? ""),
    closesOn: String(row.closes_on ?? ""),
    targetGradYears: parse<unknown[]>(row.target_grad_years, []).map(Number).filter((n) => !Number.isNaN(n)),
    description: str(row.description),
    url: str(row.posted_url),
    requirements: parse<Record<string, unknown>[]>(row.requirements, [])
      .filter((r) => KINDS.has(String(r.kind)))
      .map((r): PositionRequirement => ({
        requirement: String(r.requirement ?? ""),
        kind: String(r.kind) as PositionRequirement["kind"],
        // Booleans inside a struct come back as JSON true/false, but a plain
        // BOOLEAN column would be the string "true"; accept both.
        required: r.required === true || r.required === "true",
      })),
    source: "databricks",
  };
}
