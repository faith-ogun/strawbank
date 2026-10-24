import { notBuilt } from "@/lib/not-built";

// F4: a "something's wrong" claim -> recount, decideRefund, then issueRefund
// or the grower's queue (src/lib/refunds.ts).
export async function POST() {
  return notBuilt("F4. Refund request");
}
