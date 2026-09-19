"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { buildPlan, type PlanState } from "./actions";
import type { RankedPosition } from "@/lib/positions";
import { PlanResult } from "./plan-result";

const subscribe = (notify: () => void) => { const id = setInterval(notify, 500); return () => clearInterval(id); };
const tick = () => Math.floor(Date.now() / 500);

/** Stage labels follow the agent's fixed procedure; the seconds are measured. */
function stageAt(elapsed: number): string {
  if (elapsed < 3) return "Handing the opening to the agent";
  if (elapsed < 8) return "Agent is checking what the posting asks for";
  if (elapsed < 16) return "Looking up how to close each gap";
  if (elapsed < 40) return "Rewriting your resume from the confirmed profile";
  return "Still working — the model takes its time";
}

function Progress({ provider }: { provider: string }) {
  const [startedAt] = useState(() => Date.now());
  const now = useSyncExternalStore(subscribe, tick, () => 0);
  const elapsed = now === 0 ? 0 : Math.max(0, Math.round((now * 500 - startedAt) / 1000));
  return (
    <div style={{ marginTop: "var(--space-24)" }} aria-live="polite">
      <div className="tb-progress" role="progressbar" aria-label="Building your plan"><div className="tb-progress__bar" /></div>
      <div className="mono-micro flex flex-wrap items-center justify-between gap-[var(--space-12)]" style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)" }}>
        <span style={{ textTransform: "uppercase" }}><span className="tb-led tb-led--live" aria-hidden /> {stageAt(elapsed)}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed}s &middot; via {provider}</span>
      </div>
    </div>
  );
}

export function PlanForm({ openings, provider }: { openings: RankedPosition[]; provider: string }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(buildPlan, { result: null, error: null, positionId: null });
  const [chosen, setChosen] = useState(openings[0]?.position.id ?? "");

  return (
    <>
      <form action={action} className="tb-panel">
        <p className="mono-label" style={{ margin: 0 }}>&gt; Which opening?</p>
        <ul style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
          {openings.map(({ position, fit }) => (
            <li key={position.id}>
              <label className="flex items-baseline gap-[var(--space-12)]" style={{ cursor: pending ? "default" : "pointer" }}>
                <input type="radio" name="position" value={position.id} checked={chosen === position.id}
                  onChange={() => setChosen(position.id)} disabled={pending} />
                <span className="body-sm" style={{ margin: 0 }}>
                  {position.title} <span style={{ color: "var(--ink-faint)" }}>&middot; {position.company}</span>
                </span>
                <span className="mono-micro" style={{ marginLeft: "auto", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                  opens {position.opensOn} &middot; {Math.round(fit.score)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {state.error && (
          <p className="body-sm" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-muted)" }}>
            <span className="mono-label" style={{ color: "var(--alert)" }}>Could not build it &mdash; </span>{state.error}
          </p>
        )}
        {pending ? <Progress provider={provider} /> : (
          <button type="submit" className="tb-btn tb-btn--solid mono-label" style={{ marginTop: "var(--space-24)" }} disabled={!chosen}>
            Build my plan &#8599;
          </button>
        )}
      </form>

      {state.result && !pending && <PlanResult result={state.result} />}
    </>
  );
}
