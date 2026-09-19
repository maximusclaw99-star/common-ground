import { AuthForm } from "../auth-form";
import { signUp } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_LOGIN } from "@/lib/session/demo-store";

export default async function SignUpPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  return <AuthForm mode="sign-up" action={signUp} next={next?.startsWith("/") ? next : "/onboarding/upload"} demo={!isSupabaseConfigured()} reason={reason}
    demoLogin={isSupabaseConfigured() ? null : DEMO_LOGIN} />;
}
