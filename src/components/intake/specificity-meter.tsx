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
    <div className="mt-3 space-y-1.5">
      {scored.map(({ value, score }) => (
        <div key={value} className="flex items-center gap-2.5 text-[12px]">
          <div className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--color-raised)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round(score * 100)}%`,
                background: score >= SPECIFIC_ENOUGH ? "var(--color-good)" : "var(--color-accent)",
              }}
            />
          </div>
          <span className="truncate text-[var(--color-muted)]">{value}</span>
        </div>
      ))}
      {weak.length > 0 && (
        <p className="pt-1 text-[12px] text-[var(--color-muted)]">
          {weak.length === scored.length ? "These are" : `${weak.length} of these is`} still broad
          enough that half your industry shares it. Naming the problem — or who you solve it for —
          finds you a much better person.
        </p>
      )}
    </div>
  );
}
