import type { HomophilyResult } from "@/lib/homophily/scorer";

/** The homophily total, in the tier badge's clothes so the two modes read alike. */
export function HomophilyBadge({ result }: { result: HomophilyResult }) {
  const lit = result.totalScore > 0;
  return (
    <span className="mono-label" title="Homophily score" style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-8)",
      border: `var(--border-2) solid ${lit ? "var(--signal)" : "var(--ink-faint)"}`,
      color: lit ? "var(--signal)" : "var(--ink-faint)",
      padding: "var(--space-4) var(--space-10)", whiteSpace: "nowrap",
    }}>
      Score
      <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{result.totalScore}</span>
    </span>
  );
}
