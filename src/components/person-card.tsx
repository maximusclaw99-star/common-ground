import Link from "next/link";
import type { AffinityResult, Person } from "@/lib/affinity/types";
import { Avatar } from "./avatar";
import { TierBadge } from "./tier-badge";

export function PersonCard({ person, result }: { person: Person; result: AffinityResult }) {
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
        <TierBadge rank={result.rank} score={result.score} />
      </div>

      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
        {result.evidence[0]?.label ?? "Nothing in common yet beyond wanting to work there."}
      </p>

      {result.outreach.timing && (
        <p className="mono-micro" style={{ color: "var(--alert)", margin: "var(--space-12) 0 0" }}>
          <span className="tb-led tb-led--alert" aria-hidden /> {result.outreach.timing}
        </p>
      )}
    </Link>
  );
}
