import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS — server-only, never import from a
 * component. Used by the cron poller to write the shared job catalogue.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
