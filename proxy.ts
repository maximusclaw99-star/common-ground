import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, isProtectedPath } from "@/lib/session/cookie";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. A file named
 * `middleware.ts` on 16 is silently never called.
 *
 * Server Components cannot write cookies, so refreshing the auth token has to
 * happen here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const toSignIn = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  };

  // Demo mode: no Supabase project, so accounts live in the server's memory
  // and the session is a cookie holding one's id. The proxy cannot see that
  // memory, only whether the cookie is there; a stale id (after a restart)
  // gets past here and is turned away by the page, which finds nobody behind
  // it and redirects to sign-in itself.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (isProtectedPath(path) && !request.cookies.get(DEMO_COOKIE)?.value) return toSignIn();
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

  if (!data?.claims && isProtectedPath(path)) return toSignIn();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
