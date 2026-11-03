import { z } from "zod";
import { growerStand } from "@/lib/grower-guard";
import { RefundClaimError, growerDecides } from "@/lib/refund-flow";

// F4 human gate: the grower refunds or declines a request the agent could not
// settle alone. The amount is the one code decided; the grower cannot change it.

const Input = z.object({ action: z.enum(["refund", "decline"]) });

export async function POST(request: Request, ctx: RouteContext<"/api/refunds/[requestId]">) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const { requestId } = await ctx.params;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success || !/^[a-f0-9]{32}$/.test(requestId)) return Response.json({ error: "expected { action }" }, { status: 400 });
  try {
    const result = await growerDecides(requestId, guard.stand.id, parsed.data.action);
    return Response.json({ status: result.status });
  } catch (error) {
    if (error instanceof RefundClaimError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
