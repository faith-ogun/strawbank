# Code layout, file by file

The README has the short version.

| Path | What |
|---|---|
| `src/lib/money.ts` | money as whole minor units; decimal strings only at the edges |
| `src/lib/orders.ts` | counts x confirmed prices, order lines, the Orders v2 body |
| `src/lib/paypal/` | the PayPal Server SDK client (sandbox only); order create, capture and get; Transaction Search; the refund gateway and catalogue products (Agent Toolkit); invoices, disputes and webhooks over REST with the SDK's token; Log in with PayPal |
| `src/lib/refunds.ts` | refund amount, cap and who decides; at most one refund per request |
| `src/lib/ledger.ts` | the webhook ledger; repeated or late webhooks change nothing |
| `src/lib/webhook.ts`, `src/lib/paypal/webhooks.ts` | the webhook route: PayPal confirms each signature (`verify-webhook-signature`) before anything is stored |
| `src/lib/ledger-store.ts` | the ledger in Firestore: one transaction per event, keyed by its id |
| `src/lib/reconcile.ts`, `src/lib/dusk.ts` | taken, paid and gap per item at dusk, from the day's orders and PayPal's word on each |
| `src/lib/refund-flow.ts`, `src/lib/refund-store.ts` | a customer's claim, the agent's recount, code's decision, one Firestore transaction per refund |
| `src/lib/audit.ts` | the next-morning audit: the ledger against PayPal's Transaction Search |
| `src/lib/ious.ts`, `src/lib/iou-flow.ts`, `src/lib/paypal/invoices.ts` | the IOU: the invoice body (same prices as an order), PayPal Invoicing, and PayPal's word on each |
| `src/lib/dispute-evidence.ts`, `src/lib/dispute-flow.ts`, `src/lib/paypal/disputes.ts` | disputes: the evidence pack from the stand's record, PayPal's Disputes API, and the photo hold |
| `src/lib/ledger-rows.ts`, `src/components/ledger/` | the ledger in AG Studio: rows built by code, the report, the custom widget, the agent and its Gemini adapter |
| `src/lib/ai/count.ts`, `src/lib/ai/faces.ts` | the basket and shelf count on Gemini, and the two face checks: Gemini's in the same call, Cloud Vision's alongside it |
| `src/lib/photo-reuse.ts`, `src/lib/photo-print.ts` | the reuse check: each basket photo's fingerprint (SHA-256 and a difference hash), against the stand's paid sales |
| `src/lib/ai/studio-turn.ts` | one turn of the ledger's agents on Gemini; any number in their words must be one the ledger's tools returned |
| `src/lib/sales.ts`, `src/lib/photos.ts` | each order and basket count, and the photo kept as evidence for 30 days |
| `src/lib/explain-check.ts` | rejects AI text with a number code did not compute |
| `src/agent/tools.ts` | the agent's PayPal tool allowlist |
| `src/agent/toolkit.ts` | the PayPal Agent Toolkit, sandbox only, adapted to AI SDK v7; money tools never reach the model |
| `src/app/` | the stand page and receipt, the grower's pages, the ledger, the API routes |
| `eval/` | the eval; see [eval.md](eval.md) |
| `docs/decisions.md`, `SECURITY.md` | why it is built this way, and how each risk is handled |
