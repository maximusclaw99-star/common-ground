import {
  findUnlockable, prepareStudent, tier10, tier11, tier2, tier3, tier4, tier5,
  tier7or12, tier8, tier9, type StudentIndex,
} from "./predicates";
import { SPAN, baseFor, tierByRank } from "./tiers";
import type {
  AffinityResult, Person, ScorableStudent, TierHit, UnlockDemand,
} from "./types";

const DAY = 86_400_000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type Predicate = (idx: StudentIndex, person: Person) => TierHit | null;

/** Ranks 1 and 6 have no predicate and can therefore never be produced. */
const PREDICATES: readonly Predicate[] = [
  tier2, tier3, tier4, tier5, tier7or12, tier8, tier9, tier10, tier11,
];

/**
 * Freshness for a decaying hit, or null when the hit has aged out entirely.
 *
 * Decay decides whether a hit SURVIVES, not how far it slides. A four-day-old
 * career fair should stop being the opener, not become a slightly weaker one —
 * so below the floor the hit is dropped and the person falls to whatever tier
 * they otherwise match.
 */
function freshnessOf(hit: TierHit, now: number): number | null {
  const decay = tierByRank(hit.rank).decay;
  if (!decay || !hit.at) return 1;
  const parsed = Date.parse(hit.at);
  if (!Number.isFinite(parsed)) return null;
  // A future-dated event (a conference you're both attending next week) is
  // fresh, not negatively aged.
  const ageDays = Math.max(0, (now - parsed) / DAY);
  const f = 0.5 ** (ageDays / decay.halfLifeDays);
  return f < decay.floor ? null : f;
}

/**
 * Fills the tier's opener from the slots the matching predicate supplied.
 * Anything the predicate did not name falls back to a person-level default, so
 * a missing slot degrades to a slightly generic sentence rather than a literal
 * "{org}" landing in a message a student is about to send.
 */
function fillSlots(hit: TierHit, person: Person): string {
  const tier = tierByRank(hit.rank);
  const template = (hit.variant && tier.variants?.[hit.variant]) || tier.opener;
  const fallback: Record<string, string> = {
    company: person.currentCompany,
    theirTitle: person.currentTitle,
    function: person.currentFunction ?? "your field",
  };
  const slots = { ...fallback, ...(hit.slots ?? {}) };

  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? "")
    // A slot that legitimately resolved to nothing leaves a dangling clause.
    .replace(/\s*—\s*[.,]/g, ".")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function scoreAffinity(
  student: ScorableStudent,
  person: Person,
  opts?: { now?: number; index?: StudentIndex },
): AffinityResult {
  const idx = opts?.index ?? prepareStudent(student);
  const now = opts?.now ?? Date.now();

  const hits: TierHit[] = [];
  for (const predicate of PREDICATES) {
    const hit = predicate(idx, person);
    if (!hit) continue;
    const freshness = freshnessOf(hit, now);
    if (freshness === null) continue;         // aged out — dropped, not weakened
    hits.push({ ...hit, freshness });
  }

  hits.sort((a, b) => a.rank - b.rank);
  const primary: TierHit = hits[0] ?? { rank: 13, strength: 0, freshness: 1, evidence: [] };
  const secondaries = hits.slice(1, 4);

  // Corroboration is a WITHIN-BAND tie-breaker only. The ladder orders
  // conversation openers, not additive evidence: you open with exactly one
  // hook — your strongest — and the other commonalities make that same message
  // warmer rather than a different message. Letting three mediocre overlaps
  // outrank one shared fraternity would be wrong about how the message reads.
  const corroboration = 1 - 0.5 ** secondaries.length;
  const bonus = SPAN * clamp01(
    0.6 * primary.strength + 0.25 * primary.freshness + 0.15 * corroboration,
  );
  const base = baseFor(primary.rank);
  const tier = tierByRank(primary.rank);

  return {
    personId: person.id,
    rank: primary.rank,
    tierId: tier.id,
    tierLabel: tier.label,
    // One decimal, not an integer: the whole point of SPAN is to order people
    // *within* a band, and rounding to whole numbers collapses exactly that
    // signal (two tier-2 people both land on 98). The UI rounds for display.
    score: Math.round((base + bonus) * 10) / 10,
    evidence: [...primary.evidence, ...secondaries.flatMap((h) => h.evidence)],
    outreach: {
      guidance: tier.guidance,
      opener: fillSlots(primary, person),
      timing: tier.decay?.timing ?? null,
    },
    components: { strength: primary.strength, freshness: primary.freshness, corroboration, base },
    unlockable: findUnlockable(idx, person),
  };
}

export interface RankedPeople {
  results: AffinityResult[];
  /** Aggregated across everyone, for ordering the intake questions. */
  demand: UnlockDemand[];
}

export function rankPeople(
  student: ScorableStudent,
  people: readonly Person[],
  opts?: { now?: number; limit?: number },
): RankedPeople {
  const index = prepareStudent(student);
  const now = opts?.now ?? Date.now();

  const results = people.map((p) => scoreAffinity(student, p, { now, index }));

  // A total order with no float ties, so the demo is byte-stable across runs.
  results.sort((a, b) =>
    b.score - a.score ||
    a.rank - b.rank ||
    b.evidence.length - a.evidence.length ||
    a.personId.localeCompare(b.personId));

  const byField = new Map<string, UnlockDemand>();
  for (const r of results) {
    for (const u of r.unlockable) {
      const existing = byField.get(u.fieldId);
      if (existing) {
        existing.count += 1;
        if (existing.examples.length < 3) existing.examples.push(u.because);
        existing.rank = Math.min(existing.rank, u.rank);
      } else {
        byField.set(u.fieldId, { fieldId: u.fieldId, rank: u.rank, count: 1, examples: [u.because] });
      }
    }
  }
  const demand = [...byField.values()].sort((a, b) => b.count - a.count || a.rank - b.rank);

  return { results: opts?.limit ? results.slice(0, opts.limit) : results, demand };
}

/**
 * Which tiers the data you actually have can reach. Tiers 8 and 9 need post
 * and event rows that a real warehouse table may simply not carry — run this
 * before rehearsing, not on stage.
 */
export function coverage(people: readonly Person[]): Record<number, number> {
  const out: Record<number, number> = {};
  const bump = (rank: number, n: number) => { out[rank] = (out[rank] ?? 0) + n; };
  for (const p of people) {
    bump(2, p.education.some((e) => e.activities.length) ? 1 : 0);
    bump(3, p.roles.length > 1 ? 1 : 0);
    bump(4, p.roles.some((r) => r.clients.length || r.programs.length) ? 1 : 0);
    bump(5, p.hometown || p.highSchool || p.communities.length ? 1 : 0);
    bump(7, p.interests.length || p.projects.length ? 1 : 0);
    bump(8, p.posts.length ? 1 : 0);
    bump(9, p.events.length ? 1 : 0);
    bump(10, p.currentSeniority || p.currentTitle ? 1 : 0);
    bump(11, p.currentCompany ? 1 : 0);
  }
  return out;
}
