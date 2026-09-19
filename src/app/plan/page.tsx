import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { AI_QUERY_MODEL } from "@/lib/databricks/sql";
import { getPositionsProvider, rankPositions } from "@/lib/positions";
import { getSession } from "@/lib/session";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

/**
 * The plan agent's page. Pick an opening; a Databricks-hosted model calls the
 * gap check, the learning catalog (a Unity Catalog function) and the resume
 * rewrite, then hands back a plan with its trace. The only two things AI does
 * in this product — tailoring and skill-gap advice — in one place, watchable.
 */
export default async function PlanPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/plan");

  const provider = getPositionsProvider();
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 400 });
  const ranked = rankPositions({ profile: student.profile, facts: student.facts }, positions)
    .filter((r) => r.fit.windowStatus !== "closed")
    .slice(0, 8);

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="plan" signedIn cta={null} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Plan agent on {provider.name}</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            What to earn<br />before it opens.
          </h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>
            Pick an opening. The agent checks what the posting asks for against your confirmed profile, looks up
            the cheapest real way to close each gap, and rewrites your resume for the role without inventing a
            thing. You will see every step it took. It does not apply for you and it never will.
          </p>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer" style={{ flexGrow: 1 }}>
        <div className="tb-wrap">
          {ranked.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--ink-muted)" }}>No open windows match yet. Tell us what you want on the Profile page.</p>
          ) : (
            <PlanForm openings={ranked} provider={provider.name} />
          )}
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Model", value: provider.name === "databricks" ? AI_QUERY_MODEL.replace("databricks-", "") : "none (mock)" },
          { label: "Tools", value: "skill_gaps · learning_options · rewrite_resume" },
          { label: "Catalog", value: "workspace.jobsearch.learning_catalog" },
          { label: "Source", value: provider.name },
        ]}
      />
    </div>
  );
}
