import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { Avatar } from "@/components/avatar";
import { TierBadge, TierLadder, tierColor } from "@/components/tier-badge";
import { scoreAffinity } from "@/lib/affinity/score";
import { getPeopleProvider } from "@/lib/people";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/people/${id}`);

  const provider = getPeopleProvider();
  const people = await provider.getPeople({ companies: student.facts.target_companies, limit: 2000 });
  const person = people.find((p) => p.id === id);
  if (!person) notFound();

  const result = scoreAffinity({ profile: student.profile, facts: student.facts }, person);

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="people" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <Link className="tb-link mono-label" href="/dashboard">&larr; All people</Link>
          <div className="mt-[var(--space-16)] flex flex-wrap items-start justify-between gap-[var(--space-16)]">
            <div className="flex items-center gap-[var(--space-16)]">
              <Avatar name={person.fullName} src={person.photoUrl} size={72} />
              <div>
                <h1 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>
                  {person.fullName}
                </h1>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "var(--space-12) 0 0" }}>
                  {person.currentTitle} &middot; {person.currentCompany}
                </p>
                {person.email && (
                  <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-8) 0 0", textTransform: "none" }}>
                    {person.email}
                  </p>
                )}
              </div>
            </div>
            <TierBadge rank={result.rank} score={result.score} />
          </div>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid gap-[var(--space-32)] lg:grid-cols-[1.35fr_1fr]">
          <div className="grid gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Why they came up</p>
              <h2 className="title" style={{ textTransform: "uppercase", margin: "var(--space-12) 0 var(--space-16)" }}>
                {result.tierLabel}
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "var(--space-16)" }}>
                {result.evidence.length === 0 && (
                  <li className="body-sm" style={{ color: "var(--ink-muted)" }}>
                    Nothing beyond wanting to work there &mdash; the weakest reason on the list.
                  </li>
                )}
                {result.evidence.map((e, i) => (
                  <li key={i} style={{ display: "flex", gap: "var(--space-12)" }}>
                    <span aria-hidden style={{ width: 8, height: 8, marginTop: 7, flexShrink: 0, background: tierColor(e.rank) }} />
                    <div>
                      <p className="body-sm" style={{ margin: 0 }}>{e.label}</p>
                      <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-4) 0 0" }}>
                        Yours: {e.studentValue || "—"} &middot; Theirs: {e.personValue || "—"}
                        {e.confidence < 1 && ` · ${Math.round(e.confidence * 100)}% sure`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Your opening line</p>
              <blockquote className="mono-body" style={{
                margin: "var(--space-16) 0", padding: "var(--space-16)",
                background: "var(--canvas)", borderLeft: "var(--border-2) solid var(--rule-strong)",
                textTransform: "none",
              }}>
                {result.outreach.opener}
              </blockquote>
              <div className="tb-rule" style={{ paddingTop: "var(--space-16)" }}>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>What to do with it</p>
                <p className="body-sm" style={{ margin: "var(--space-8) 0 0" }}>{result.outreach.guidance}</p>
                {result.outreach.timing && (
                  <p className="mono-label" style={{ color: "var(--alert)", margin: "var(--space-12) 0 0" }}>
                    <span className="tb-led tb-led--alert" aria-hidden /> {result.outreach.timing}
                  </p>
                )}
              </div>
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
                A starting point, not a script. We do not send it for you.
              </p>
            </div>
          </div>

          <aside className="grid gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "0 0 var(--space-12)" }}>
                &gt; Where this lands
              </p>
              <TierLadder activeRank={result.rank} />
            </div>

            {result.unlockable.length > 0 && (
              <div className="tb-panel">
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; What would move them up</p>
                <ul className="body-sm" style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", color: "var(--ink-muted)", display: "grid", gap: "var(--space-8)" }}>
                  {result.unlockable.map((u) => (
                    <li key={u.fieldId}>{u.because} — tell us and we can check tier {u.rank}.</li>
                  ))}
                </ul>
                <Link className="tb-btn tb-btn--sm mono-label" href="/intake" style={{ marginTop: "var(--space-16)" }}>
                  Answer those
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Tier", value: String(result.rank) },
          { label: "Score", value: `${Math.round(result.score)} / 100` },
          { label: "Evidence", value: String(result.evidence.length) },
          { label: "Source", value: person.source },
        ]}
      />
    </div>
  );
}
