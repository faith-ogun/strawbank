import { DEMO_STAND } from "@/lib/demo-stand";
import { PayPalError, capturePayPalOrder } from "@/lib/paypal/orders";
import { readSale, recordCapture } from "@/lib/sales";

// F2 step 5: capture the order the customer approved. The ledger records the
// capture from PayPal's signed webhook, not from this response (spec section 7),
// so a lost response here never loses a sale. The capture id is also noted on
// the order, so the dusk report can find PayPal's word on it.

/** PayPal order ids are upper-case letters and digits. */
const ORDER_ID = /^[A-Z0-9]{8,40}$/;

export async function POST(_request: Request, ctx: RouteContext<"/api/orders/[orderId]/capture">) {
  const { orderId } = await ctx.params;
  if (!ORDER_ID.test(orderId)) return Response.json({ error: "not a PayPal order id" }, { status: 400 });

  try {
    const sale = await readSale(orderId).catch(() => undefined);
    const capture = await capturePayPalOrder(orderId, sale?.currency ?? DEMO_STAND.currency);
    if (sale) {
      await recordCapture(orderId, capture.captureId, capture.captureStatus).catch((error) => {
        console.error("capture not noted on the order:", error instanceof Error ? error.message : error);
      });
    }
    return Response.json(capture);
  } catch (error) {
    if (error instanceof PayPalError) {
      // 422 is PayPal saying the order is not ready (not approved yet) or already captured.
      const status = error.status === 422 || error.status === 404 ? error.status : 502;
      return Response.json({ error: error.message, issue: error.issue, debugId: error.debugId }, { status });
    }
    throw error;
  }
}
