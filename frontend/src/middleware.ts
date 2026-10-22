import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);   
  const { pathname, searchParams } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  const sessionExpired = searchParams.has("expired");

  if (!sessionCookie && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionCookie && isAuthPage && !sessionExpired) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};