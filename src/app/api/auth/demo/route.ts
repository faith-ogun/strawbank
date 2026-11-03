import { DEMO_GROWER } from "@/lib/growers";
import { startSession } from "@/lib/session";

// One click for judges: sign in as the demo stand's grower, no PayPal account needed.
export async function POST(request: Request) {
  await startSession(DEMO_GROWER);
  return Response.redirect(new URL("/grower", request.url), 303);
}
