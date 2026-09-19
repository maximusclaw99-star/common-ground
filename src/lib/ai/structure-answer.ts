import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Field } from "@/lib/intake/types";
import { IntakeEventSchema, TransitionSchema } from "./schemas";
import { anthropic, MODEL } from "./client";

/**
 * Turns a dictated (or messily typed) answer into the typed value one field
 * expects.
 *
 * This runs on the server because an in-browser Anthropic call would ship the
 * API key to every visitor. Latency is fine: it fires when the student stops
 * speaking, not per word, and the raw transcript renders optimistically while
 * the chips resolve underneath it.
 */

/**
 * The output schema is built PER FIELD. One generic structurer would need a
 * discriminated union output and would be measurably worse at all of them.
 */
function valueSchemaFor(field: Field) {
  switch (field.input) {
    case "chips": return z.array(z.string());
    case "date-list": return z.array(IntakeEventSchema);
    case "pair": return TransitionSchema.nullable();
    case "date": return z.string().nullable();
    default: return z.string().nullable();
  }
}

const SYSTEM = `You convert a student's spoken answer into the exact value one form field expects.

Rules:
- Return only what the student said. Never add an item they did not mention.
- Do not expand an acronym unless the student expanded it. If they said "BAP", the value is "BAP".
  Matching acronyms to organisations is done elsewhere, deterministically; guessing here would put
  an unverified affiliation into someone's connection list.
- Strip filler ("um", "uh", "like", "you know") and false starts, but keep the student's own wording.
- Split a list into separate items. "Beta Alpha Psi and also the consulting club" is two items.
- For dates, output ISO (YYYY-MM-DD). Resolve "last Tuesday" against the supplied current date.
- If the student clearly means "none" or "skip", return the empty value for the field.
- confidence is how sure you are that you captured them correctly, not how good their answer was.
- Put anything you could not place in "notes". The student sees those.`;

export interface StructuredAnswer {
  value: unknown;
  confidence: number;
  notes: string[];
}

export async function structureAnswer(input: {
  field: Field;
  raw: string;
  now?: Date;
}): Promise<StructuredAnswer> {
  const { field, raw } = input;
  if (!raw.trim()) return { value: field.input === "chips" || field.input === "date-list" ? [] : null, confidence: 1, notes: [] };

  const Output = z.object({
    value: valueSchemaFor(field),
    confidence: z.number().min(0).max(1),
    notes: z.array(z.string()),
  });

  // The field definition is identical for every student answering this
  // question, so it is the cached prefix; the transcript is the variable
  // suffix. Same shape as match-jobs.ts caching the profile.
  const fieldBlock = [
    `FIELD: ${field.id}`,
    `QUESTION: ${field.question}`,
    `GUIDANCE SHOWN TO THE STUDENT: ${field.help}`,
    `EXPECTED SHAPE: ${describeShape(field)}`,
  ].join("\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(Output) },
    messages: [{
      role: "user",
      content: [
        { type: "text", text: fieldBlock, cache_control: { type: "ephemeral" } },
        { type: "text", text: `CURRENT DATE: ${(input.now ?? new Date()).toISOString().slice(0, 10)}` },
        { type: "text", text: `--- THE STUDENT SAID ---\n${raw.trim()}` },
      ],
    }],
  });

  if (!response.parsed_output) {
    throw new Error(`Could not structure the answer (${response.stop_reason})`);
  }
  return response.parsed_output;
}

function describeShape(field: Field): string {
  switch (field.input) {
    case "chips": return "an array of short strings, one per thing they named";
    case "date-list": return "an array of { name, kind, date (ISO), org } — kind is one of conference, recruiting_event, webinar, case_competition, class, career_fair";
    case "pair": return "{ from, to } describing a career change, or null if they are not changing paths";
    case "date": return "a single ISO date string, or null";
    default: return "a single short string, or null";
  }
}
