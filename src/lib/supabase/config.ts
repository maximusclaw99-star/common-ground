/**
 * Whether a real Supabase project is wired up.
 *
 * When it isn't, the app runs in demo mode rather than throwing: every screen
 * still renders against an in-memory student, so the product can be shown and
 * developed before anyone has created a project. The banner in the header says
 * so plainly — silently pretending to persist would be worse than not.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
