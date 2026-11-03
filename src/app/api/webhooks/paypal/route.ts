import { applyDisputeEvent } from "@/lib/dispute-flow";
import { applyInvoiceEvent } from "@/lib/iou-flow";
import { firestoreLedger } from "@/lib/ledger-store";
import { noted } from "@/lib/paypal/calls";
import { verifyWithPayPal } from "@/lib/paypal/webhooks";
import { handlePayPalWebhook } from "@/lib/webhook";

// The ledger's source: PayPal webhooks, each confirmed by PayPal through
// /v1/notifications/verify-webhook-signature before Ledger.apply. PayPal
// resends anything that does not get a 2xx, for up to three days. Each check
// is noted with the PayPal call log; a capture names its stand in custom_id,
// an IOU invoice in its reference. An invoice event also updates its IOU, and
// a dispute event holds or releases the basket photo, before the ledger
// records the event, so a retry after a failure still lands.
export async function POST(request: Request) {
  const raw = await request.text();
  let event: {
    event_type?: string;
    resource?: { id?: string; custom_id?: string; detail?: { reference?: string }; supplementary_data?: { related_ids?: { order_id?: string } } };
  } = {};
  try {
    event = JSON.parse(raw);
  } catch {}
  const { status, body } = await handlePayPalWebhook(raw, request.headers, {
    verify: (rawBody, headers) =>
      noted(
        {
          standId: (event.resource?.custom_id ?? event.resource?.detail?.reference)?.split("/")[0],
          orderId: event.resource?.supplementary_data?.related_ids?.order_id,
          who: "webhook",
          what: `check the signature of ${event.event_type ?? "a webhook"}`,
          endpoint: "POST /v1/notifications/verify-webhook-signature",
        },
        () => verifyWithPayPal(rawBody, headers),
        (verified) => ({ status: 200, ref: verified ? `${event.resource?.id ?? ""} signature confirmed` : "signature NOT confirmed" }),
      ),
    store: {
      async apply(verified) {
        await applyInvoiceEvent(verified);
        await applyDisputeEvent(verified);
        return firestoreLedger.apply(verified);
      },
    },
  });
  return Response.json(body, { status });
}
