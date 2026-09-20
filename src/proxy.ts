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

  // Demo mode: no Supabase project, so there is nothing to sign in to. Each
  // browser instead gets a random id on its first visit, and that id owns an
  // in-memory student — private to the browser, no password, nothing to
  // expire. Set on the request too, so the page rendering right now already
  // sees it.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (!request.cookies.get(DEMO_COOKIE)?.value) {
      const id = crypto.randomUUID();
      request.cookies.set(DEMO_COOKIE, id);
      response = NextResponse.next({ request });
      response.cookies.set(DEMO_COOKIE, id, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
      });
    }
    response.headers.set("x-cg-mode", "demo");
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
