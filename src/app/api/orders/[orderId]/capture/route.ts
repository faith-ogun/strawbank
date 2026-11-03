import { DEMO_STAND } from "@/lib/demo-stand";
import { firestoreLedger } from "@/lib/ledger-store";
import { noted } from "@/lib/paypal/calls";
import { PayPalError, capturePayPalOrder } from "@/lib/paypal/orders";
import { readSale, recordCapture } from "@/lib/sales";

// F2 step 5: capture the order the customer approved. PayPal's reply goes into
// the ledger at once, and its signed webhook confirms it there (spec section
// 7): a lost reply here never loses a sale, and a late webhook never hides one.
// The capture id is also noted on the order, for the dusk report and refunds.

const LEDGER_STATUS = { COMPLETED: "COMPLETED", PENDING: "PENDING", DECLINED: "DENIED", FAILED: "DENIED" } as const;

/** PayPal order ids are upper-case letters and digits. */
const ORDER_ID = /^[A-Z0-9]{8,40}$/;

export async function POST(_request: Request, ctx: RouteContext<"/api/orders/[orderId]/capture">) {
  const { orderId } = await ctx.params;
  if (!ORDER_ID.test(orderId)) return Response.json({ error: "not a PayPal order id" }, { status: 400 });

  try {
    const sale = await readSale(orderId).catch(() => undefined);
    const capture = await noted(
      { standId: sale?.standId, orderId, who: "customer", what: "capture the payment the customer approved", endpoint: `POST /v2/checkout/orders/${orderId}/capture` },
      () => capturePayPalOrder(orderId, sale?.currency ?? DEMO_STAND.currency),
      (c) => ({ status: 201, debugId: c.debugId, ref: c.captureId }),
    );
    const status = LEDGER_STATUS[capture.captureStatus as keyof typeof LEDGER_STATUS];
    await Promise.all([
      sale && recordCapture(orderId, capture.captureId, capture.captureStatus),
      status &&
        firestoreLedger.record({
          kind: "capture",
          captureId: capture.captureId,
          orderId,
          amountMinor: capture.amountMinor,
          currency: sale?.currency ?? DEMO_STAND.currency,
          status,
        }),
    ]).catch((error) => console.error("capture not noted:", error instanceof Error ? error.message : error));
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
