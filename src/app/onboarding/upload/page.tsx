import Link from "next/link";
import { Footer, Header } from "@/components/chrome";
import { getSession } from "@/lib/session";
import { UploadForm } from "./upload-form";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const { demo, student } = await getSession();
  return (
    <div className="min-h-dvh">
      <Header demo={demo} email={student?.email} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-[34px] leading-tight">Start with your resume</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-muted)]">
          Everything on it becomes something we can match you on — your school, your employers, the
          clubs in your activities section. We only ask you questions your resume doesn&rsquo;t
          already answer, so the more it says, the less we bother you.
        </p>

        <div className="mt-8"><UploadForm /></div>

        <p className="mt-6 text-[13px] leading-relaxed text-[var(--color-faint)]">
          Stored privately and readable only by you. We never send it anywhere on your behalf.
        </p>

        <div className="mt-10 rule pt-6">
          <p className="text-[14px] text-[var(--color-muted)]">
            Don&rsquo;t have a PDF handy?{" "}
            <Link href="/onboarding/review" className="focus-ring underline underline-offset-4">
              Continue with what we already have
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
