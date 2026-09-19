import type { Person } from "@/lib/affinity/types";
import type { PeopleProvider, PeopleQuery } from "./types";

/**
 * Reads people from a Databricks SQL warehouse.
 *
 * This is the one file the data side owns. Nothing in the UI changes when it
 * lands: the engine consumes `Person`, and a provider's only job is to produce
 * that shape. `coverage()` in the affinity module reports which tiers the rows
 * coming back can actually reach — run it before relying on tiers 8 and 9,
 * which need post and event rows a warehouse table may simply not carry.
 *
 * The warehouse side is `workspace.jobsearch.v_people_provider` (see
 * databricks/sql/02_views.sql), a view that already emits Person's column
 * names, so this file is a transport, not a mapper. Two Statement API facts
 * shape the code below: rows arrive positionally (zip with the manifest), and
 * ARRAY/STRUCT columns arrive as JSON strings with integers stringified.
 *
 * Mirrors the mock provider's ordering: people at the student's target
 * companies first, then everyone else. A shared fraternity is a shared
 * fraternity wherever they work, so the rest are ranked, not filtered.
 *
 * Privacy: rows fetched here are scored in memory and never written to
 * Supabase. We hold no standing database of people who did not sign up.
 */
export const databricksPeopleProvider: PeopleProvider = {
  name: "databricks",
  async getPeople({ companies, limit = 400 }: PeopleQuery): Promise<Person[]> {
    const host = process.env.DATABRICKS_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = process.env.DATABRICKS_TOKEN;
    const warehouseId =
      process.env.DATABRICKS_WAREHOUSE_ID ?? process.env.DATABRICKS_HTTP_PATH?.split("/").pop();
    if (!host || !token || !warehouseId) {
      throw new Error(
        "databricks people provider needs DATABRICKS_HOST, DATABRICKS_TOKEN and DATABRICKS_WAREHOUSE_ID (or DATABRICKS_HTTP_PATH)",
      );
    }

    const params = companies.map((c, i) => ({ name: `c${i}`, value: c }));
    const targetList = params.map((p) => `:${p.name}`).join(", ") || "''";
    const statement = `
      select * from workspace.jobsearch.v_people_provider
      order by case when lower(current_company) in (${targetList}) then 0 else 1 end,
               openness_to_chat desc
      limit ${Number(limit)}
    `;

    const response = await fetch(`https://${host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        warehouse_id: warehouseId,
        statement,
        parameters: params.map((p) => ({ ...p, value: p.value.toLowerCase() })),
        wait_timeout: "30s",
        disposition: "INLINE",
        format: "JSON_ARRAY",
      }),
    });
    if (!response.ok) {
      throw new Error(`Databricks query failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as StatementResponse;
    if (body.status?.state !== "SUCCEEDED") {
      throw new Error(`Databricks statement ${body.status?.state}: ${body.status?.error?.message ?? ""}`);
    }
    const columns = body.manifest?.schema?.columns?.map((c) => c.name) ?? [];
    const fetchedAt = new Date().toISOString();
    return (body.result?.data_array ?? []).map((values) => {
      const row: Record<string, unknown> = {};
      columns.forEach((name, i) => (row[name] = values[i]));
      return toPerson(row, fetchedAt);
    });
  },
};

interface StatementResponse {
  status?: { state: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: { name: string }[] } };
  result?: { data_array?: (string | null)[][] };
}

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
const arr = (v: unknown): string[] => parse<unknown[]>(v, []).map(String);
/** Integers inside structs come back as "2014"; endYear null must stay null (it means "current"). */
const year = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/**
 * Warehouse row -> Person. Every collection defaults to an empty array rather
 * than undefined: an optional array means every predicate needs a `?? []` and
 * one of them will be forgotten.
 */
function toPerson(row: Record<string, unknown>, fetchedAt: string): Person {
  type Raw = Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    fullName: String(row.full_name ?? ""),
    headline: str(row.headline),
    profileUrl: str(row.profile_url),
    currentCompany: String(row.current_company ?? ""),
    currentTitle: String(row.current_title ?? ""),
    currentFunction: str(row.current_function),
    currentIndustry: str(row.current_industry),
    currentSeniority: (str(row.current_seniority) as Person["currentSeniority"]) ?? null,
    location: str(row.location),
    hometown: str(row.hometown),
    highSchool: str(row.high_school),
    communities: arr(row.communities),
    education: parse<Raw[]>(row.education, []).map((e) => ({
      school: String(e.school ?? ""),
      degree: str(e.degree),
      field: str(e.field),
      startYear: year(e.startYear),
      endYear: year(e.endYear),
      activities: Array.isArray(e.activities) ? e.activities.map(String) : [],
    })),
    roles: parse<Raw[]>(row.roles, []).map((r) => ({
      company: String(r.company ?? ""),
      title: String(r.title ?? ""),
      function: str(r.function),
      industry: str(r.industry),
      seniority: (str(r.seniority) as Person["currentSeniority"]) ?? null,
      startYear: year(r.startYear),
      endYear: year(r.endYear),
      clients: Array.isArray(r.clients) ? r.clients.map(String) : [],
      programs: Array.isArray(r.programs) ? r.programs.map(String) : [],
    })),
    interests: arr(row.interests),
    projects: arr(row.projects),
    posts: parse<Raw[]>(row.posts, []).map((p) => ({
      id: String(p.id ?? ""),
      kind: (str(p.kind) ?? "post") as Person["posts"][number]["kind"],
      title: String(p.title ?? ""),
      excerpt: str(p.excerpt),
      topics: Array.isArray(p.topics) ? p.topics.map(String) : [],
      url: str(p.url),
      publishedAt: String(p.publishedAt ?? ""),
    })),
    events: parse<Raw[]>(row.events, []).map((e) => ({
      name: String(e.name ?? ""),
      kind: (str(e.kind) ?? "recruiting_event") as Person["events"][number]["kind"],
      date: String(e.date ?? ""),
      org: str(e.org),
    })),
    source: "databricks",
    fetchedAt,
  };
}
