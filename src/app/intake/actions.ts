"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EMPTY_FACTS } from "@/lib/ai/schemas";
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
  if (!student) redirect("/intake");

  try {
    const { facts, meta } = applyAnswers(student.facts, student.meta, answers);
    await saveFacts(facts, meta, completed);
    // No revalidation here at all: every page that reads these facts is
    // force-dynamic, so nothing is cached to invalidate, and a revalidate call
    // makes the action response re-render /intake — a second round trip to the
    // warehouse for a page the student is still typing on.
    return { ok: true };
  } catch (error) {
    console.error("[intake] could not save answers", error);
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}

/**
 * Clears this student's answers and starts the questionnaire again. Only the
 * answers: the resume and the companies they picked on the dashboard stay.
 */
export async function restartQuestionsAction(): Promise<void> {
  const { student } = await getSession();
  if (!student) redirect("/sign-in?next=/intake");
  await saveFacts({ ...EMPTY_FACTS, target_companies: student.facts.target_companies }, {}, false);
  revalidatePath("/intake");
  revalidatePath("/dashboard");
  redirect("/intake");
}
