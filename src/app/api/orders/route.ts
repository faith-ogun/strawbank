import { z } from "zod";
import { findStand } from "@/lib/demo-stand";
import { MAX_QUANTITY, OrderError, buildLines, createOrderBody, orderTotalMinor } from "@/lib/orders";
import { PayPalError, createPayPalOrder } from "@/lib/paypal/orders";

// F2 step 4: the customer's confirmed counts x the grower's confirmed prices ->
// an Orders v2 order with each item as a line. Prices come from the stand's
// catalogue on the server; the request carries only counts.

const OrderInput = z.object({
  standId: z.string().min(1).max(64),
  counts: z.record(z.string().min(1).max(127), z.number().int().min(0).max(MAX_QUANTITY)),
});

export async function POST(request: Request) {
  const parsed = OrderInput.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { standId, counts }" }, { status: 400 });
  const { standId, counts } = parsed.data;

  const found = findStand(standId);
  if (!found) return Response.json({ error: `no stand "${standId}"` }, { status: 404 });

  try {
    const lines = buildLines(found.catalogue, counts);
    const reference = crypto.randomUUID();
    const body = createOrderBody(lines, found.stand.currency, reference);
    const origin = new URL(request.url).origin;
    const order = await createPayPalOrder(
      body,
      { returnUrl: `${origin}/s/${standId}?paypal=approved`, cancelUrl: `${origin}/s/${standId}?paypal=cancelled` },
      reference,
    );
    return Response.json(
      { ...order, reference, currency: found.stand.currency, totalMinor: orderTotalMinor(lines), lines },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OrderError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof PayPalError) {
      return Response.json({ error: error.message, issue: error.issue, debugId: error.debugId }, { status: 502 });
    }
    throw error;
  }
}
