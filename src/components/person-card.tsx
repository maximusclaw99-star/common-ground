import Link from "next/link";
import type { AffinityResult, Person } from "@/lib/affinity/types";
import { NO_FACTORS, type HomophilyResult } from "@/lib/homophily/scorer";
import { Avatar } from "./avatar";
import { HomophilyBadge } from "./homophily-badge";
import { TierBadge } from "./tier-badge";

/**
 * One person. The body is what you have in common, whichever scorer ranked
 * the list; `homophily` swaps the badge and adds its drivers to the lines.
 */
/** Ladder evidence that is genuinely shared with the resume: not a post, an event, or "same field". */
const SHARED_KINDS = new Set(["school", "org", "employer", "client", "place", "interest"]);

/**
 * What the student and this person share, as sentences, strongest first:
 * the ladder's shared facts, then the homophily drivers that add a fact the
 * ladder did not already name (the two scorers describe the same university
 * in different words). Three lines at most on a card; nothing else.
 */
export function inCommonLines(result: AffinityResult, homophily?: HomophilyResult, max = 3): string[] {
  const out: string[] = [];
  for (const e of result.evidence) {
    if (SHARED_KINDS.has(e.kind) && !out.includes(e.label)) out.push(e.label);
  }
  const said = out.join(" | ").toLowerCase();
  for (const d of homophily?.matchDrivers ?? []) {
    if (d === NO_FACTORS) continue;
    const value = d.replace(/\s*\(\+\d+\)\s*$/, "").split(":")[1]?.trim().toLowerCase();
    if (value && said.includes(value)) continue;
    if (!value && /hometown/i.test(d) && result.evidence.some((e) => e.kind === "place")) continue;
    out.push(d);
  }
  return out.slice(0, max);
}

export function PersonCard({ person, result, homophily, badge = "tier" }: {
  person: Person; result: AffinityResult; homophily?: HomophilyResult;
  /** Which score the badge shows — the one the list is ordered by. */
  badge?: "tier" | "homophily";
}) {
  const lines = inCommonLines(result, homophily);
  return (
    <Link href={`/people/${person.id}`} className="tb-card">
      <div className="flex items-start justify-between gap-[var(--space-12)]">
        <div className="flex min-w-0 items-center gap-[var(--space-12)]">
          <Avatar name={person.fullName} src={person.photoUrl} size={40} />
          <div className="min-w-0">
            <p className="title" style={{ textTransform: "uppercase", margin: 0 }}>{person.fullName}</p>
            <p className="mono-micro truncate" style={{ color: "var(--ink-faint)", margin: "var(--space-4) 0 0" }}>
              {person.currentTitle} &middot; {person.currentCompany}
            </p>
          </div>
        </div>
        {badge === "homophily" && homophily ? <HomophilyBadge result={homophily} /> : <TierBadge rank={result.rank} score={result.score} />}
      </div>

      {lines.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
          Nothing in common yet beyond wanting to work there.
        </p>
      ) : (
        <ul className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
          {lines.map((d) => <li key={d}>&rarr; {d}</li>)}
        </ul>
      )}

    </Link>
  );
}
