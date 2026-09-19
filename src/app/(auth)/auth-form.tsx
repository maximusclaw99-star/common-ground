"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";

export function AuthForm({
  mode, action, next, demo,
}: {
  mode: "sign-in" | "sign-up";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
  demo: boolean;
}) {
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
          ? "We never post, message or apply as you."
          : "Pick up where you left off."}
      </p>

      {demo && (
        <div className="tb-panel" style={{ marginTop: "var(--space-24)" }}>
          <p className="mono-label" style={{ color: "var(--alert)", margin: 0 }}>
            <span className="tb-led tb-led--alert" aria-hidden /> No database configured
          </p>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 var(--space-16)" }}>
            Accounts do not exist yet. The app is running in demo mode with one student loaded.
          </p>
          <Link href="/onboarding/upload" className="tb-btn tb-btn--sm mono-label">
            Skip straight in &#8599;
          </Link>
        </div>
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
