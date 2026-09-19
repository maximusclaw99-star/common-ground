import {
  AffinityFactsSchema, EMPTY_FACTS, FactsMetaEntrySchema,
  type AffinityFacts, type FactsMeta,
} from "@/lib/ai/schemas";
import { fieldById } from "./fields";
import type { Field } from "./types";

export interface Answer {
  fieldId: string;
  /** The structured value. `[]` or null is a legitimate answer ("none"). */
  value: unknown;
  source: "answer" | "dictation" | "derived" | "resume";
  confidence?: number;
  /** The student's own words, when the answer came from speech. */
  raw?: string | null;
}

/** An explicit "none" — the thing that stops the questionnaire nagging. */
export const skipAnswer = (field: Field): Answer => ({
  fieldId: field.id,
  value: emptyFor(field),
  source: "answer",
  confidence: 1,
  raw: null,
});

function emptyFor(field: Field): unknown {
  switch (field.input) {
    case "chips": case "date-list": return [];
    default: return null;
  }
}

export interface ApplyResult {
  facts: AffinityFacts;
  meta: FactsMeta;
}

/**
 * Merges answers into the stored facts. Fields not mentioned are left exactly
 * as they were, so a student can answer one screen and come back next week.
 *
 * Every write is validated against AffinityFactsSchema, in the same
 * zod-at-the-boundary style the rest of the app already uses for jsonb.
 */
export function applyAnswers(
  current: Partial<AffinityFacts>,
  currentMeta: FactsMeta,
  answers: readonly Answer[],
  now: string = new Date().toISOString(),
): ApplyResult {
  const facts: Record<string, unknown> = { ...EMPTY_FACTS, ...current };
  const meta: FactsMeta = { ...currentMeta };

  for (const answer of answers) {
    const field = fieldById(answer.fieldId);
    if (!field) throw new Error(`Unknown intake field: ${answer.fieldId}`);

    facts[field.path] = normalise(field, answer.value);
    meta[field.id] = FactsMetaEntrySchema.parse({
      source: answer.source,
      confidence: answer.confidence ?? 1,
      raw: answer.raw ?? null,
      updatedAt: now,
    });
  }

  return { facts: AffinityFactsSchema.parse(facts), meta };
}

/** Trims, de-duplicates and drops blanks, so "Python, Python , " is one chip. */
function normalise(field: Field, value: unknown): unknown {
  if (field.input === "chips") {
    const list = Array.isArray(value) ? value : value == null ? [] : [value];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
      const s = String(item).trim();
      if (!s || seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase());
      out.push(s);
    }
    return out;
  }
  if (field.input === "date-list") return Array.isArray(value) ? value : [];
  if (typeof value === "string") {
    const s = value.trim();
    return s === "" ? null : s;
  }
  return value ?? null;
}
