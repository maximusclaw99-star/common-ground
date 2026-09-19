import { AI_QUERY_MODEL, query } from "@/lib/databricks/sql";
import type { Gap } from "./gaps";
import type { Position } from "./types";

/**
 * How to close one gap — the second of the product's two AI touchpoints, and
 * the same prompt `v_skill_gap_advice` runs in the warehouse
 * (databricks/sql/02_views.sql). It is called directly rather than through
 * that view because the view is keyed on the warehouse's students table and
 * the student on the page is not a row in it.
 *
 * One model call per (position, requirement), cached for the life of the
 * server process. It never blocks a page: the caller races it against a
 * deadline and renders the gap list without advice if the model is slow.
 */
const cache = new Map<string, Promise<string | null>>();

export function skillGapAdvice(position: Position, gap: Gap, opts?: { timeoutMs?: number }): Promise<string | null> {
  const key = `${position.id}::${gap.requirement}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchAdvice(position, gap).catch((err) => {
      console.warn("[positions] skill-gap advice failed", err instanceof Error ? err.message : err);
      cache.delete(key);
      return null;
    });
    cache.set(key, pending);
  }
  const timeoutMs = opts?.timeoutMs ?? 8_000;
  return Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function fetchAdvice(position: Position, gap: Gap): Promise<string | null> {
  const prompt =
    `A college student wants the role "${position.title}" at ${position.company}. ` +
    `The posting lists "${gap.requirement}" (${gap.kind}) as ${gap.required ? "required" : "preferred"} and the student does not have it yet. ` +
    "In 2-3 plain sentences, tell them concretely how to close this gap: what to study or do, a realistic timeline, " +
    "and approximate cost if any. Do not suggest applying anyway, and do not suggest any automated outreach.";
  const rows = await query(
    "SELECT ai_query(:model, :prompt) AS advice",
    [{ name: "model", value: AI_QUERY_MODEL }, { name: "prompt", value: prompt }],
    { waitTimeout: "30s", pollForMs: 30_000 },
  );
  const advice = rows[0]?.advice;
  return typeof advice === "string" && advice.trim() ? advice.trim() : null;
}

/** What mock mode shows in the same slot, so the page reads the same without a warehouse. */
export function mockAdvice(gap: Gap): string {
  if (/security\+/i.test(gap.requirement)) {
    return "CompTIA Security+ is a self-study exam most students pass in 2–3 months at a few hours a week; " +
      "the exam voucher is about $400 and a good course or book is under $100. Book the exam date first — it is the only thing that makes the studying happen.";
  }
  return gap.kind === "certification"
    ? `${gap.requirement} is a certification you can earn before this window closes: budget 4–8 weeks of evening study, sit the exam early, and list it as "in progress" on your resume the day you register.`
    : `${gap.requirement} is a skill you can show in 3–4 weeks: pick one small project that genuinely needs it, finish it, and put the repo or the artifact on your resume — a line you can talk about beats a course certificate.`;
}
