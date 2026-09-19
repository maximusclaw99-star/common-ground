import Link from "next/link";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/chrome";
import { IntakeFlow } from "@/components/intake/intake-flow";
import { rankPeople } from "@/lib/affinity/score";
import { computeGaps, unroutedUncertainties } from "@/lib/intake/gaps";
import { groupIntoSteps } from "@/lib/intake/steps";
import { getPeopleProvider } from "@/lib/people";
import { getSession } from "@/lib/session";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/intake");

  // Demand-driven ordering: score the people we can already reach, so the
  // questionnaire can say "we're asking because eleven people share this"
  // rather than just asserting the question matters. Cheap, because the whole
  // ranking is deterministic and in-memory.
  const people = await getPeopleProvider().getPeople({
    companies: student.facts.target_companies,
    limit: 400,
  });
  const { demand } = rankPeople({ profile: student.profile, facts: student.facts }, people);

  const gaps = computeGaps({
    profile: student.profile,
    facts: student.facts,
    meta: student.meta,
    demand,
  });
  const steps = groupIntoSteps(gaps);

  return (
    <div className="min-h-dvh">
      <Header demo={demo} email={student.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {steps.length === 0 ? <NothingLeftToAsk /> : (
          <IntakeFlow steps={steps} unrouted={unroutedUncertainties(student.profile)} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function NothingLeftToAsk() {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-[30px]">You&rsquo;re all caught up</h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
        We have everything we can use. Come back after a career fair or a conference — those
        connections only stay open for about 72 hours, so we&rsquo;ll ask again when they matter.
      </p>
      <Link href="/dashboard"
        className="focus-ring mt-6 inline-block rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-[15px] font-medium text-white">
        See your people
      </Link>
    </div>
  );
}
