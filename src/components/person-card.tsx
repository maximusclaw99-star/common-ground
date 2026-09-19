import Link from "next/link";
import type { AffinityResult, Person } from "@/lib/affinity/types";
import { TierBadge } from "./tier-badge";

export function PersonCard({ person, result }: { person: Person; result: AffinityResult }) {
  return (
    <Link
      href={`/people/${person.id}`}
      className="focus-ring card block p-5 transition-colors hover:border-[var(--color-accent-line)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] leading-snug">{person.fullName}</p>
          <p className="mt-0.5 truncate text-[14px] text-[var(--color-muted)]">
            {person.currentTitle} · {person.currentCompany}
          </p>
        </div>
        <TierBadge rank={result.rank} score={result.score} />
      </div>

      <p className="mt-3 text-[14px] leading-relaxed">
        {result.evidence[0]?.label ?? "Nothing in common yet beyond wanting to work there."}
      </p>

      {result.evidence.length > 1 && (
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          Also: {result.evidence.slice(1, 3).map((e) => e.label.replace(/^You(&rsquo;re| were| went| have)?\s*/i, "")).join(" · ")}
        </p>
      )}

      {result.outreach.timing && (
        <p className="mt-2.5 inline-block rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 text-[12px] text-[var(--color-accent)]">
          {result.outreach.timing}
        </p>
      )}
    </Link>
  );
}
