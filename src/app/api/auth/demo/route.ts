import { DEMO_GROWER } from "@/lib/growers";
import { seeOther } from "@/lib/see-other";
import { startSession } from "@/lib/session";

// One click for judges: sign in as the demo stand's grower, no PayPal account needed.
export async function POST() {
  await startSession(DEMO_GROWER);
  return seeOther("/grower");
}
