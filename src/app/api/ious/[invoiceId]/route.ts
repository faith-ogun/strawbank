import { z } from "zod";
import { growerStand } from "@/lib/grower-guard";
import { IouError, growerIouAction } from "@/lib/iou-flow";
import { PayPalError } from "@/lib/paypal/orders";

// The grower's hand on an open IOU: remind the customer, record cash paid at
// the stand (in PayPal, so its record stays complete), or cancel it.

const Input = z.object({ action: z.enum(["remind", "cash", "cancel"]) });

export async function POST(request: Request, { params }: RouteContext<"/api/ious/[invoiceId]">) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { action: remind | cash | cancel }" }, { status: 400 });
  const { invoiceId } = await params;
  try {
    const iou = await growerIouAction(invoiceId, guard.stand.id, guard.stand.name, parsed.data.action);
    return Response.json({ invoiceId: iou.invoiceId, status: iou.status });
  } catch (error) {
    if (error instanceof IouError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof PayPalError) return Response.json({ error: error.message, issue: error.issue, debugId: error.debugId }, { status: 502 });
    throw error;
  }
}
