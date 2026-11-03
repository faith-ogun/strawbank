import { z } from "zod";
import { IouError, leaveIou } from "@/lib/iou-flow";
import { isEmail } from "@/lib/ious";
import { MAX_QUANTITY, OrderError } from "@/lib/orders";
import { PayPalError } from "@/lib/paypal/orders";

// The honesty-box IOU: a customer with no PayPal to hand leaves an email
// address, and PayPal sends them an invoice for the counted basket at the
// stand's prices (src/lib/iou-flow.ts). The request carries only counts.

const Input = z.object({
  standId: z.string().min(1).max(64),
  counts: z.record(z.string().min(1).max(127), z.number().int().min(0).max(MAX_QUANTITY)),
  countId: z.string().uuid().optional(),
  email: z.string().trim().max(254),
  /** Made by the page once per basket, so a double tap sends one invoice. */
  requestId: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { standId, counts, email, requestId }" }, { status: 400 });
  if (!isEmail(parsed.data.email)) return Response.json({ error: "that does not look like an email address" }, { status: 400 });
  try {
    const iou = await leaveIou(parsed.data);
    return Response.json({ invoiceId: iou.invoiceId, totalMinor: iou.totalMinor, currency: iou.currency, payUrl: iou.payUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof IouError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof PayPalError) return Response.json({ error: error.message, issue: error.issue, debugId: error.debugId }, { status: 502 });
    throw error;
  }
}
