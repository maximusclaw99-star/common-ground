/**
 * A small sliding-window limiter for the two actions that spend model
 * compute on a stranger's click: reading a resume and running the agent.
 *
 * Per process, on purpose. Vercel runs several instances, so the real ceiling
 * is this number times the instance count — coarse, but it turns "a script
 * can drain the warehouse quota in a minute" into "it can't". A shared
 * limiter (a Delta table or KV) is the upgrade if the demo ever gets
 * traffic; it is not worth a round trip per click today.
 */
export interface Limit { perKey: number; global: number; windowMs: number }

const hits = new Map<string, number[]>();

function count(key: string, now: number, windowMs: number): number[] {
  const kept = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, kept);
  return kept;
}

/** True when the call may proceed; records it if so. `key` is the session id. */
export function allow(name: string, key: string, limit: Limit, now = Date.now()): boolean {
  const mine = count(`${name}:${key}`, now, limit.windowMs);
  const all = count(`${name}:*`, now, limit.windowMs);
  if (mine.length >= limit.perKey || all.length >= limit.global) return false;
  mine.push(now);
  all.push(now);
  return true;
}

/** Tests only. */
export function resetLimits(): void {
  hits.clear();
}

const TEN_MINUTES = 10 * 60 * 1000;
/** Agent runs: a person re-runs a few times; nobody needs twenty in ten minutes. */
export const AGENT_LIMIT: Limit = { perKey: 8, global: 60, windowMs: TEN_MINUTES };
/** Resume reads: one or two per person; the global cap is the warehouse's comfort. */
export const RESUME_LIMIT: Limit = { perKey: 6, global: 40, windowMs: TEN_MINUTES };
