"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { PlanResult } from "@/components/plan-result";
import { ProgressBar } from "@/components/tb/progress-bar";
import { askAgent, type AskState } from "./actions";

const subscribe = (notify: () => void) => { const id = setInterval(notify, 500); return () => clearInterval(id); };
const tick = () => Math.floor(Date.now() / 500);

/** Stage labels follow the agent's fixed procedure; the seconds are measured. */
function stageAt(elapsed: number): string {
  if (elapsed < 3) return "Handing the opening to the agent";
  if (elapsed < 8) return "Checking what they ask for against your profile";
  if (elapsed < 16) return "Looking up how to close each gap";
  if (elapsed < 40) return "Rewriting your resume from the confirmed profile";
  return "Still working — the model takes its time";
}

function Progress({ provider }: { provider: string }) {
  const [startedAt] = useState(() => Date.now());
  const now = useSyncExternalStore(subscribe, tick, () => 0);
  const elapsed = now === 0 ? 0 : Math.max(0, Math.round((now * 500 - startedAt) / 1000));
  return (
    <div style={{ marginTop: "var(--space-16)" }} aria-live="polite">
      <ProgressBar elapsed={elapsed} typicalSeconds={20} label="Working out your plan" />
      <div className="mono-micro flex flex-wrap items-center justify-between gap-[var(--space-12)]" style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)" }}>
        <span style={{ textTransform: "uppercase" }}><span className="tb-led tb-led--live" aria-hidden /> {stageAt(elapsed)}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed}s &middot; via {provider}</span>
      </div>
    </div>
  );
}

/**
 * The "how to improve your chances" section: a button until it is asked,
 * then the plan, the resume, and the collapsed trace. The button is the
 * only place the model is invoked; the rest of the page is computed.
 */
export function AskAgent({ positionId, provider, gapsCount }: { positionId: string; provider: string; gapsCount: number }) {
  const [state, action, pending] = useActionState<AskState, FormData>(askAgent, { result: null, error: null });

  return (
    <div className="tb-panel">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-16)]">
        <div className="tb-copy">
          <p className="mono-label" style={{ margin: 0 }}>&gt; How to improve your chances</p>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
            {gapsCount === 0
              ? "Nothing they ask for is missing from your profile. The agent can still rewrite your resume for this role."
              : `${gapsCount} thing${gapsCount === 1 ? "" : "s"} they ask for ${gapsCount === 1 ? "is" : "are"} not on your profile yet. The agent works out the cheapest real way to close each one and rewrites your resume for this role — from your confirmed profile only.`}
          </p>
        </div>
        {!pending && !state.result && (
          <form action={action}>
            <input type="hidden" name="position" value={positionId} />
            <button type="submit" className="tb-btn tb-btn--solid mono-label">Ask the agent &#8599;</button>
          </form>
        )}
      </div>
      {pending && <Progress provider={provider} />}
      {state.error && !pending && (
        <p className="body-sm" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-muted)" }}>
          <span className="mono-label" style={{ color: "var(--alert)" }}>Could not finish &mdash; </span>{state.error}
        </p>
      )}
      {state.result && !pending && (
        <>
          <PlanResult result={state.result} />
          <form action={action} style={{ marginTop: "var(--space-16)" }}>
            <input type="hidden" name="position" value={positionId} />
            <button type="submit" className="tb-btn tb-btn--sm mono-label">Run it again</button>
          </form>
        </>
      )}
    </div>
  );
}
