import { cookies } from "next/headers";
import { authorizeUrl, newState } from "@/lib/paypal/login";

// Step 1 of Log in with PayPal: a one-time state, kept in a short-lived
// cookie, then off to PayPal's consent page.
export async function GET() {
  const state = newState();
  (await cookies()).set("sb_login_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/paypal",
    maxAge: 10 * 60,
  });
  return Response.redirect(authorizeUrl(state), 302);
}
