import Link from "next/link";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/chrome";
import { getSession } from "@/lib/session";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
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

  return (
    <div className="min-h-dvh">
      <Header demo={demo} email={student.email} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-[34px] leading-tight">Openings</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-muted)]">
          We poll the applicant tracking systems behind {targets.length > 0 ? "your target companies" : "33 employers"} every
          morning and keep the entry-level roles, with the date each one opened. Connections come
          first though: a posting you find through a person is worth more than one you find first.
        </p>

        <div className="mt-8 card p-6">
          <h2 className="text-[19px]">Not wired to the page yet</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-muted)]">
            The ingest pipeline is built and tested — Greenhouse, Lever, Ashby and Workday, with
            closure detection that refuses to mark a role closed just because a poll failed. The
            browsing UI on top of it is the next thing we build.
          </p>
          {targets.length > 0 && (
            <p className="mt-4 text-[14px] text-[var(--color-muted)]">
              We&rsquo;ll start with: {targets.join(", ")}.
            </p>
          )}
          <Link href="/dashboard"
            className="focus-ring mt-5 inline-block rounded-xl bg-[var(--color-ink)] px-4 py-2 text-[14px] font-medium text-[var(--color-paper)]">
            Go to your people instead
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
