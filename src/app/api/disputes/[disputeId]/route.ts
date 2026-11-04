import { z } from "zod";
import { DisputeError, refundInstead, sandboxDisputeStep, sendEvidence } from "@/lib/dispute-flow";
import { growerStand } from "@/lib/grower-guard";
import { PayPalError } from "@/lib/paypal/orders";

// The grower's answer to a dispute at their stand: send PayPal the evidence
// pack from the stand's own record, or refund instead (PayPal's accept-claim).
// In the sandbox, also the two steps PayPal's own staff would take.

const Input = z.object({ action: z.enum(["evidence", "refund", "ask-for-evidence", "decide-for-stand", "decide-for-customer"]) });

export async function POST(request: Request, { params }: RouteContext<"/api/disputes/[disputeId]">) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { action: evidence | refund | ask-for-evidence | decide-for-stand | decide-for-customer }" }, { status: 400 });
  const { disputeId } = await params;
  if (!/^PP-[A-Z0-9-]{1,40}$/.test(disputeId)) return Response.json({ error: "not a PayPal dispute id" }, { status: 400 });
  try {
    const { action } = parsed.data;
    if (action === "evidence") return Response.json(await sendEvidence(disputeId, guard.stand.id));
    if (action === "refund") {
      await refundInstead(disputeId, guard.stand.id);
      return Response.json({ refunded: true });
    }
    await sandboxDisputeStep(disputeId, guard.stand.id, action);
    return Response.json({ done: action });
  } catch (error) {
    if (error instanceof DisputeError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof PayPalError) return Response.json({ error: error.message, issue: error.issue, debugId: error.debugId }, { status: 502 });
    throw error;
  }
}
