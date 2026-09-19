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
      <ol className="mb-[var(--space-24)] flex gap-[var(--space-4)]" aria-label="Progress">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className="h-[6px] flex-1"
            style={{
              background: i < safeIndex ? "var(--ink)" : i === safeIndex ? "var(--signal)" : "transparent",
              border: "var(--border-1) solid var(--rule-strong)",
            }}
            aria-current={i === safeIndex ? "step" : undefined}
          />
        ))}
      </ol>

      <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>
        &gt; Step {safeIndex + 1} of {steps.length} &middot; {humanEstimate(step.estimatedSeconds)}
      </p>
      <h1 className="display-sm" style={{ textTransform: "uppercase", margin: "var(--space-12) 0" }}>
        {step.title}
      </h1>
      <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>{step.subtitle}</p>
      {remaining > 0 && (
        <p className="mono-label" style={{ color: "var(--signal)", margin: "var(--space-12) 0 0" }}>
          <span className="tb-led tb-led--live" aria-hidden /> {remaining} more{" "}
          {remaining === 1 ? "person" : "people"} unlocked by this screen
        </p>
      )}

      <div className="mt-[var(--space-32)] grid gap-[var(--space-32)]">
        {step.fields.map((gap) => {
          const id = gap.field.id;
          const isSkipped = Boolean(skipped[id]);
          return (
            <section key={id} style={isSkipped ? { opacity: 0.45 } : undefined}>
              <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                <label className="title" style={{ textTransform: "uppercase" }} htmlFor={id}>
                  {gap.field.question}
                  {gap.field.required && (
                    <span className="mono-micro" style={{ marginLeft: 8, color: "var(--alert)" }}>required</span>
                  )}
                </label>
                {gap.field.skipLabel && (
                  <button
                    type="button"
                    onClick={() => setSkipped((s) => ({ ...s, [id]: !s[id] }))}
                    className="tb-btn tb-btn--sm mono-label"
                  >
                    {isSkipped ? "Let me answer" : gap.field.skipLabel}
                  </button>
                )}
              </div>

              <p className="body-sm tb-copy" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 var(--space-16)" }}>
                {gap.field.help}
              </p>

              {gap.uncertaintyNote && (
                <p className="body-sm" style={{
                  margin: "0 0 var(--space-16)", padding: "var(--space-12)",
                  background: "var(--canvas-raised)", border: "var(--border-1) solid var(--rule-strong)",
                  color: "var(--ink-muted)",
                }}>
                  <span className="mono-label" style={{ color: "var(--alert)" }}>We were not sure &mdash; </span>
                  {gap.uncertaintyNote}
                </p>
              )}
              {gap.demandExamples.length > 0 && (
                <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-16)", textTransform: "none" }}>
                  &gt; We ask because {gap.demandExamples[0].replace(/\.$/, "")}
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
                    <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-8) 0 0", textTransform: "none" }}>
                      {REASON_NOTE[gap.reason]}
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}

        {last && unrouted.length > 0 && (
          <section className="tb-rule" style={{ paddingTop: "var(--space-24)" }}>
            <p className="mono-label" style={{ margin: 0 }}>Anything else we got wrong?</p>
            <ul className="body-sm" style={{ margin: "var(--space-8) 0 0", padding: 0, listStyle: "none", color: "var(--ink-muted)" }}>
              {unrouted.map((note) => <li key={note}>&gt; {note}</li>)}
            </ul>
          </section>
        )}
      </div>

      {error && <p className="mono-label" style={{ color: "var(--alert)", marginTop: "var(--space-24)" }}>{error}</p>}

      <div className="tb-rule mt-[var(--space-48)] flex flex-wrap items-center gap-[var(--space-16)]" style={{ paddingTop: "var(--space-24)" }}>
        {safeIndex > 0 && (
          <button type="button" onClick={() => setIndex((i) => i - 1)} className="tb-btn mono-label">
            Back
          </button>
        )}
        <button
          type="button"
          disabled={saving || missingRequired.length > 0}
          aria-disabled={saving || missingRequired.length > 0}
          onClick={() => advance(answersForStep())}
          className="tb-btn tb-btn--solid mono-label"
        >
          {saving ? "Saving" : last ? "Finish \u2197" : "Continue"}
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
            className="tb-btn mono-label"
          >
            Skip these
          </button>
        )}

        {missingRequired.length > 0 && (
          <span className="mono-micro" style={{ color: "var(--ink-faint)", textTransform: "none" }}>
            &gt; {missingRequired[0].field.question} is needed to rank anyone.
          </span>
        )}
      </div>
    </div>
  );
}
