"use server";

import { revalidatePath } from "next/cache";
import { structureAnswer } from "@/lib/ai/structure-answer";
import { applyAnswers, type Answer } from "@/lib/intake/answers";
import { fieldById } from "@/lib/intake/fields";
import { getSession, saveFacts } from "@/lib/session";

/**
 * Turns a dictated answer into this field's typed value.
 *
 * On the server because an in-browser Anthropic call would ship the API key to
 * every visitor. If it fails, the caller keeps the raw transcript — losing the
 * student's words because a model call timed out would be the worse outcome.
 */
export async function structureAnswerAction(
  fieldId: string,
  raw: string,
): Promise<{ ok: true; value: unknown; confidence: number; notes: string[] } | { ok: false; error: string }> {
  const field = fieldById(fieldId);
  if (!field) return { ok: false, error: `Unknown field ${fieldId}` };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "no-api-key" };
  }

  try {
    const result = await structureAnswer({ field, raw });
    return { ok: true, ...result };
  } catch (error) {
    console.error("[intake] could not structure a dictated answer", error);
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function saveAnswersAction(
  answers: Answer[],
  completed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { student } = await getSession();
  if (!student) return { ok: false, error: "Not signed in" };

  try {
    const { facts, meta } = applyAnswers(student.facts, student.meta, answers);
    await saveFacts(facts, meta, completed);
    // Only the dashboard. Revalidating /intake re-runs computeGaps against the
    // answers just saved and hands the running flow a DIFFERENT step list
    // mid-walk — screens renumber, and a screen the student was about to see
    // can disappear. The flow owns its step list until they finish; the next
    // visit recomputes it.
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("[intake] could not save answers", error);
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
