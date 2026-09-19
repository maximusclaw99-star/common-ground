import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/chrome";
import { getSession } from "@/lib/session";
import { confirmProfile } from "../actions";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/onboarding/review");

  const { profile } = student;
  const a = profile.affinity;

  return (
    <div className="min-h-dvh">
      <Header demo={demo} email={student.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-[34px] leading-tight">Here&rsquo;s what we read</h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)]">
          Everything below is something we can now match you on, so none of it becomes a question.
          Anything we got wrong, you can fix in the next step.
        </p>

        {profile.uncertainties.length > 0 && (
          <section className="mt-8 rounded-[14px] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] p-5">
            <h2 className="text-[19px]">We weren&rsquo;t sure about {profile.uncertainties.length} thing{profile.uncertainties.length === 1 ? "" : "s"}</h2>
            <p className="mt-1 text-[14px] text-[var(--color-muted)]">
              Rather than guess, we wrote them down. Each one turns into a question, shown next to
              exactly what confused us.
            </p>
            <ul className="mt-3 space-y-2 text-[14px] leading-relaxed">
              {profile.uncertainties.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </section>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Facts title="You" items={[
            ["Name", profile.full_name], ["School", a.school_raw ?? profile.school],
            ["Graduating", profile.grad_date], ["Work authorisation", profile.work_auth],
          ]} />
          <Facts title="Study" items={[
            ["Majors", a.majors.join(", ")], ["Minors", a.minors.join(", ")],
            ["Certifications", a.certifications_in_progress.join(", ")],
            ["Clearance", a.clearance],
          ]} />
          <Facts title="Affiliations — the strongest signal we have" items={[
            ["Clubs and orgs", a.student_orgs.join(", ")], ["Greek", a.greek.join(", ")],
            ["Competitions", a.case_competitions.join(", ")], ["Programs", a.programs.join(", ")],
          ]} />
          <Facts title="Work" items={[
            ["Employers", [...new Set([...a.prior_employers, ...profile.experience.map((e) => e.employer)])].join(", ")],
            ["Clients and programmes", a.clients_and_programs.join(", ")],
            ["Projects", profile.projects.map((p) => p.name).join(", ")],
            ["Skills", profile.skills.slice(0, 8).join(", ")],
          ]} />
        </div>

        <form action={confirmProfile} className="mt-10 rule flex flex-wrap items-center gap-4 pt-6">
          <button type="submit"
            className="focus-ring rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-[15px] font-medium text-white">
            Looks right — ask me the rest
          </button>
          <span className="text-[14px] text-[var(--color-faint)]">
            Next we ask only for what a resume never carries.
          </span>
        </form>
      </main>
      <Footer />
    </div>
  );
}

function Facts({ title, items }: { title: string; items: [string, string | null | undefined][] }) {
  return (
    <section className="card p-5">
      <h2 className="text-[17px]">{title}</h2>
      <dl className="mt-3 space-y-2.5">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[12px] uppercase tracking-wide text-[var(--color-faint)]">{label}</dt>
            <dd className={`text-[14px] leading-snug ${value ? "" : "text-[var(--color-faint)] italic"}`}>
              {value || "we'll ask"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
