import { firestoreLedger } from "@/lib/ledger-store";
import { verifyWithPayPal } from "@/lib/paypal/webhooks";
import { handlePayPalWebhook } from "@/lib/webhook";

// The ledger's source: PayPal webhooks, each confirmed by PayPal through
// /v1/notifications/verify-webhook-signature before Ledger.apply. PayPal
// resends anything that does not get a 2xx, for up to three days.
export async function POST(request: Request) {
  const { status, body } = await handlePayPalWebhook(await request.text(), request.headers, {
    verify: verifyWithPayPal,
    store: firestoreLedger,
  });
  return Response.json(body, { status });
}
