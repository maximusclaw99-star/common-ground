import {
  AffinityFactsSchema, EMPTY_FACTS, FactsMetaSchema, StudentProfileSchema,
  type AffinityFacts, type FactsMeta, type StudentProfile,
} from "@/lib/ai/schemas";
import { query } from "@/lib/databricks/sql";
import { DEFAULT_WEIGHTS, HomophilyWeightsSchema, type HomophilyWeights } from "@/lib/homophily/scorer";

/**
 * Where a demo browser's student lives when the app runs on more than one
 * server: a Delta table, one row per cookie id.
 *
 * The in-memory map in demo-store.ts is fine on a laptop and wrong on Vercel,
 * where each request can land on a different function instance — a resume
 * uploaded on one instance was invisible to the review page on the next. With
 * Databricks credentials present, every read comes from the table and every
 * write goes to it before the redirect, so the next request sees it wherever
 * it runs. Without them (tests, mock mode) the map stays in charge.
 *
 * Rows are parsed with the same zod schemas the Supabase path uses: a row
 * written by an older version of a schema degrades to defaults, never a crash.
 */

export interface PersistedStudent {
  profile: StudentProfile;
  facts: AffinityFacts;
  meta: FactsMeta;
  intakeCompletedAt: string | null;
  email: string | null;
  homophilyWeights: HomophilyWeights;
}

export const isPersistenceConfigured = (): boolean =>
  Boolean(process.env.DATABRICKS_HOST && process.env.DATABRICKS_TOKEN && process.env.DEMO_SESSIONS !== "memory");

const TABLE = "workspace.jobsearch.demo_sessions";

export async function loadPersisted(id: string): Promise<PersistedStudent | null> {
  // Latest write wins: saves append rather than merge, which is about twice
  // as fast on Delta and never contends. Old rows are harmless.
  const rows = await query(`SELECT student FROM ${TABLE} WHERE id = :id ORDER BY updated_at DESC LIMIT 1`, [{ name: "id", value: id }],
    { waitTimeout: "15s", pollForMs: 10_000 });
  const raw = rows[0]?.student;
  if (typeof raw !== "string" || !raw) return null;
  return revive(raw);
}

export async function savePersisted(id: string, student: PersistedStudent): Promise<void> {
  await query(
    `INSERT INTO ${TABLE} (id, student, created_at, updated_at) VALUES (:id, :student, current_timestamp(), current_timestamp())`,
    [{ name: "id", value: id }, { name: "student", value: JSON.stringify(student) }],
    { waitTimeout: "20s", pollForMs: 15_000 },
  );
}

/** JSON from the table -> a StoredStudent, field by field, with defaults where the row is old or odd. Pure; tested. */
export function revive(raw: string): PersistedStudent | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const profile = StudentProfileSchema.safeParse(o.profile);
  if (!profile.success) return null;
  const facts = AffinityFactsSchema.safeParse({ ...EMPTY_FACTS, ...(o.facts as object ?? {}) });
  const meta = FactsMetaSchema.safeParse(o.meta ?? {});
  const weights = HomophilyWeightsSchema.safeParse(o.homophilyWeights ?? DEFAULT_WEIGHTS);
  return {
    profile: profile.data,
    facts: facts.success ? facts.data : { ...EMPTY_FACTS },
    meta: meta.success ? meta.data : {},
    intakeCompletedAt: typeof o.intakeCompletedAt === "string" ? o.intakeCompletedAt : null,
    email: typeof o.email === "string" ? o.email : null,
    homophilyWeights: weights.success ? weights.data : { ...DEFAULT_WEIGHTS },
  };
}
