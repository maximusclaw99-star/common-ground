import catalogJson from "@/../databricks/data/learning_catalog.json";
import { query } from "@/lib/databricks/sql";

/**
 * How to close one posting requirement: a certification or course with real
 * cost and time. The warehouse copy (workspace.jobsearch.learning_catalog,
 * read through the learning_options() UC function) is the tool the agent
 * calls; the bundled copy is the same rows, so mock mode answers identically.
 */
export interface LearningOption {
  id: string;
  requirement: string;
  kind: "certification" | "course";
  title: string;
  provider: string;
  cost_usd: number;
  hours: number;
  weeks: number;
  format: string;
  url: string;
  note: string;
}

const bundled = catalogJson as LearningOption[];
const norm = (s: string) => s.trim().toLowerCase();

export function learningOptionsLocal(requirement: string): LearningOption[] {
  const key = norm(requirement);
  return bundled
    .filter((o) => norm(o.requirement) === key)
    .sort((a, b) => a.cost_usd - b.cost_usd || a.weeks - b.weeks);
}

/** The Unity Catalog function, called as a tool. Falls back to the bundled rows on any failure. */
export async function learningOptionsWarehouse(requirement: string): Promise<LearningOption[]> {
  try {
    const rows = await query(
      "SELECT id, title, provider, kind, cost_usd, hours, weeks, format, url, note FROM workspace.jobsearch.learning_options(:req)",
      [{ name: "req", value: requirement }],
      { waitTimeout: "20s", pollForMs: 10_000 },
    );
    if (!rows.length) return learningOptionsLocal(requirement);
    return rows.map((r) => ({
      id: String(r.id), requirement, kind: (String(r.kind) === "course" ? "course" : "certification"),
      title: String(r.title), provider: String(r.provider), cost_usd: Number(r.cost_usd ?? 0),
      hours: Number(r.hours ?? 0), weeks: Number(r.weeks ?? 0), format: String(r.format ?? ""),
      url: String(r.url ?? ""), note: String(r.note ?? ""),
    }));
  } catch (err) {
    console.warn("[plan] learning_options() failed, using bundled catalog", err instanceof Error ? err.message : err);
    return learningOptionsLocal(requirement);
  }
}
