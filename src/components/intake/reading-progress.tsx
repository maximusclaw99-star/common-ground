"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * What the upload shows while the resume is being read.
 *
 * Indeterminate, deliberately. The server action is a single round trip and
 * reports nothing until it returns, so any percentage here would be a number
 * this page invented about itself — and the whole diagnostic idiom in this
 * system rests on readings being measured rather than staged.
 *
 * The elapsed seconds ARE measured. The stage labels are derived from the
 * pipeline's known shape (upload, then parse, then the model), not reported by
 * the server, which is why they are phrased as what is happening rather than
 * as a completed step count.
 *
 * The wait is worth dressing properly: the Databricks reader waits up to 50s
 * on ai_query before polling, so a minute is an ordinary outcome, not a hang.
 */

/** Quantised so the snapshot is stable between ticks; Date.now() would loop. */
const subscribe = (notify: () => void) => {
  const id = setInterval(notify, 500);
  return () => clearInterval(id);
};
const tick = () => Math.floor(Date.now() / 500);

export interface Stage { after: number; label: string }

export function stagesFor(reader: string): Stage[] {
  if (reader === "anthropic") {
    return [
      { after: 0, label: "Uploading your resume" },
      { after: 2, label: "Sending the pages to Claude" },
      { after: 6, label: "Reading it" },
    ];
  }
  return [
    { after: 0, label: "Uploading your resume" },
    { after: 2, label: "Pulling the text out of the PDF" },
    { after: 5, label: "Asking the warehouse to read it" },
    { after: 30, label: "Still reading — the model takes its time" },
  ];
}

/** The stage a given elapsed time falls in. Pure, so it can be tested. */
export function stageAt(reader: string, elapsed: number): Stage {
  const stages = stagesFor(reader);
  let current = stages[0];
  for (const stage of stages) if (elapsed >= stage.after) current = stage;
  return current;
}

export function ReadingProgress({ reader }: { reader: string }) {
  // Mounted only while the action is in flight, so the lazy initialiser is the
  // moment the work started. No effect, and nothing to reset.
  const [startedAt] = useState(() => Date.now());
  const now = useSyncExternalStore(subscribe, tick, () => 0);
  const elapsed = now === 0 ? 0 : Math.max(0, Math.round((now * 500 - startedAt) / 1000));

  const stage = stageAt(reader, elapsed);

  return (
    <div style={{ marginTop: "var(--space-24)" }} aria-live="polite">
      <div className="tb-progress" role="progressbar" aria-label="Reading your resume">
        <div className="tb-progress__bar" />
      </div>
      <div className="mono-micro flex flex-wrap items-center justify-between gap-[var(--space-12)]"
        style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)" }}>
        <span style={{ textTransform: "uppercase" }}>
          <span className="tb-led tb-led--live" aria-hidden /> {stage.label}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {elapsed}s &middot; via {reader}
        </span>
      </div>
      {elapsed >= 45 && (
        <p className="mono-micro" style={{ margin: "var(--space-8) 0 0", color: "var(--ink-faint)", textTransform: "none" }}>
          &gt; Long, but not stuck. Nothing is saved until it finishes.
        </p>
      )}
    </div>
  );
}
