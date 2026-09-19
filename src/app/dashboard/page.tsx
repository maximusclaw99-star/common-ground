import Link from "next/link";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/chrome";
import { PersonCard } from "@/components/person-card";
import { rankPeople } from "@/lib/affinity/score";
import { computeGaps } from "@/lib/intake/gaps";
import { getPeopleProvider } from "@/lib/people";
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

  const people = await getPeopleProvider().getPeople({
    companies: student.facts.target_companies,
    limit: 400,
  });
  const { results, demand } = rankPeople(
    { profile: student.profile, facts: student.facts },
    people,
  );
  const byId = new Map(people.map((p) => [p.id, p]));

  const gaps = computeGaps({
    profile: student.profile, facts: student.facts, meta: student.meta, demand,
  });
  const strong = results.filter((r) => r.rank <= 5);
  const timely = results.filter((r) => r.outreach.timing);

  return (
    <div className="min-h-dvh">
      <Header demo={demo} email={student.email} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-[34px] leading-tight">
          {results.length} {results.length === 1 ? "person" : "people"}, ranked by what you
          actually share
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          {strong.length > 0
            ? `${strong.length} of them share a school, an organisation, an employer or a hometown with you. Start there — those are the messages that get answered.`
            : "Nothing above a shared industry yet. The questions below are what would change that."}
        </p>

        {timely.length > 0 && (
          <section className="mt-8 rounded-[14px] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] p-5">
            <h2 className="text-[19px]">Write to these first — the window is closing</h2>
            <p className="mt-1 text-[14px] text-[var(--color-muted)]">
              {timely[0].outreach.timing}. After that it stops being a reason to write, so we
              stop showing it as one.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {timely.map((r) => <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />)}
            </div>
          </section>
        )}

        {gaps.length > 0 && (
          <section className="mt-8 card p-5">
            <h2 className="text-[19px]">
              {gaps.length} question{gaps.length === 1 ? "" : "s"} left
            </h2>
            <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
              {gaps[0].demandCount > 0 ? (
                <>
                  &ldquo;{gaps[0].field.question}&rdquo; is the one worth answering next —{" "}
                  {gaps[0].demandCount} {gaps[0].demandCount === 1 ? "person" : "people"} here would
                  move up the ladder if we knew.
                </>
              ) : (
                "Each one adds people we can find for you."
              )}
            </p>
            <Link href="/intake"
              className="focus-ring mt-4 inline-block rounded-xl bg-[var(--color-ink)] px-4 py-2 text-[14px] font-medium text-[var(--color-paper)]">
              Answer them
            </Link>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-[22px]">Everyone, strongest first</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {results.map((r) => (
              <PersonCard key={r.personId} person={byId.get(r.personId)!} result={r} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
