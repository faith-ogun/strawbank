import { cookies } from "next/headers";
import { growerFromPayPal } from "@/lib/growers";
import { personFromCode } from "@/lib/paypal/login";
import { startSession } from "@/lib/session";

// Step 2 of Log in with PayPal: PayPal sends the grower back here with a code.
// The state must match the cookie set in step 1, or nothing happens.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (problem: string) => Response.redirect(new URL(`/grower?signin=${problem}`, url), 303);

  const jar = await cookies();
  const expected = jar.get("sb_login_state")?.value;
  jar.delete("sb_login_state");
  const code = url.searchParams.get("code");
  if (!code) return back(url.searchParams.get("error") === "access_denied" ? "cancelled" : "failed");
  if (!expected || url.searchParams.get("state") !== expected) return back("expired");

  try {
    const person = await personFromCode(code);
    await startSession(await growerFromPayPal(person.accountId, person.name));
  } catch (error) {
    console.error("Log in with PayPal failed", error);
    return back("failed");
  }
  return Response.redirect(new URL("/grower", url), 303);
}
