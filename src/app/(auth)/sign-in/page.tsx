import { AuthForm } from "../auth-form";
import { signIn } from "../actions";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function SignInPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  // Demo mode: nothing to sign in to. Straight through.
  if (!isSupabaseConfigured()) redirect(next?.startsWith("/") ? next : "/dashboard");
  return <AuthForm mode="sign-in" action={signIn} next={next?.startsWith("/") ? next : "/dashboard"} reason={reason} />;
}
