"use client";

import { SPECIFIC_ENOUGH, specificity } from "@/lib/affinity/specificity";

/**
 * Live feedback on the one thing that decides whether an interest is a strong
 * hook or a weak one. Telling a student "be specific" does nothing; showing
 * them that "AI" scores 0.09 and their next sentence scores 0.8 works.
 */
export function SpecificityMeter({ values }: { values: string[] }) {
  if (!values.length) return null;
  const scored = values.map((v) => ({ value: v, score: specificity(v) }));
  const weak = scored.filter((s) => s.score < SPECIFIC_ENOUGH);

  return (
    <div className="mt-[var(--space-12)] grid gap-[var(--space-8)]">
      {scored.map(({ value, score }) => (
        <div key={value} className="mono-micro flex items-center gap-[var(--space-12)]">
          <span style={{ width: 28, color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>
            {score.toFixed(2)}
          </span>
          <div style={{ height: 6, width: 80, flexShrink: 0, border: "var(--border-1) solid var(--rule)" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round(score * 100)}%`,
                background: score >= SPECIFIC_ENOUGH ? "var(--signal)" : "var(--alert)",
              }}
            />
          </div>
          <span className="truncate" style={{ color: "var(--ink-muted)", textTransform: "none" }}>{value}</span>
        </div>
      ))}
      {weak.length > 0 && (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-4) 0 0" }}>
          {weak.length === scored.length ? "These are" : `${weak.length} of these is`} still broad
          enough that half your industry shares it. Naming the problem — or who you solve it for —
          finds you a much better person.
        </p>
      )}
    </div>
  );
}
