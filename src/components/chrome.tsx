import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="display text-[19px] tracking-tight">Common Ground</span>
    </Link>
  );
}

/**
 * Demo mode is stated on every page rather than in a one-time toast. Quietly
 * dropping a student's answers would be a worse failure than not storing them.
 */
export function DemoBanner() {
  return (
    <div className="border-b border-[var(--color-accent-line)] bg-[var(--color-accent-soft)]">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-[13px]">
        <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
          Demo
        </span>
        <span className="text-[var(--color-muted)]">
          Running without a database — answers last until the server restarts.
        </span>
      </div>
    </div>
  );
}

export function Header({ demo, email }: { demo: boolean; email?: string | null }) {
  return (
    <>
      {demo && <DemoBanner />}
      <header className="sticky top-0 z-20 border-b bg-[var(--color-paper)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Wordmark />
          <nav className="flex items-center gap-1 text-[14px]">
            <NavLink href="/dashboard">People</NavLink>
            <NavLink href="/jobs">Openings</NavLink>
            <NavLink href="/intake">Your profile</NavLink>
            {email && (
              <span className="ml-3 hidden text-[13px] text-[var(--color-faint)] sm:inline">{email}</span>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring rounded-lg px-2.5 py-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto max-w-5xl px-4 py-8 text-[13px] leading-relaxed text-[var(--color-faint)]">
        <p className="max-w-2xl">
          We rank people by what you genuinely have in common, and we stop there. Every message you
          send is written by you — we don&rsquo;t automate outreach, and we don&rsquo;t keep a standing
          database of people who never signed up.
        </p>
      </div>
    </footer>
  );
}
