import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  name?: string;
  signature?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "framing_session",
  cookieOptions: {
    // secure:false is correct for phase 1 (plain http://localhost, no HTTPS).
    // Revisit if the app is ever exposed over HTTPS.
    secure: false,
    httpOnly: true,
    sameSite: "lax",
  },
};

// For Server Components and Route Handlers only (uses next/headers cookies()).
// Middleware must use getIronSession(request, response, sessionOptions) directly — see Step 6.
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
