import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { standDate, standToday } from "@/lib/days";
import { MAX_QUANTITY, OrderError, buildLines, createOrderBody, orderTotalMinor } from "@/lib/orders";
import { noted } from "@/lib/paypal/calls";
import { PayPalError, createPayPalOrder } from "@/lib/paypal/orders";
import { readBasket, recordSale } from "@/lib/sales";

// F2 step 4: the customer's confirmed counts x the grower's confirmed prices ->
// an Orders v2 order with each item as a line. Prices come from the stand's
// catalogue on the server; the request carries only counts. The order is kept
// with its stand, day and basket photo, because the dusk report needs to know
// what was in it; if it cannot be kept, the customer is asked to try again
// before paying, so no payment is ever left without its lines.

const OrderInput = z.object({
  standId: z.string().min(1).max(64),
  counts: z.record(z.string().min(1).max(127), z.number().int().min(0).max(MAX_QUANTITY)),
  countId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const parsed = OrderInput.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { standId, counts }" }, { status: 400 });
  const { standId, counts } = parsed.data;

  const found = await standToday(standId);
  if (!found) return Response.json({ error: `no stand "${standId}"` }, { status: 404 });
  const date = standDate();
  // Only a count from this stand today can be attached as this order's photo.
  const basket = parsed.data.countId ? await readBasket(parsed.data.countId).catch(() => undefined) : undefined;
  const countId = basket?.standId === standId && basket.date === date ? basket.countId : undefined;

  try {
    const lines = buildLines(found.catalogue, counts);
    const reference = crypto.randomUUID();
    const currency = found.stand.currency;
    const body = createOrderBody(lines, currency, reference, `${standId}/${date}`);
    const origin = appUrl();
    const order = await noted(
      { standId, who: "customer", what: "create the order, one line per item", endpoint: "POST /v2/checkout/orders" },
      () =>
        createPayPalOrder(
          body,
          { returnUrl: `${origin}/s/${standId}?paypal=approved`, cancelUrl: `${origin}/s/${standId}?paypal=cancelled` },
          reference,
        ),
      (o) => ({ status: 201, debugId: o.debugId, ref: o.orderId, orderId: o.orderId }),
    );
    const totalMinor = orderTotalMinor(lines);
    try {
      await recordSale({ orderId: order.orderId, standId, date, lines, totalMinor, currency, countId });
    } catch (error) {
      console.error("order not kept:", error instanceof Error ? error.message : error);
      return Response.json({ error: "the stand could not note this basket; please try again" }, { status: 503 });
    }
    return Response.json({ ...order, reference, currency, totalMinor, lines }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof PayPalError) {
      return Response.json({ error: error.message, issue: error.issue, debugId: error.debugId }, { status: 502 });
    }
    throw error;
  }
}
