"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthState {
  error: string | null;
  /** Not a failure: something happened that the student has to act on. */
  notice?: string | null;
}

async function authenticate(
  mode: "sign-in" | "sign-up",
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase isn't configured yet, so there are no accounts to sign in to. Demo mode is already open — just start." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/onboarding/upload";
  if (!email || !password) return { error: "Email and password are both needed." };

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
  }
  redirect("/");
}
