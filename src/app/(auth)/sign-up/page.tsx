import { AuthForm } from "../auth-form";
import { signUp } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function SignUpPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-up" action={signUp} next={next ?? "/onboarding/upload"} demo={!isSupabaseConfigured()} />;
}
