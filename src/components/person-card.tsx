import Link from "next/link";
import type { AffinityResult, Person } from "@/lib/affinity/types";
import type { HomophilyResult } from "@/lib/homophily/scorer";
import { Avatar } from "./avatar";
import { HomophilyBadge } from "./homophily-badge";
import { TierBadge } from "./tier-badge";

/**
 * One person. With `homophily` set the card shows that score and its match
 * drivers instead of the ladder tier and its opener — the same card, ranked
 * by the other scorer.
 */
export function PersonCard({ person, result, homophily }: { person: Person; result: AffinityResult; homophily?: HomophilyResult }) {
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

      {homophily ? (
        <ul className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
          {homophily.matchDrivers.map((d) => <li key={d}>&rarr; {d}</li>)}
        </ul>
      ) : (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
          {result.evidence[0]?.label ?? "Nothing in common yet beyond wanting to work there."}
        </p>
      )}

      {result.outreach.timing && (
        <p className="mono-micro" style={{ color: "var(--alert)", margin: "var(--space-12) 0 0" }}>
          <span className="tb-led tb-led--alert" aria-hidden /> {result.outreach.timing}
        </p>
      )}
    </Link>
  );
}
