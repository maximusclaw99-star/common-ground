import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Footer, Header } from "@/components/chrome";
import { TierBadge, TierLadder } from "@/components/tier-badge";
import { scoreAffinity } from "@/lib/affinity/score";
import { getPeopleProvider } from "@/lib/people";
import { getSession } from "@/lib/session";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/people/${id}`);

  const people = await getPeopleProvider().getPeople({
    companies: student.facts.target_companies, limit: 400,
  });
  const person = people.find((p) => p.id === id);
  if (!person) notFound();

  const result = scoreAffinity({ profile: student.profile, facts: student.facts }, person);

  return (
    <div className="min-h-dvh">
      <Header demo={demo} email={student.email} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/dashboard" className="focus-ring text-[14px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← All people
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[34px] leading-tight">{person.fullName}</h1>
            <p className="mt-1 text-[16px] text-[var(--color-muted)]">
              {person.currentTitle} · {person.currentCompany}
            </p>
          </div>
          <TierBadge rank={result.rank} score={result.score} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-6">
            <section className="card p-6">
              <h2 className="text-[20px]">Why they came up</h2>
              <p className="mt-1 text-[14px] text-[var(--color-muted)]">{result.tierLabel}</p>
              <ul className="mt-4 space-y-3">
                {result.evidence.length === 0 && (
                  <li className="text-[14px] text-[var(--color-muted)]">
                    Nothing beyond the fact that you want to work there. That is a real reason to
                    write, but it is the weakest one on the list.
                  </li>
                )}
                {result.evidence.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                      style={{ background: `var(--tier-${e.rank})` }} />
                    <div>
                      <p className="text-[15px]">{e.label}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--color-faint)]">
                        yours: {e.studentValue || "—"} · theirs: {e.personValue || "—"}
                        {e.confidence < 1 && ` · ${Math.round(e.confidence * 100)}% sure`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card p-6">
              <h2 className="text-[20px]">Your opening line</h2>
              <p className="mt-1 text-[14px] text-[var(--color-muted)]">
                A starting point, not a script. Rewrite it in your own words — that is the entire
                point of sending it.
              </p>
              <blockquote className="mt-4 rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-raised)] px-4 py-3 text-[15px] leading-relaxed">
                {result.outreach.opener}
              </blockquote>
              <div className="mt-4 rule pt-4">
                <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--color-faint)]">
                  What to do with it
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed">{result.outreach.guidance}</p>
                {result.outreach.timing && (
                  <p className="mt-2 text-[14px] text-[var(--color-accent)]">
                    Timing: {result.outreach.timing}.
                  </p>
                )}
              </div>
              <p className="mt-4 text-[13px] text-[var(--color-faint)]">
                We do not send this for you, and we never will. A message that arrives without a
                person behind it is the problem we exist to solve.
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-4">
              <h2 className="px-2 pt-1 text-[16px]">Where this lands on the ladder</h2>
              <div className="mt-2">
                <TierLadder activeRank={result.rank} />
              </div>
            </section>

            {result.unlockable.length > 0 && (
              <section className="card p-5">
                <h2 className="text-[16px]">What would move them up</h2>
                <ul className="mt-2 space-y-2 text-[14px] text-[var(--color-muted)]">
                  {result.unlockable.map((u) => (
                    <li key={u.fieldId}>
                      {u.because} — tell us and we can check tier {u.rank}.
                    </li>
                  ))}
                </ul>
                <Link href="/intake"
                  className="focus-ring mt-4 inline-block rounded-lg border px-3 py-1.5 text-[13px] hover:bg-[var(--color-raised)]">
                  Answer those
                </Link>
              </section>
            )}

            <section className="card p-5 text-[13px] leading-relaxed text-[var(--color-muted)]">
              <p>
                Scored deterministically from {result.components.base} (tier floor) plus a
                within-tier bonus. Nothing about this ranking is a model&rsquo;s opinion — you can
                read exactly which fact produced it above.
              </p>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
