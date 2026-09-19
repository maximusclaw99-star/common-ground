/**
 * Shared between proxy.ts and the session module, so it must stay free of
 * Node-only imports: the proxy runs before any page and cannot reach the
 * in-memory store, it can only see whether a session cookie is present.
 */

/** Demo mode's session cookie: the id of an in-memory account. */
export const DEMO_COOKIE = "cg_demo";

/** Routes that need an account, in either mode. */
export const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/intake", "/jobs", "/people", "/profile"] as const;

export const isProtectedPath = (path: string): boolean =>
  PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
