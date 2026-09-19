import Link from "next/link";
import { Nav, StatusFooter, Ticker } from "@/components/tb/chrome";
import { Hero } from "@/components/tb/hero";
import { TierLadder } from "@/components/tier-badge";
import { IN_SCOPE_RANKS, TIERS } from "@/lib/affinity/tiers";
import { FIELDS } from "@/lib/intake/fields";
import { getSession } from "@/lib/session";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { demo } = await getSession();
  const start = demo ? "/onboarding/upload" : "/sign-up";

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      <Ticker items={[
        "Recruiters stopped reading cold applications. They still answer people they have something in common with.",
        "Internships open a year early. The students who get them started talking long before the posting went up.",
      ]} />
      <Nav cta={{ label: "Sign in", href: "/sign-in" }} />

      <Hero
        head={<>Eleven people,<br />not a thousand<br />applications.</>}
        lines={[
          `> ranking ${TIERS.filter((t) => t.inScope).length} kinds of common ground...`,
          "> 2 require data we refuse to collect_",
        ]}
        note="Two minutes &middot; We only ask what your resume does not already say"
      >
        <Link className="tb-btn tb-btn--solid mono-label" href={start}>Upload your resume &#8599;</Link>
        <Link className="tb-btn mono-label" href="#ladder">See the ladder</Link>
      </Hero>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid gap-[var(--space-32)] md:grid-cols-3">
          <Point n="01" title="We read your resume first">
            Everything on it becomes a signal we can match on. Then we ask, once, for what a resume
            never carries: where you grew up, which clubs you are actually in, the jump you are
            trying to make.
          </Point>
          <Point n="02" title="We rank people, not postings">
            Eleven levels of common ground, strongest first. A shared fraternity beats a shared
            industry. The scoring is deterministic, so every result shows the exact fact that
            produced it.
          </Point>
          <Point n="03" title="You send the message">
            We draft an opening line from the thing you genuinely share, and say what to ask. We
            never send anything, and we never write as you.
          </Point>
        </div>
      </section>

      <section id="ladder" className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid gap-[var(--space-32)] md:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="mono-label" style={{ color: "var(--ink-subtle)" }}>&gt; The ladder</p>
            <h2 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
              Not all<br />connections<br />are worth<br />the same.
            </h2>
            <div className="tb-copy body" style={{ color: "var(--ink-muted)" }}>
              <p>
                Most tools treat &ldquo;works at your target company&rdquo; as a match. It is the
                weakest signal on this list. We rank on {IN_SCOPE_RANKS.length} levels, and we ask{" "}
                {FIELDS.length} questions at most to fill them in — fewer the more your resume says.
              </p>
              <p style={{ marginBottom: 0 }}>
                The two greyed rungs need your private LinkedIn connection graph. Collecting it
                would mean holding data on people who never signed up here, so we do not.
              </p>
            </div>
          </div>
          <div className="tb-panel"><TierLadder /></div>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap" style={{ textAlign: "center" }}>
          <h2 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>
            Start in your first year.
          </h2>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: "var(--space-16) auto var(--space-32)" }}>
            Not the week applications open. The advantage is entirely in having talked to people
            before the posting went up, and it is available to you right now.
          </p>
          <Link className="tb-btn tb-btn--solid mono-label" href={start}>Upload your resume &#8599;</Link>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Tiers ranked", value: String(IN_SCOPE_RANKS.length) },
          { label: "Tiers refused", value: String(TIERS.filter((t) => !t.inScope).length) },
          { label: "Questions", value: `${FIELDS.length} max` },
          { label: "Outreach", value: "Human" },
        ]}
      />
    </div>
  );
}

function Point({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: 0 }}>{n}</p>
      <h3 className="title" style={{ textTransform: "uppercase", margin: "var(--space-8) 0 var(--space-12)" }}>
        {title}
      </h3>
      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>{children}</p>
    </div>
  );
}
