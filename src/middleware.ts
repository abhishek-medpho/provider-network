import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublicAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/check-whatsapp") ||
    pathname.startsWith("/api/auth");

  const isPublicFormRoute =
    pathname.startsWith("/onboard") || pathname.startsWith("/api/public");

  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return Response.redirect(loginUrl);
  }

  if (pathname === "/" && isLoggedIn) {
    return Response.redirect(new URL("/admin", req.nextUrl));
  }

  return undefined;
});

export const config = {
  // Skip Next.js internals + static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
