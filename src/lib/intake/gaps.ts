import type { AffinityFacts, FactsMeta, StudentProfile } from "@/lib/ai/schemas";
import { tierByRank } from "@/lib/affinity/tiers";
import type { UnlockDemand } from "@/lib/affinity/types";
import { derive } from "./derive";
import { FIELDS, fieldWeight } from "./fields";
import { routeUncertainties } from "./uncertainties";
import type { Field, Gap, GapReason } from "./types";

/** Below this, an extracted value is re-shown as a confirmation. */
export const CONFIDENCE_BAR = 0.6;

const DAY = 86_400_000;

const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0);

/**
 * Time-sensitive values quietly stop being true. An event past the tier-9
 * window can no longer produce a match, so it should not count as an answer.
 */
function liveValue(field: Field, value: unknown, now: number): unknown {
  if (field.path !== "events" || !Array.isArray(value)) return value;
  const decay = tierByRank(9).decay!;
  const maxAgeDays = decay.halfLifeDays * Math.log2(1 / decay.floor);
  return (value as AffinityFacts["events"]).filter((e) => {
    const at = Date.parse(e.date);
    return Number.isFinite(at) && (now - at) / DAY <= maxAgeDays;
  });
}

export interface ComputeGapsInput {
  profile: StudentProfile;
  facts: Partial<AffinityFacts>;
  meta: FactsMeta;
  /** From rankPeople(...).demand — real people this answer would promote. */
  demand?: readonly UnlockDemand[];
  now?: number;
  fields?: readonly Field[];
}

export function computeGaps(input: ComputeGapsInput): Gap[] {
  const { profile, facts, meta } = input;
  const now = input.now ?? Date.now();
  const fields = input.fields ?? FIELDS;

  const { byField: uncertainByField } = routeUncertainties(profile.uncertainties ?? []);
  const demandByField = new Map((input.demand ?? []).map((d) => [d.fieldId, d]));

  const gaps: Gap[] = [];

  for (const field of fields) {
    const entry = meta[field.id];
    const derived = field.resumeDerivable ? derive(field, profile) : null;
    const stored = facts[field.path];
    const current = liveValue(field, stored ?? derived, now);

    const uncertainNotes = uncertainByField.get(field.id) ?? [];
    let reason: GapReason | null = null;

    if (uncertainNotes.length && entry?.source !== "answer") {
      // The extractor said outright that it wasn't sure. Ask, and show why.
      reason = "flagged_uncertain";
    } else if (field.id === "school_canonical" && entry?.source !== "answer") {
      // Always confirmed exactly once, however confident extraction was. A
      // wrong school silently zeroes tiers 2 and 3 for every single person,
      // which is not a risk worth saving one tap on.
      reason = "confirm";
    } else if (!entry) {
      // No meta means we have never asked and the student has never answered.
      reason = isEmpty(current) ? "absent" : "confirm";
    } else if (entry.confidence < CONFIDENCE_BAR) {
      reason = "low_confidence";
    } else if (isEmpty(current) && !isEmpty(stored)) {
      // There WAS a value and time ate it — the events case.
      reason = "stale";
    } else if (isEmpty(current)) {
      // An answered-empty field is answered. Tapping "I'm not in any" writes
      // `[]` with source "answer", and the question must never come back —
      // without this distinction the questionnaire nags forever and the
      // student concludes the product is broken.
      reason = entry.source === "answer" ? null : "empty";
    } else if (
      field.minAnswers && Array.isArray(current) &&
      current.length < field.minAnswers && entry.source !== "answer"
    ) {
      reason = "below_min";
    }

    if (!reason) continue;

    const demand = demandByField.get(field.id);
    gaps.push({
      field,
      reason,
      prefill: isEmpty(current) ? (isEmpty(derived) ? null : derived) : current,
      unlocks: field.tiers,
      demandCount: demand?.count ?? 0,
      demandExamples: demand?.examples ?? [],
      priority: priorityOf(field, reason, demand?.count ?? 0),
      uncertaintyNote: uncertainNotes[0] ?? null,
    });
  }

  // Declaration order breaks ties, so the whole output is deepEqual-able.
  const order = new Map(fields.map((f, i) => [f.id, i]));
  gaps.sort((a, b) =>
    b.priority - a.priority ||
    (order.get(a.field.id) ?? 0) - (order.get(b.field.id) ?? 0));
  return gaps;
}

function priorityOf(field: Field, reason: GapReason, demandCount: number): number {
  return (
    (reason === "flagged_uncertain" ? 1.5 : 0) +
    (field.required ? 1 : 0) +
    fieldWeight(field) +
    // Real demand, compressed: twenty-five people is not twenty-five times more
    // urgent than one, but it is meaningfully more urgent.
    0.4 * (Math.log1p(demandCount) / Math.log1p(25)) -
    // Among otherwise equal questions, cheap ones go first.
    (field.input === "longtext" ? 0.3 : 0)
  );
}

/** The catch-all box for uncertainties that matched no question. */
export const unroutedUncertainties = (profile: StudentProfile): string[] =>
  routeUncertainties(profile.uncertainties ?? []).unrouted;
