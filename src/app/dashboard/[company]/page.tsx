import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { windowLabel } from "@/components/opening-row";
import { PersonCard } from "@/components/person-card";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { rankPeople } from "@/lib/affinity/score";
import { KNOWN_COMPANIES, companyInfo, resolveCompanySlug, sameCompany } from "@/lib/companies";
import { loadCompanyPool, peopleAt, positionsAt } from "@/lib/companies/pool";
import { computeGaps } from "@/lib/intake/gaps";
import { rankPositions } from "@/lib/positions";
import { getSession } from "@/lib/session";
import { chooseCompany } from "../actions";

export const dynamic = "force-dynamic";

/**
 * One company: everyone there, strongest connection first, plus its openings
 * and the questions that would move people up. The "everyone" ranking the
 * old dashboard led with survives only as a short tail — strong ties at other
 * companies are still worth a message, they are just not what this page is
 * for.
 */
export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/dashboard/${slug}`);

  const chosen = student.facts.target_companies;
  const pool = await loadCompanyPool(chosen);

  const name = resolveCompanySlug(slug, [...chosen, ...pool.companies.map((c) => c.name)])
    ?? KNOWN_COMPANIES.find((c) => c.slug === slug)?.name
    ?? null;
  if (!name) notFound();
  const info = companyInfo(name);
  const onList = chosen.some((c) => sameCompany(c, name));

  const scorable = { profile: student.profile, facts: student.facts };
  const here = peopleAt(pool.people, name);
  const { results, demand } = rankPeople(scorable, here);
  const byId = new Map(pool.people.map((p) => [p.id, p]));
  const strong = results.filter((r) => r.rank <= 5);
  const timely = results.filter((r) => r.outreach.timing);
  const best = results[0];

  // Strong ties elsewhere: a shared fraternity is a shared fraternity
  // wherever they work. Shown small, after the company's own people.
  const elsewhere = rankPeople(scorable, pool.people.filter((p) => !here.includes(p)))
    .results.filter((r) => r.rank <= 7).slice(0, 4);

  const gaps = computeGaps({ profile: student.profile, facts: student.facts, meta: student.meta, demand });

  const openings = rankPositions(scorable, positionsAt(pool.positions, name))
    .filter((r) => r.fit.windowStatus !== "closed")
    .sort((a, b) => a.position.opensOn.localeCompare(b.position.opensOn) || b.fit.score - a.fit.score)
    .slice(0, 5);

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="people" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <Link className="tb-link mono-label" href="/dashboard">&larr; Change company</Link>
          <div className="mt-[var(--space-16)] flex flex-wrap items-center justify-between gap-[var(--space-24)]">
            <div className="flex items-center gap-[var(--space-16)]">
              <CompanyLogo name={info.name} size={56} />
              <div>
                <h1 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>{info.name}</h1>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "var(--space-8) 0 0" }}>
                  {info.sector ?? "Your pick"} &middot; {results.length} {results.length === 1 ? "person" : "people"}
                  {openings.length > 0 && <> &middot; {openings.length} opening{openings.length === 1 ? "" : "s"}</>}
                </p>
              </div>
            </div>
            {!onList && (
              <form action={chooseCompany}>
                <input type="hidden" name="company" value={info.name} />
                <button type="submit" className="tb-btn tb-btn--solid mono-label">Add to my companies</button>
              </form>
            )}
          </div>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: "var(--space-24) 0 0" }}>
            {results.length === 0
              ? "Nobody here yet in the people we can reach. Add the company anyway and check back — or pick one where we have someone."
              : strong.length > 0
                ? `${strong.length} of them share a school, an organisation, an employer or a hometown with you. Start there.`
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
            <div className="tb-cards tb-cards--2">
              {timely.map((r) => <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />)}
            </div>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
              People at {info.name}
            </h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              Strongest connection first &middot; every card names the fact that produced it
            </p>
            <div className="tb-cards tb-cards--2">
              {results.slice(0, 120).map((r) => (
                <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />
              ))}
            </div>
            {results.length > 120 && (
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
                Showing the top 120 of {results.length}.
              </p>
            )}
          </div>
        </section>
      )}

      {(gaps.length > 0 || openings.length > 0) && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap tb-stack">
            {gaps.length > 0 && (
              <div className="tb-panel flex flex-wrap items-center justify-between gap-[var(--space-16)]">
                <div className="tb-copy">
                  <p className="mono-label" style={{ margin: 0 }}>
                    {gaps.length} question{gaps.length === 1 ? "" : "s"} outstanding
                  </p>
                  <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
                    {gaps[0].demandCount > 0 ? (
                      <>
                        Next: &ldquo;{gaps[0].field.question}&rdquo; &mdash; {gaps[0].demandCount}{" "}
                        {gaps[0].demandCount === 1 ? "person" : "people"} at {info.name} would move up if we knew.
                      </>
                    ) : (
                      "Each one adds people we can find."
                    )}
                  </p>
                </div>
                <Link className="tb-btn mono-label" href="/intake">Answer them &#8599;</Link>
              </div>
            )}

            {openings.length > 0 && (
              <div className="tb-panel">
                <div className="flex flex-wrap items-center justify-between gap-[var(--space-16)]">
                  <p className="mono-label" style={{ margin: 0 }}>&gt; Openings at {info.name}</p>
                  <Link className="tb-link mono-label" href="/jobs">All openings &#8599;</Link>
                </div>
                <ul style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-12)" }}>
                  {openings.map(({ position, fit }) => (
                    <li key={position.id} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                      <span className="body-sm" style={{ margin: 0 }}>
                        {position.title}
                        {position.location && <span style={{ color: "var(--ink-faint)" }}> &middot; {position.location}</span>}
                      </span>
                      <span className="mono-micro" style={{ color: fit.windowStatus === "upcoming" ? "var(--ink-faint)" : "var(--alert)", whiteSpace: "nowrap" }}>
                        {windowLabel(fit)} &middot; {position.opensOn}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {elsewhere.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
              Strong ties elsewhere
            </h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              Not at {info.name}, but the connection is real &middot; worth a message anyway
            </p>
            <div className="tb-cards tb-cards--2">
              {elsewhere.map((r) => <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />)}
            </div>
          </div>
        </section>
      )}

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Company", value: info.name },
          { label: "People here", value: String(results.length) },
          { label: "Strongest", value: best ? `Tier ${best.rank} / ${Math.round(best.score)}` : "None" },
          { label: "Questions left", value: String(gaps.length) },
          { label: "Source", value: pool.peopleSource },
        ]}
      />
    </div>
  );
}
