import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { PersonCard } from "@/components/person-card";
import { rankPeople } from "@/lib/affinity/score";
import { computeGaps } from "@/lib/intake/gaps";
import { getPeopleProvider } from "@/lib/people";
import { getPositionsProvider, rankPositions } from "@/lib/positions";
import { windowLabel } from "@/components/opening-row";
import { getSession } from "@/lib/session";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/dashboard");

  const provider = getPeopleProvider();
  const people = await provider.getPeople({ companies: student.facts.target_companies, limit: 2000 });
  const { results, demand } = rankPeople({ profile: student.profile, facts: student.facts }, people);
  const byId = new Map(people.map((p) => [p.id, p]));

  const gaps = computeGaps({
    profile: student.profile, facts: student.facts, meta: student.meta, demand,
  });
  const strong = results.filter((r) => r.rank <= 5);
  const timely = results.filter((r) => r.outreach.timing);
  const best = results[0];

  // The three soonest windows worth the student's attention. Never blocks the
  // page: if the openings provider fails, the people ranking still renders.
  const nextWindows = await getPositionsProvider()
    .getPositions({ companies: student.facts.target_companies, limit: 400 })
    .then((positions) => rankPositions({ profile: student.profile, facts: student.facts }, positions)
      .filter((r) => r.fit.windowStatus !== "closed" && r.fit.score >= 45)
      .sort((a, b) => a.position.opensOn.localeCompare(b.position.opensOn) || b.fit.score - a.fit.score)
      .slice(0, 3))
    .catch((err) => { console.warn("[dashboard] openings unavailable", err instanceof Error ? err.message : err); return []; });

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="people" signedIn cta={null} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            {results.length} people,<br />strongest first.
          </h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>
            {strong.length > 0
              ? `${strong.length} share a school, an organisation, an employer or a hometown with you. Start there.`
              : "Nothing above a shared industry yet. The questions below would change that."}
          </p>
        </div>
      </section>

      {timely.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <p className="mono-label" style={{ color: "var(--alert)", margin: "0 0 var(--space-8)" }}>
              <span className="tb-led tb-led--alert" aria-hidden /> Window closing
            </p>
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
              Write to these first
            </h2>
            <p className="body-sm tb-copy" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-24)" }}>
              {timely[0].outreach.timing}.
            </p>
            <div className="grid gap-[var(--space-16)] md:grid-cols-2">
              {timely.map((r) => <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />)}
            </div>
          </div>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap tb-panel flex flex-wrap items-center justify-between gap-[var(--space-16)]">
            <div className="tb-copy">
              <p className="mono-label" style={{ margin: 0 }}>
                {gaps.length} question{gaps.length === 1 ? "" : "s"} outstanding
              </p>
              <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
                {gaps[0].demandCount > 0 ? (
                  <>
                    Next: &ldquo;{gaps[0].field.question}&rdquo; &mdash; {gaps[0].demandCount}{" "}
                    {gaps[0].demandCount === 1 ? "person" : "people"} here would move up if we knew.
                  </>
                ) : (
                  "Each one adds people we can find."
                )}
              </p>
            </div>
            <Link className="tb-btn mono-label" href="/intake">Answer them &#8599;</Link>
          </div>
        </section>
      )}

      {nextWindows.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap tb-panel">
            <div className="flex flex-wrap items-center justify-between gap-[var(--space-16)]">
              <p className="mono-label" style={{ margin: 0 }}>&gt; Next windows</p>
              <Link className="tb-link mono-label" href="/jobs">All openings &#8599;</Link>
            </div>
            <ul style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
              {nextWindows.map(({ position, fit }) => (
                <li key={position.id} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                  <span className="body-sm" style={{ margin: 0 }}>
                    {position.title} <span style={{ color: "var(--ink-faint)" }}>&middot; {position.company}</span>
                  </span>
                  <span className="mono-micro" style={{ color: fit.windowStatus === "upcoming" ? "var(--ink-faint)" : "var(--alert)", whiteSpace: "nowrap" }}>
                    {windowLabel(fit)} &middot; {position.opensOn}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap">
          <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-24)" }}>
            Everyone
          </h2>
          <div className="grid gap-[var(--space-16)] md:grid-cols-2">
            {results.slice(0, 120).map((r) => (
              <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />
            ))}
          </div>
          {results.length > 120 && (
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
              Showing the top 120 of {results.length}. Everyone below this line shares at most an industry with you.
            </p>
          )}
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "People", value: String(results.length) },
          { label: "Strongest", value: best ? `Tier ${best.rank} / ${Math.round(best.score)}` : "None" },
          { label: "Above tier 5", value: String(strong.length) },
          { label: "Questions left", value: String(gaps.length) },
          { label: "Source", value: provider.name },
        ]}
      />
    </div>
  );
}
