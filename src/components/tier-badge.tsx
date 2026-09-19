import { TIERS } from "@/lib/affinity/tiers";

export function tierColor(rank: number): string {
  return `var(--tier-${rank})`;
}

export function TierBadge({ rank, score }: { rank: number; score?: number }) {
  const tier = TIERS.find((t) => t.rank === rank);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-white"
      style={{ background: tierColor(rank) }}
      title={tier?.label}
    >
      <span className="opacity-80">Tier {rank}</span>
      {score !== undefined && <span className="tabular-nums">{Math.round(score)}</span>}
    </span>
  );
}

/**
 * The whole ladder, with the matched rung lit. Ranks 1 and 6 are shown greyed
 * with their reason rather than hidden: "we could rank on your LinkedIn
 * connections and chose not to" is a better answer than a list that quietly
 * starts at 2.
 */
export function TierLadder({ activeRank }: { activeRank?: number }) {
  return (
    <ol className="space-y-1">
      {TIERS.map((tier) => {
        const active = tier.rank === activeRank;
        return (
          <li
            key={tier.id}
            className={`flex gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
              active ? "bg-[var(--color-raised)]" : ""
            } ${tier.inScope ? "" : "opacity-45"}`}
          >
            <span
              className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: tier.inScope ? tierColor(tier.rank) : "var(--color-faint)" }}
            />
            <div className="min-w-0">
              <p className={active ? "font-medium" : ""}>
                {tier.label}
                {!tier.inScope && (
                  <span className="ml-2 rounded border px-1.5 py-0.5 text-[11px] text-[var(--color-faint)]">
                    not collected
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[var(--color-muted)]">
                {tier.inScope ? tier.blurb : tier.guidance}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
