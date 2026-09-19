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
      <h1 className="text-[30px] leading-tight">
        {signingUp ? "Make an account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-muted)]">
        {signingUp
          ? "Your resume and your answers stay yours. We never post, message or apply as you."
          : "Pick up where you left off."}
      </p>

      {demo && (
        <div className="mt-5 rounded-lg border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] p-4 text-[14px] leading-relaxed">
          <p className="text-[var(--color-muted)]">
            No database is configured, so accounts don&rsquo;t exist yet — the app is running in
            demo mode with one student already loaded.
          </p>
          <Link href="/onboarding/upload" className="focus-ring mt-3 inline-block font-medium text-[var(--color-accent)]">
            Skip straight in →
          </Link>
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Labelled label="Email">
          <input name="email" type="email" autoComplete="email" required
            className="focus-ring w-full rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-[15px]" />
        </Labelled>
        <Labelled label="Password" hint={signingUp ? "At least six characters." : undefined}>
          <input name="password" type="password" minLength={6}
            autoComplete={signingUp ? "new-password" : "current-password"} required
            className="focus-ring w-full rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-[15px]" />
        </Labelled>

        {state.error && <p className="text-[14px] text-[var(--color-accent)]">{state.error}</p>}

        <button type="submit" disabled={pending}
          className="focus-ring w-full rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50">
          {pending ? "One moment…" : signingUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-[14px] text-[var(--color-muted)]">
        {signingUp ? "Already have one? " : "New here? "}
        <Link href={signingUp ? "/sign-in" : "/sign-up"} className="focus-ring underline underline-offset-4">
          {signingUp ? "Sign in" : "Make an account"}
        </Link>
      </p>
    </div>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-[var(--color-faint)]">{hint}</span>}
    </label>
  );
}
