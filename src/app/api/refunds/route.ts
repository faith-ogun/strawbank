import { z } from "zod";
import { RefundClaimError, claimRefund, requestMessage } from "@/lib/refund-flow";
import { limited } from "@/lib/rate-limit";

// F4: a customer's "something's wrong" -> the agent's recount of their basket
// photo -> code's decision -> a refund through the Agent Toolkit, or the
// grower's queue (src/lib/refund-flow.ts). The refund always goes back to the
// PayPal account that paid, so a claim can never send money anywhere else.

const Input = z.object({
  orderId: z.string().regex(/^[A-Z0-9]{8,40}$/),
  claimed: z.record(z.string().min(1).max(127), z.number().int().min(0).max(99)),
});

export async function POST(request: Request) {
  const tooMany = limited(request, "refundClaim");
  if (tooMany) return tooMany;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { orderId, claimed }" }, { status: 400 });
  try {
    const result = await claimRefund(parsed.data.orderId, parsed.data.claimed);
    return Response.json({ status: result.status, amountMinor: result.amountMinor, message: requestMessage(result) });
  } catch (error) {
    if (error instanceof RefundClaimError) return Response.json({ error: error.message }, { status: error.status });
    console.error("refund claim failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return Response.json({ error: "the claim could not be checked just now; please try again" }, { status: 502 });
  }
}
