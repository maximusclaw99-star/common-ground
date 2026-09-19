import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { IntakeFlow } from "@/components/intake/intake-flow";
import { rankPeople } from "@/lib/affinity/score";
import { computeGaps, unroutedUncertainties } from "@/lib/intake/gaps";
import { groupIntoSteps } from "@/lib/intake/steps";
import { FIELDS } from "@/lib/intake/fields";
import { getPeopleProvider } from "@/lib/people";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/intake");

  // Demand-driven ordering: score the people we can already reach so each
  // question can say who it would unlock, rather than merely asserting that it
  // matters. Cheap, because the whole ranking is deterministic and in-memory.
  const people = await getPeopleProvider().getPeople({
    companies: student.facts.target_companies, limit: 400,
  });
  const { demand } = rankPeople({ profile: student.profile, facts: student.facts }, people);

  const gaps = computeGaps({
    profile: student.profile, facts: student.facts, meta: student.meta, demand,
  });
  const steps = groupIntoSteps(gaps);
  const answered = FIELDS.length - gaps.length;

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="profile" signedIn cta={null} />

      <section className="tb-band tb-layer" style={{ flexGrow: 1 }}>
        <div className="tb-wrap" style={{ maxWidth: 760 }}>
          {steps.length === 0 ? <NothingLeftToAsk /> : (
            <IntakeFlow steps={steps} unrouted={unroutedUncertainties(student.profile)} />
          )}
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Answered", value: `${answered} / ${FIELDS.length}` },
          { label: "Outstanding", value: String(gaps.length) },
          { label: "Screens", value: String(steps.length) },
          { label: "Flagged", value: String(gaps.filter((g) => g.reason === "flagged_uncertain").length) },
        ]}
      />
    </div>
  );
}

function NothingLeftToAsk() {
  return (
    <div className="tb-panel" style={{ textAlign: "center" }}>
      <h1 className="display-sm" style={{ textTransform: "uppercase", margin: 0 }}>All caught up</h1>
      <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: "var(--space-16) auto var(--space-24)" }}>
        We have everything we can use. Come back after a career fair or a conference — those
        connections only stay open for about 72 hours, so we will ask again when they matter.
      </p>
      <Link className="tb-btn tb-btn--solid mono-label" href="/dashboard">See your people &#8599;</Link>
    </div>
  );
}
