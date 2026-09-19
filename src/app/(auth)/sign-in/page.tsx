import { AuthForm } from "../auth-form";
import { signIn } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function SignInPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  return <AuthForm mode="sign-in" action={signIn} next={next?.startsWith("/") ? next : "/dashboard"} demo={!isSupabaseConfigured()} reason={reason} />;
}
