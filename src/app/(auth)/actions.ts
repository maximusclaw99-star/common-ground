"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_COOKIE } from "@/lib/session/cookie";
import { demoStore } from "@/lib/session/demo-store";

export interface AuthState {
  error: string | null;
  /** Not a failure: something happened that the student has to act on. */
  notice?: string | null;
}

const DEMO_SESSION_DAYS = 30;

/** Only ever a same-site path, so a `next` param cannot send anyone off-site. */
const safeNext = (raw: unknown, fallback: string): string => {
  const s = String(raw ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
};

async function startDemoSession(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(DEMO_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: DEMO_SESSION_DAYS * 24 * 60 * 60,
  });
}

async function authenticate(
  mode: "sign-in" | "sign-up",
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), mode === "sign-up" ? "/onboarding/upload" : "/dashboard");
  if (!email || !password) return { error: "Email and password are both needed." };
  if (password.length < 6) return { error: "Password needs at least six characters." };

  // Demo mode: an account is a row in this server's memory. The point is not
  // security, it is that every student gets their own resume and answers —
  // the flow is the same one a real project runs, minus the durability.
  if (!isSupabaseConfigured()) {
    if (mode === "sign-in") {
      const account = demoStore.authenticate(email, password);
      if (!account) {
        return {
          error: demoStore.hasAccount(email)
            ? "That password does not match."
            : "No account with that address on this server. Demo accounts live in memory and are cleared when it restarts — make a new one.",
        };
      }
      await startDemoSession(account.id);
      redirect(next);
    }

    const account = demoStore.createAccount(email, password);
    if (!account) return { error: "That address already has an account here. Sign in instead." };
    await startDemoSession(account.id);
    redirect(next);
  }

  const supabase = await createClient();

  if (mode === "sign-in") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    redirect(next);
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // Supabase confirms addresses by default, and then hands back a user with
  // no session. Redirecting on that would bounce straight off the proxy and
  // land the student back here with nothing said — so say it.
  if (!data.session) {
    return {
      error: null,
      notice: `Check ${email} for a confirmation link. The account is not live until you open it.`,
    };
  }
  redirect(next);
}

export const signIn = authenticate.bind(null, "sign-in");
export const signUp = authenticate.bind(null, "sign-up");

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } else {
    const jar = await cookies();
    jar.delete(DEMO_COOKIE);
  }
  redirect("/");
}
