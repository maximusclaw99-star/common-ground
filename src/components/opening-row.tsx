import type { Gap, RankedPosition } from "@/lib/positions";

const TYPE_LABEL: Record<string, string> = { internship: "Internship", full_time: "Full time", research: "Research" };

export function windowLabel(fit: RankedPosition["fit"]): string {
  switch (fit.windowStatus) {
    case "open": return "Open now";
    case "opens_soon": return `Opens in ${fit.daysUntilOpen} day${fit.daysUntilOpen === 1 ? "" : "s"}`;
    case "upcoming": return `Opens ${fit.daysUntilOpen} days out`;
    default: return "Closed";
  }
}

function windowColor(status: RankedPosition["fit"]["windowStatus"]): string {
  return status === "open" ? "var(--signal)" : status === "opens_soon" ? "var(--alert)" : "var(--ink-faint)";
}

/**
 * One opening. Reads like the person card: what it is, when it opens, why it
 * ranks, and what stands in the way. `advice` is the one AI-written line on
 * the page and only the top position ever carries it.
 */
export function OpeningRow({ ranked, gaps, advice }: { ranked: RankedPosition; gaps: Gap[]; advice?: string | null }) {
  const { position, fit } = ranked;
  const blockers = gaps.filter((g) => g.required && g.status === "missing");
  const closed = fit.windowStatus === "closed";

  return (
    <article className="tb-card" style={{ opacity: closed ? 0.55 : 1 }}>
      <div className="flex items-start justify-between gap-[var(--space-12)]">
        <div className="min-w-0">
          <p className="title" style={{ textTransform: "uppercase", margin: 0 }}>{position.title}</p>
          <p className="mono-micro truncate" style={{ color: "var(--ink-faint)", margin: "var(--space-4) 0 0" }}>
            {position.company}
            {position.location && <> &middot; {position.location}</>}
            &nbsp;&middot; {TYPE_LABEL[position.type] ?? position.type}
            {position.targetGradYears.length > 0 && <> &middot; Class of {position.targetGradYears.join(" / ")}</>}
          </p>
        </div>
        <span className="mono-label" style={{
          display: "inline-flex", alignItems: "center", gap: "var(--space-8)", whiteSpace: "nowrap",
          border: `var(--border-2) solid ${windowColor(fit.windowStatus)}`, color: windowColor(fit.windowStatus),
          padding: "var(--space-4) var(--space-10)",
        }}>
          {windowLabel(fit)}
          <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{Math.round(fit.score)}</span>
        </span>
      </div>

      <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-12) 0 0", textTransform: "none" }}>
        {position.opensOn} &rarr; {position.closesOn}
      </p>

      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
        {fit.reasons.join(" · ")}
      </p>

      {gaps.length > 0 && (
        <div className="tb-rule" style={{ marginTop: "var(--space-12)", paddingTop: "var(--space-12)" }}>
          <p className="mono-micro" style={{ margin: 0, color: blockers.length ? "var(--alert)" : "var(--ink-subtle)" }}>
            {blockers.length
              ? <><span className="tb-led tb-led--alert" aria-hidden /> {blockers.length} hard requirement{blockers.length === 1 ? "" : "s"} you don&rsquo;t have yet</>
              : "Nice to have"}
          </p>
          <ul className="mono-micro" style={{ margin: "var(--space-8) 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "var(--space-8)", textTransform: "none" }}>
            {gaps.map((g) => (
              <li key={g.requirement} style={{
                border: "var(--border-1) solid var(--rule)", padding: "2px var(--space-8)",
                color: g.status === "in_progress" ? "var(--signal)" : g.required ? "var(--ink)" : "var(--ink-faint)",
              }}>
                {g.requirement}
                {g.status === "in_progress" ? " · in progress" : g.required ? "" : " · preferred"}
              </li>
            ))}
          </ul>
          {advice && (
            <p className="body-sm" style={{ margin: "var(--space-12) 0 0", color: "var(--ink)" }}>
              <span className="mono-micro" style={{ color: "var(--ink-subtle)" }}>How to close this &mdash; </span>
              {advice}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
