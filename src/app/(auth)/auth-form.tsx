"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";

/** Why the student was sent here, when they did not come on their own. */
const REASONS: Record<string, (demo: boolean) => string> = {
  expired: (demo) => demo
    ? "Your session ended: this server's memory was cleared, which takes demo accounts with it. Make the account again and carry on."
    : "Your session ended. Sign in again to carry on.",
};

export function AuthForm({
  mode, action, next, demo, reason, demoLogin,
}: {
  mode: "sign-in" | "sign-up";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
  demo: boolean;
  reason?: string;
  /** The standing demo account, shown so nobody has to make one just to look. */
  demoLogin?: { email: string; password: string } | null;
}) {
  const why = reason ? REASONS[reason]?.(demo) : undefined;
  const [state, formAction, pending] = useActionState(action, { error: null });
  const signingUp = mode === "sign-up";

  return (
    <div className="mx-auto w-full max-w-sm">
      <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>
        &gt; {signingUp ? "New account" : "Returning"}
      </p>
      <h1 className="display-sm" style={{ textTransform: "uppercase", margin: "var(--space-12) 0" }}>
        {signingUp ? "Make an account" : "Welcome back"}
      </h1>
      <p className="body" style={{ color: "var(--ink-muted)", margin: 0 }}>
        {signingUp
          ? "Your resume and answers are yours alone. We never post, message or apply as you."
          : "Pick up where you left off."}
      </p>

      {why && (
        <p className="body-sm tb-panel" role="status" style={{ marginTop: "var(--space-24)", color: "var(--ink)" }}>
          <span className="mono-label" style={{ color: "var(--alert)" }}>
            <span className="tb-led tb-led--alert" aria-hidden /> Signed out &mdash;{" "}
          </span>
          {why}
        </p>
      )}

      {demo && (
        <p className="body-sm tb-panel" style={{ marginTop: "var(--space-24)", color: "var(--ink-muted)" }}>
          <span className="mono-label" style={{ color: "var(--alert)" }}>
            <span className="tb-led tb-led--alert" aria-hidden /> Demo mode &mdash;{" "}
          </span>
          accounts live in this server&rsquo;s memory and are cleared when it restarts. Any address
          works; nothing is sent to it.
          {demoLogin && (
            <span className="block" style={{ marginTop: "var(--space-12)" }}>
              Just looking? Sign in as{" "}
              <code className="mono-label" style={{ color: "var(--ink)", textTransform: "none" }}>{demoLogin.email}</code>
              {" "}with password{" "}
              <code className="mono-label" style={{ color: "var(--ink)", textTransform: "none" }}>{demoLogin.password}</code>.
            </span>
          )}
        </p>
      )}

      <form action={formAction} className="mt-[var(--space-32)] grid gap-[var(--space-20)]">
        <input type="hidden" name="next" value={next} />
        <Labelled label="Email">
          <input name="email" type="email" autoComplete="email" required className="tb-field" />
        </Labelled>
        <Labelled label="Password" hint={signingUp ? "At least six characters." : undefined}>
          <input name="password" type="password" minLength={6}
            autoComplete={signingUp ? "new-password" : "current-password"} required className="tb-field" />
        </Labelled>

        {state.error && <p className="body-sm" style={{ color: "var(--alert)", margin: 0 }}>{state.error}</p>}

        {state.notice && (
          <p className="body-sm tb-panel" style={{ margin: 0, color: "var(--ink-muted)" }}>
            <span className="tb-led tb-led--live" aria-hidden /> {state.notice}
          </p>
        )}

        <button type="submit" disabled={pending} aria-disabled={pending}
          className="tb-btn tb-btn--solid mono-label" style={{ justifyContent: "center" }}>
          {pending ? "One moment" : signingUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mono-micro" style={{ color: "var(--ink-faint)", marginTop: "var(--space-24)", textTransform: "none" }}>
        {signingUp ? "Already have one? " : "New here? "}
        <Link href={signingUp ? "/sign-in" : "/sign-up"} className="tb-link" style={{ color: "var(--ink)" }}>
          {signingUp ? "Sign in" : "Make an account"}
        </Link>
      </p>
    </div>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono-label block" style={{ marginBottom: "var(--space-8)" }}>{label}</span>
      {children}
      {hint && (
        <span className="mono-micro block" style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)", textTransform: "none" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
