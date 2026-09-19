import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import companies from "@/../data/companies.seed.json";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The openings half of the product. The nightly ATS poller and the entry-level
 * classifier that fill this already exist in src/lib/{ats,jobs}; what is not
 * built yet is the browsing UI on top of them, and claiming otherwise on an
 * empty page would be worse than saying so.
 */
export default async function JobsPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/jobs");

  const targets = student.facts.target_companies;
  const boards = (companies as { ats: string }[]);
  const byAts = boards.reduce<Record<string, number>>((acc, c) => {
    acc[c.ats] = (acc[c.ats] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="openings" signedIn cta={null} />

      <section className="tb-band tb-layer" style={{ flexGrow: 1 }}>
        <div className="tb-wrap" style={{ maxWidth: 720 }}>
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Openings</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            Ingested.<br />Not yet drawn.
          </h1>
          <p className="body" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-32)" }}>
            We poll the applicant tracking systems behind {boards.length} employers every morning and
            keep the entry-level roles with the date each one opened. Connections come first though:
            a posting you find through a person is worth more than one you find first.
          </p>

          <div className="tb-panel">
            <p className="mono-label" style={{ margin: 0 }}>Status</p>
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
              The ingest pipeline is built and tested — Greenhouse, Lever, Ashby and Workday, with
              closure detection that refuses to mark a role closed just because a poll failed. The
              browsing UI on top of it is the next thing we build.
            </p>
            {targets.length > 0 && (
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
                &gt; Starting with: {targets.join(", ")}
              </p>
            )}
            <Link href="/dashboard" className="tb-btn tb-btn--sm mono-label" style={{ marginTop: "var(--space-24)" }}>
              Go to your people &#8599;
            </Link>
          </div>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Boards", value: String(boards.length) },
          ...Object.entries(byAts).map(([ats, n]) => ({ label: ats, value: String(n) })),
          { label: "Poll", value: "07:00 daily" },
        ]}
      />
    </div>
  );
}
