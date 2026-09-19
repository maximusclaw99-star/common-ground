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
 * Privacy: rows fetched here are scored in memory and never written to
 * Supabase. We hold no standing database of people who did not sign up.
 */
export const databricksPeopleProvider: PeopleProvider = {
  name: "databricks",
  async getPeople({ companies, limit = 200 }: PeopleQuery): Promise<Person[]> {
    const host = process.env.DATABRICKS_HOST;
    const httpPath = process.env.DATABRICKS_HTTP_PATH;
    const token = process.env.DATABRICKS_TOKEN;
    if (!host || !httpPath || !token) {
      throw new Error(
        "databricks people provider needs DATABRICKS_HOST, DATABRICKS_HTTP_PATH and DATABRICKS_TOKEN",
      );
    }

    const statement = `
      select * from people
      where current_company in (${companies.map((_, i) => `:c${i}`).join(", ") || "''"})
      limit ${Number(limit)}
    `;

    const response = await fetch(`https://${host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        warehouse_id: httpPath.split("/").pop(),
        statement,
        parameters: companies.map((c, i) => ({ name: `c${i}`, value: c })),
        wait_timeout: "30s",
      }),
    });
    if (!response.ok) {
      throw new Error(`Databricks query failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    return (body?.result?.data_array ?? []).map(toPerson);
  },
};

/**
 * Warehouse row -> Person. Every collection defaults to an empty array rather
 * than undefined: an optional array means every predicate needs a `?? []` and
 * one of them will be forgotten.
 */
function toPerson(row: Record<string, unknown>): Person {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  return {
    id: String(row.id ?? ""),
    fullName: String(row.full_name ?? ""),
    headline: (row.headline as string) ?? null,
    profileUrl: (row.profile_url as string) ?? null,
    currentCompany: String(row.current_company ?? ""),
    currentTitle: String(row.current_title ?? ""),
    currentFunction: (row.current_function as string) ?? null,
    currentIndustry: (row.current_industry as string) ?? null,
    currentSeniority: (row.current_seniority as Person["currentSeniority"]) ?? null,
    location: (row.location as string) ?? null,
    hometown: (row.hometown as string) ?? null,
    highSchool: (row.high_school as string) ?? null,
    communities: arr(row.communities),
    education: (row.education as Person["education"]) ?? [],
    roles: (row.roles as Person["roles"]) ?? [],
    interests: arr(row.interests),
    projects: arr(row.projects),
    posts: (row.posts as Person["posts"]) ?? [],
    events: (row.events as Person["events"]) ?? [],
    source: "databricks",
    fetchedAt: new Date().toISOString(),
  };
}
