import { query } from "@/lib/databricks/sql";
import type { Position, PositionRequirement, PositionsProvider, PositionsQuery } from "./types";

/**
 * Openings from the warehouse.
 *
 * The source is the Summer 2027 Internships Directory — 6,600+ real postings
 * in workspace.jobsearch.internships (databricks/sql/05_directory.sql). It
 * carries a category, company, title, location, a just-posted flag and the
 * live application URL, and nothing else: no posting text, no requirements,
 * no dates. So:
 *
 *  - requirements come from category_requirements, what roles in that
 *    category typically ask for, and every Position says so
 *    (`requirementsTypical`); the UI repeats it next to the list.
 *  - dates are stand-ins (`datesKnown: false`): the export date as opens_on
 *    and ninety days later as closes_on, so window logic keeps working and
 *    the UI shows "posted" rather than a made-up countdown.
 *
 * The whole directory is one Statement API call (~1.4 s, one chunk) and is
 * ordered in memory: target-company postings first, then just-posted, then
 * by company. Filtering happens in the scorer, by the student's verticals.
 */
const EXPORTED_ON = "2026-09-19";
const STAND_IN_CLOSE = "2026-12-18";

const POOL_TTL_MS = 10 * 60 * 1000;
let poolPromise: Promise<Position[]> | null = null;
let poolFetchedAt = 0;

/** One directory fetch per server instance, kept ten minutes; concurrent first requests share it. */
function pool(): Promise<Position[]> {
  if (!poolPromise || Date.now() - poolFetchedAt > POOL_TTL_MS) {
    poolFetchedAt = Date.now();
    poolPromise = fetchDirectory().catch((err) => { poolPromise = null; throw err; });
  }
  return poolPromise;
}

export const databricksPositionsProvider: PositionsProvider = {
  name: "databricks",
  async getPositions({ companies, limit = 8000 }: PositionsQuery): Promise<Position[]> {
    const positions = await pool();
    const wanted = new Set(companies.map((c) => c.trim().toLowerCase()));
    const matched = positions.filter((p) => wanted.has(p.company.toLowerCase()));
    const rest = positions.filter((p) => !matched.includes(p));
    return [...matched, ...rest].slice(0, limit);
  },
};

async function fetchDirectory(): Promise<Position[]> {
    const rows = await query(`
      select i.id, i.category, i.company, i.title, i.location, i.just_posted, i.apply_url,
             coalesce(max(c.vertical), 'other') as vertical,
             collect_list(named_struct('requirement', c.requirement, 'kind', c.kind, 'required', c.required)) as requirements
      from workspace.jobsearch.internships i
      left join workspace.jobsearch.category_requirements c on c.category = i.category
      group by i.id, i.category, i.company, i.title, i.location, i.just_posted, i.apply_url
      order by i.just_posted desc, i.company, i.id
    `, [], { waitTimeout: "30s" });
    return rows.map(toDirectoryPosition);
}

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

const parseRequirements = (v: unknown): PositionRequirement[] =>
  parse<Record<string, unknown>[]>(v, [])
    .filter((r) => r && KINDS.has(String(r.kind)) && r.requirement != null)
    .map((r) => ({
      requirement: String(r.requirement),
      kind: String(r.kind) as PositionRequirement["kind"],
      // Booleans inside a struct come back as JSON true/false; a plain column would be "true".
      required: r.required === true || r.required === "true",
    }));

/** Directory row -> Position. Exported for the parsing test. */
export function toDirectoryPosition(row: Record<string, unknown>): Position {
  const justPosted = row.just_posted === true || row.just_posted === "true";
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    companyId: null,
    type: "internship",
    vertical: String(row.vertical ?? "other"),
    category: str(row.category),
    location: str(row.location),
    opensOn: EXPORTED_ON,
    closesOn: STAND_IN_CLOSE,
    datesKnown: false,
    justPosted,
    targetGradYears: [2027, 2028, 2029],
    description: null,
    url: str(row.apply_url),
    requirements: parseRequirements(row.requirements),
    requirementsTypical: true,
    source: "databricks",
  };
}

/** Warehouse `positions` row -> Position (the synthetic set with real dates and per-posting requirements). */
export function toPosition(row: Record<string, unknown>): Position {
  const type = String(row.type ?? "internship");
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    companyId: str(row.company_id),
    type: (type === "full_time" || type === "research" ? type : "internship"),
    vertical: String(row.vertical ?? ""),
    category: null,
    location: str(row.location),
    opensOn: String(row.opens_on ?? ""),
    closesOn: String(row.closes_on ?? ""),
    datesKnown: true,
    justPosted: false,
    targetGradYears: parse<unknown[]>(row.target_grad_years, []).map(Number).filter((n) => !Number.isNaN(n)),
    description: str(row.description),
    url: str(row.posted_url),
    requirements: parseRequirements(row.requirements),
    requirementsTypical: false,
    source: "databricks",
  };
}
