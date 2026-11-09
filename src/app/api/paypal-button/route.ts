// The customer's browser says why PayPal's button could not load there, so the
// reason reaches the service's log (a phone keeps it to itself otherwise).
// Nothing is stored and nothing is sent anywhere else. Added 9 Nov, after the
// button failed on an iPhone in Chrome while it worked everywhere else.

import { z } from "zod";
import { limited } from "@/lib/rate-limit";

const Input = z.object({
  step: z.enum(["script", "instance", "eligibility", "not-eligible", "session"]),
  message: z.string().max(300),
  attempts: z.number().int().min(1).max(10),
});

export async function POST(request: Request) {
  const tooMany = limited(request, "buttonReport");
  if (tooMany) return tooMany;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "not a button report" }, { status: 400 });
  const { step, message, attempts } = parsed.data;
  const browser = (request.headers.get("user-agent") ?? "unknown").slice(0, 200);
  console.error(`PayPal button unavailable after ${attempts} tries, at ${step}: ${message} (${browser})`);
  return new Response(null, { status: 204 });
}
