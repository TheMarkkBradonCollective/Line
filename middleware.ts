import { NextResponse, type NextRequest } from "next/server";

/** Lets the server layout pick a wider layout for profile pages. Not used for access decisions. */
export function middleware(request: NextRequest) {
  request.headers.set("x-line-path", request.nextUrl.pathname);
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
