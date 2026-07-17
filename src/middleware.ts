import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId && request.nextUrl.pathname !== "/select") {
    return NextResponse.redirect(new URL("/select", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/auth/select|api/users|_next/static|_next/image|favicon.ico).*)"],
};
