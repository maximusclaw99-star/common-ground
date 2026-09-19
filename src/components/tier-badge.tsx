import { TIERS } from "@/lib/affinity/tiers";

/**
 * Tier colour is meaning, not decoration — the ladder IS the product, so a
 * connection's strength should be legible before any text is read. The scale
 * runs through the system's own two status hues rather than adding a palette:
 * `signal` at the top, `alert` at the bottom.
 */
export function tierColor(rank: number): string {
  return `var(--tier-${rank})`;
}

export function TierBadge({ rank, score }: { rank: number; score?: number }) {
  const tier = TIERS.find((t) => t.rank === rank);
  return (
    <span
      className="mono-label"
      title={tier?.label}
      style={{
        display: "inline-flex", alignItems: "center", gap: "var(--space-8)",
        border: `var(--border-2) solid ${tierColor(rank)}`,
        color: tierColor(rank),
        padding: "var(--space-4) var(--space-10)",
        borderRadius: "var(--radius-none)",
        whiteSpace: "nowrap",
      }}
    >
      Tier {rank}
      {score !== undefined && (
        <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(score)}
        </span>
      )}
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
    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {TIERS.map((tier) => {
        const active = tier.rank === activeRank;
        return (
          <li
            key={tier.id}
            style={{
              display: "flex", gap: "var(--space-12)",
              padding: "var(--space-8) 0",
              borderTop: tier.rank === 1 ? "none" : "var(--border-1) solid var(--rule)",
              opacity: tier.inScope ? 1 : 0.42,
              background: active ? "var(--canvas)" : "transparent",
            }}
          >
            <span className="mono-micro" style={{ color: "var(--ink-faint)", minWidth: 18, paddingTop: 3 }}>
              {String(tier.rank).padStart(2, "0")}
            </span>
            <span
              aria-hidden
              style={{
                width: 8, height: 8, marginTop: 6, flexShrink: 0,
                background: tier.inScope ? tierColor(tier.rank) : "var(--ink-faint)",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <p className="mono-label" style={{ margin: 0, color: active ? "var(--ink)" : "var(--ink-muted)" }}>
                {tier.label}
                {!tier.inScope && (
                  <span className="mono-micro" style={{ marginLeft: 8, color: "var(--ink-faint)" }}>
                    &mdash; not collected
                  </span>
                )}
              </p>
              <p className="body-sm" style={{ margin: "2px 0 0", color: "var(--ink-subtle)", textTransform: "none" }}>
                {tier.inScope ? tier.blurb : tier.guidance}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
