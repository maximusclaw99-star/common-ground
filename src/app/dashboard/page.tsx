import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { companyInfo, sameCompany } from "@/lib/companies";
import { loadCompanyPool, type CompanySummary } from "@/lib/companies/pool";
import { computeGaps } from "@/lib/intake/gaps";
import { getSession } from "@/lib/session";
import { chooseCompany, dropCompany } from "./actions";

/** Per-student, so never prerendered. */
export const dynamic = "force-dynamic";

/**
 * The dashboard opens on a choice, not a list. The student picks the company
 * they want to apply to; only then do they see who to write to there. Ranking
 * everyone at every company at once — what this page did before — buried the
 * one question a student actually has, which is "who do I know at Deloitte".
 */
export default async function DashboardPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/dashboard");

  const chosen = student.facts.target_companies;
  const pool = await loadCompanyPool(chosen);
  const gaps = computeGaps({ profile: student.profile, facts: student.facts, meta: student.meta });

  const isChosen = (name: string) => chosen.some((c) => sameCompany(c, name));
  const mine: CompanySummary[] = chosen.map((name) => {
    const found = pool.companies.find((c) => sameCompany(c.name, name));
    return found ?? { ...companyInfo(name), people: 0, openings: 0 };
  });
  const others = pool.companies.filter((c) => !isChosen(c.name));

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="people" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Your dashboard</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            Pick a company.<br />Then meet the people.
          </h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>
            One at a time. Choose where you want to apply and we rank everyone there by what you
            genuinely have in common with them.
          </p>
        </div>
      </section>

      {mine.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
              Your companies
            </h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              {mine.length} chosen &middot; openings here rank higher for you
            </p>
            <div className="tb-cards tb-cards--2 tb-cards--3-lg">
              {mine.map((c) => (
                <CompanyCard key={c.slug} company={c} chosen />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap">
          <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
            {mine.length ? "Add another" : "Where we can find people"}
          </h2>
          <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
            {others.length} compan{others.length === 1 ? "y" : "ies"} with someone to write to &middot; most people first
          </p>
          {others.length > 0 ? (
            <div className="tb-cards tb-cards--2 tb-cards--3-lg">
              {others.map((c) => (
                <CompanyCard key={c.slug} company={c} />
              ))}
            </div>
          ) : (
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
              Every company we can reach is already on your list.
            </p>
          )}
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap tb-stack">
          <form action={chooseCompany} className="tb-panel">
            <p className="mono-label" style={{ margin: 0 }}>Somewhere else?</p>
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 var(--space-16)" }}>
              Name it and we will look. If we have nobody there yet, the page says so rather than guessing.
            </p>
            <div className="flex flex-wrap items-center gap-[var(--space-12)]">
              <input name="company" type="text" required maxLength={80} autoComplete="organization"
                placeholder="Company name" className="tb-field" style={{ flex: "1 1 240px", width: "auto" }} />
              <button type="submit" className="tb-btn tb-btn--solid mono-label">Go &#8599;</button>
            </div>
          </form>

          {gaps.length > 0 && (
            <div className="tb-panel flex flex-wrap items-center justify-between gap-[var(--space-16)]">
              <div className="tb-copy">
                <p className="mono-label" style={{ margin: 0 }}>
                  {gaps.length} question{gaps.length === 1 ? "" : "s"} outstanding
                </p>
                <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
                  Next: &ldquo;{gaps[0].field.question}&rdquo; &mdash; each answer finds more people at every company.
                </p>
              </div>
              <Link className="tb-btn mono-label" href="/intake">Answer them &#8599;</Link>
            </div>
          )}
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Companies", value: String(pool.companies.length) },
          { label: "Chosen", value: String(chosen.length) },
          { label: "People", value: String(pool.people.length) },
          { label: "Openings", value: String(pool.positions.length) },
          { label: "Source", value: pool.peopleSource },
        ]}
      />
    </div>
  );
}

/**
 * One company. The whole card is the button that chooses it, because a card
 * with a separate "choose" link makes the student read two things to do one.
 * Chosen companies link straight to their page and carry a quiet remove.
 */
function CompanyCard({ company, chosen = false }: { company: CompanySummary; chosen?: boolean }) {
  const counts = (
    <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-12) 0 0", textTransform: "none" }}>
      {company.people} {company.people === 1 ? "person" : "people"} &middot; {company.openings} opening{company.openings === 1 ? "" : "s"}
    </p>
  );
  const identity = (
    <div className="flex min-w-0 items-center gap-[var(--space-12)]">
      <CompanyLogo name={company.name} size={40} />
      <div className="min-w-0">
        <p className="title truncate" style={{ textTransform: "uppercase", margin: 0 }}>{company.name}</p>
        <p className="mono-micro truncate" style={{ color: "var(--ink-faint)", margin: "var(--space-4) 0 0" }}>
          {company.sector ?? "Chosen by you"}
        </p>
      </div>
    </div>
  );

  if (chosen) {
    return (
      <article className="tb-card" style={{ position: "relative" }}>
        <Link href={`/dashboard/${company.slug}`} className="block" style={{ color: "inherit", textDecoration: "none" }}>
          {identity}
          {counts}
          <p className="mono-label" style={{ color: "var(--signal)", margin: "var(--space-16) 0 0" }}>
            See the people &#8599;
          </p>
        </Link>
        <form action={dropCompany} style={{ position: "absolute", top: "var(--space-12)", right: "var(--space-12)" }}>
          <input type="hidden" name="company" value={company.name} />
          <button type="submit" className="tb-link mono-micro" aria-label={`Remove ${company.name}`}
            style={{ background: "none", border: 0, cursor: "pointer", color: "var(--ink-faint)" }}>
            Remove
          </button>
        </form>
      </article>
    );
  }

  return (
    <form action={chooseCompany}>
      <input type="hidden" name="company" value={company.name} />
      <button type="submit" className="tb-card" style={{ width: "100%", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}>
        {identity}
        {counts}
      </button>
    </form>
  );
}
