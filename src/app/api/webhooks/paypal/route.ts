import { notBuilt } from "@/lib/not-built";

// The ledger's source: PayPal webhooks, each checked through
// /v1/notifications/verify-webhook-signature before Ledger.apply.
export async function POST() {
  return notBuilt("Ledger. PayPal webhook");
}
