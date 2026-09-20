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
/**
 * What the student and this person share, as sentences, strongest first: the
 * ladder's evidence (a post or an event only if nothing personal is shared)
 * plus the homophily drivers, deduplicated. Three lines at most on a card.
 */
export function inCommonLines(result: AffinityResult, homophily?: HomophilyResult, max = 3): string[] {
  const personal = result.evidence.filter((e) => e.kind !== "post" && e.kind !== "event").map((e) => e.label);
  const timely = result.evidence.filter((e) => e.kind === "post" || e.kind === "event").map((e) => e.label);
  const drivers = (homophily?.matchDrivers ?? []).filter((d) => d !== NO_FACTORS);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...personal, ...drivers, ...(personal.length || drivers.length ? [] : timely)]) {
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

export function PersonCard({ person, result, homophily }: { person: Person; result: AffinityResult; homophily?: HomophilyResult }) {
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
        {homophily ? <HomophilyBadge result={homophily} /> : <TierBadge rank={result.rank} score={result.score} />}
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

      {result.outreach.timing && (
        <p className="mono-micro" style={{ color: "var(--alert)", margin: "var(--space-12) 0 0" }}>
          <span className="tb-led tb-led--alert" aria-hidden /> {result.outreach.timing}
        </p>
      )}
    </Link>
  );
}
