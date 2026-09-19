import Link from "next/link";
import { Footer, Wordmark } from "@/components/chrome";
import { TierLadder } from "@/components/tier-badge";
import { getSession } from "@/lib/session";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { demo } = await getSession();
  const startHref = demo ? "/onboarding/upload" : "/sign-up";

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Wordmark />
        <div className="flex items-center gap-3 text-[14px]">
          <Link href="/sign-in" className="focus-ring rounded-lg px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            Sign in
          </Link>
          <Link href={startHref} className="focus-ring rounded-lg bg-[var(--color-ink)] px-3.5 py-1.5 text-[var(--color-paper)]">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 sm:py-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 py-1 text-[13px] text-[var(--color-accent)]">
            Start in your first year, not the week applications open
          </p>
          <h1 className="max-w-3xl text-[44px] leading-[1.05] sm:text-[60px]">
            Everyone else is sending a thousand applications.
            <br />
            You only need to reach{" "}
            <span className="text-[var(--color-accent)]">eleven people</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-[var(--color-muted)]">
            Recruiters are drowning in AI-written applications, and they have stopped reading them.
            What still works is the thing it always did: a message from someone who shares your
            school, your fraternity, your hometown, or the exact career move you are trying to make.
            We find those people. You write to them.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={startHref} className="focus-ring rounded-xl bg-[var(--color-accent)] px-5 py-3 text-[15px] font-medium text-white">
              Upload your resume
            </Link>
            <span className="text-[14px] text-[var(--color-faint)]">
              Two minutes. We only ask for what your resume doesn&rsquo;t already say.
            </span>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Point
            title="We read your resume first"
            body="Everything on it becomes a signal we can match on. Then we ask you — once — for the things a resume never carries: where you grew up, which clubs you're actually in, the jump you're trying to make."
          />
          <Point
            title="We rank people, not postings"
            body="Eleven levels of commonality, strongest first. A shared fraternity beats a shared industry, and a shared industry beats wanting the job. The ranking is deterministic, so you can see exactly why someone surfaced."
          />
          <Point
            title="You send the message"
            body="We draft a first line from the thing you genuinely share and tell you what to ask. We never send anything, and we never pretend to be you."
          />
        </section>

        <section className="mt-20 grid gap-10 sm:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-[30px] leading-tight">Not all connections are worth the same</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
              Most tools treat &ldquo;works at your target company&rdquo; as a match. It is the
              weakest signal there is. This is the ladder we actually rank on, strongest first — and
              the two rungs we deliberately leave off.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
              The top two rungs need your private LinkedIn connection graph. Collecting that would
              mean holding data on people who never signed up for this, so we don&rsquo;t.
            </p>
          </div>
          <div className="card p-3">
            <TierLadder />
          </div>
        </section>

        <section className="mt-20 mb-8 card p-8 text-center">
          <h2 className="text-[28px]">Internships open a year early.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
            The students who get them started talking to people long before the posting went up.
            That is the entire advantage, and it is available to you right now.
          </p>
          <Link href={startHref} className="focus-ring mt-6 inline-block rounded-xl bg-[var(--color-ink)] px-5 py-3 text-[15px] font-medium text-[var(--color-paper)]">
            Start with your resume
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-[19px]">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}
