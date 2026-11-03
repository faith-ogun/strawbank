import { seeOther } from "@/lib/see-other";
import { endSession } from "@/lib/session";

export async function POST() {
  await endSession();
  return seeOther("/grower");
}
