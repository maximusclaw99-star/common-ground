import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. A file named
 * `middleware.ts` on 16 is silently never called.
 *
 * Server Components cannot write cookies, so refreshing the auth token has to
 * happen here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Demo mode: with no Supabase project configured there is no session to
  // refresh and no sign-in to redirect to, so every route is open. The header
  // says so on every page.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          for (const { name, value } of items) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of items) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session. Do not remove, and do not add logic between the
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;
  const PROTECTED = ["/dashboard", "/onboarding", "/intake", "/jobs", "/people", "/profile"];
  const isProtected = PROTECTED.some((p) => path.startsWith(p));

  if (!data?.claims && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
