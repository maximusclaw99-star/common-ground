"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveAnswersAction, structureAnswerAction } from "@/app/intake/actions";
import type { Answer } from "@/lib/intake/answers";
import { humanEstimate, peopleRemaining } from "@/lib/intake/steps";
import type { Gap, IntakeStep } from "@/lib/intake/types";
import { FieldInput } from "./field-input";

const REASON_NOTE: Partial<Record<Gap["reason"], string>> = {
  confirm: "We read this off your resume — correct it if we got it wrong.",
  low_confidence: "We weren't confident about this one.",
  stale: "This aged out. Anything more recent?",
  below_min: "A couple more would help.",
};

function emptyFor(gap: Gap): unknown {
  return gap.field.input === "chips" || gap.field.input === "date-list" ? [] : null;
}

export function IntakeFlow({ steps, unrouted }: { steps: IntakeStep[]; unrouted: string[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyField, setBusyField] = useState<string | null>(null);

  // Prefills are the starting point, so a student confirms rather than retypes.
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(steps.flatMap((s) => s.fields).map((g) => [g.field.id, g.prefill ?? emptyFor(g)])));
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  // Clamped rather than indexed directly: a shorter `steps` prop must not
  // render an undefined screen.
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex];
  const last = safeIndex === steps.length - 1;
  const remaining = useMemo(() => peopleRemaining(steps, safeIndex), [steps, safeIndex]);

  if (!step) return null;

  const setValue = (id: string, value: unknown) => {
    setValues((v) => ({ ...v, [id]: value }));
    setSkipped((s) => (s[id] ? { ...s, [id]: false } : s));
  };

  const dictate = (gap: Gap) => async (raw: string) => {
    const id = gap.field.id;
    setBusyField(id);
    // Show their words immediately; the structured value lands a beat later.
    if (gap.field.input === "text" || gap.field.input === "date") setValue(id, raw);

    const result = await structureAnswerAction(id, raw);
    setBusyField(null);
    if (!result.ok) {
      // Never lose what they said because a model call failed.
      if (gap.field.input === "chips") {
        const parts = raw.split(/,| and /i).map((p) => p.trim()).filter(Boolean);
        setValue(id, [...(values[id] as string[] ?? []), ...parts]);
      } else setValue(id, raw);
      return;
    }
    if (gap.field.input === "chips" && Array.isArray(result.value)) {
      const existing = (values[id] as string[]) ?? [];
      const merged = [...existing];
      for (const item of result.value as string[]) {
        if (!merged.some((m) => m.toLowerCase() === String(item).toLowerCase())) merged.push(String(item));
      }
      setValue(id, merged);
    } else {
      setValue(id, result.value);
    }
  };

  const answersForStep = (): Answer[] =>
    step.fields.map((gap) => ({
      fieldId: gap.field.id,
      value: skipped[gap.field.id] ? emptyFor(gap) : values[gap.field.id],
      source: "answer" as const,
      confidence: 1,
    }));

  const advance = (answers: Answer[]) => {
    setError(null);
    startSaving(async () => {
      const result = await saveAnswersAction(answers, last);
      if (!result.ok) { setError(result.error ?? "Could not save"); return; }
      if (last) router.push("/dashboard");
      else setIndex((i) => i + 1);
    });
  };

  const missingRequired = step.fields.filter((g) => {
    if (!g.field.required) return false;
    const v = values[g.field.id];
    if (Array.isArray(v)) return v.length < (g.field.minAnswers ?? 1);
    return !v;
  });

  return (
    <div>
      <ol className="mb-8 flex gap-1.5" aria-label="Progress">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= safeIndex ? "var(--color-accent)" : "var(--color-line)" }}
            aria-current={i === safeIndex ? "step" : undefined}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[32px] leading-tight">{step.title}</h1>
        <span className="text-[13px] text-[var(--color-faint)]">
          Step {safeIndex + 1} of {steps.length} · {humanEstimate(step.estimatedSeconds)}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">{step.subtitle}</p>
      {remaining > 0 && (
        <p className="mt-1 text-[13px] text-[var(--color-accent)]">
          {remaining} more {remaining === 1 ? "person" : "people"} we can reach once you finish these.
        </p>
      )}

      <div className="mt-8 space-y-7">
        {step.fields.map((gap) => {
          const id = gap.field.id;
          const isSkipped = Boolean(skipped[id]);
          return (
            <section key={id} className={isSkipped ? "opacity-50" : ""}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label className="text-[17px]" htmlFor={id}>
                  {gap.field.question}
                  {gap.field.required && <span className="ml-1.5 text-[13px] text-[var(--color-accent)]">required</span>}
                </label>
                {gap.field.skipLabel && (
                  <button
                    type="button"
                    onClick={() => setSkipped((s) => ({ ...s, [id]: !s[id] }))}
                    className="focus-ring rounded-lg border px-2.5 py-1 text-[12px] text-[var(--color-muted)] hover:bg-[var(--color-raised)]"
                  >
                    {isSkipped ? "Actually, let me answer" : gap.field.skipLabel}
                  </button>
                )}
              </div>

              <p className="mb-3 mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-muted)]">
                {gap.field.help}
              </p>

              {gap.uncertaintyNote && (
                <p className="mb-3 rounded-lg border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 py-2 text-[13px] text-[var(--color-muted)]">
                  <span className="font-medium text-[var(--color-accent)]">We weren&rsquo;t sure: </span>
                  {gap.uncertaintyNote}
                </p>
              )}
              {gap.demandExamples.length > 0 && (
                <p className="mb-3 text-[13px] text-[var(--color-muted)]">
                  We ask because {gap.demandExamples[0].replace(/\.$/, "")}
                  {gap.demandCount > 1 && ` — and ${gap.demandCount - 1} other${gap.demandCount > 2 ? "s" : ""}`}.
                </p>
              )}

              {!isSkipped && (
                <>
                  <FieldInput
                    field={gap.field}
                    value={values[id]}
                    onChange={(v) => setValue(id, v)}
                    onDictate={dictate(gap)}
                    dictationBusy={busyField === id}
                  />
                  {REASON_NOTE[gap.reason] && (
                    <p className="mt-2 text-[12px] text-[var(--color-faint)]">{REASON_NOTE[gap.reason]}</p>
                  )}
                </>
              )}
            </section>
          );
        })}

        {last && unrouted.length > 0 && (
          <section className="rule pt-6">
            <p className="text-[15px]">Anything else we got wrong?</p>
            <ul className="mt-2 space-y-1 text-[13px] text-[var(--color-muted)]">
              {unrouted.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </section>
        )}
      </div>

      {error && <p className="mt-6 text-[14px] text-[var(--color-accent)]">{error}</p>}

      <div className="mt-10 flex flex-wrap items-center gap-3 rule pt-6">
        {safeIndex > 0 && (
          <button type="button" onClick={() => setIndex((i) => i - 1)}
            className="focus-ring rounded-xl border px-4 py-2.5 text-[15px] hover:bg-[var(--color-raised)]">
            Back
          </button>
        )}
        <button
          type="button"
          disabled={saving || missingRequired.length > 0}
          onClick={() => advance(answersForStep())}
          className="focus-ring rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-45"
        >
          {saving ? "Saving…" : last ? "Finish and show me people" : "Continue"}
        </button>

        {step.optional && (
          <button
            type="button"
            disabled={saving}
            // Skipping the optional screen still records an answer for every
            // field on it, so none of them come back next time.
            onClick={() => advance(step.fields.map((gap) => ({
              fieldId: gap.field.id, value: emptyFor(gap), source: "answer" as const, confidence: 1,
            })))}
            className="focus-ring rounded-xl px-3 py-2.5 text-[14px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Skip these
          </button>
        )}

        {missingRequired.length > 0 && (
          <span className="text-[13px] text-[var(--color-faint)]">
            {missingRequired[0].field.question} is needed to rank anyone.
          </span>
        )}
      </div>
    </div>
  );
}
