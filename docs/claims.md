# Claims, and where to check them

Each claim the README or the app makes, with the code behind it and the eval that tests it.
CI runs the money, day and audit evals (E4, E5, E7) on every push; the photo evals need
Gemini credentials, so their numbers come from the scorecard (`eval/results/2026-11-11.json`).

| Claim | Where to check it |
|---|---|
| The AI never decides an amount of money, and no tool handed to the model can move money | `src/agent/tools.ts`, `src/lib/paypal/refunds.ts`; E4.6 to E4.6c |
| The customer pays exactly the sum of their lines at the stand's prices, and that is exactly what PayPal is asked for | `src/lib/orders.ts`; E4.1 to E4.1c. The receipt shows the order as PayPal reports it |
| The agent refunds by itself only within the grower's limit, and only when its recount of the photo backs the claim; anything else waits for the grower | `src/lib/refunds.ts`, `src/lib/refund-flow.ts`; E4.2. On a receipt, press "Something's wrong with this?" |
| Refunds never add up to more than was paid, one request never refunds twice, and a refund call with no answer stays pending | `src/lib/refund-store.ts`, `src/agent/tools.ts`; E4.2b, E4.2c, E4.3, E4.6d |
| Only webhooks PayPal confirms as signed reach the ledger, and each changes it once | `src/app/api/webhooks/paypal/route.ts`, `src/lib/ledger.ts`; E4.4, E4.4b. Each confirmation is listed under "What Strawbank asked PayPal" on the grower's page |
| Any number in the AI's words that code did not compute is replaced, at dusk and in the ledger's assistant | `src/lib/explain-check.ts`, `src/lib/ai/studio-turn.ts`; E4.5 to E4.5e, E4.8 |
| The dusk report says "uncertain", never "missing", when a count, a payment or a refund claim is not settled: 20 of 20 simulated days exactly right, nobody wrongly accused, where a naive tally of the same days would wrongly report 7 items as walked | `src/lib/reconcile.ts`, `src/lib/dusk.ts`; E5 |
| On the first 10 real basket photos, the latest run counted all 10 exactly; basket 8 is sometimes counted as five eggs where there are four | `eval/e1-baskets.ts`, the photos in `eval/photos/baskets/`, the right answers in `eval/truth/baskets/`; E1 in the scorecard |
| The next-morning audit flags exactly the differences between our ledger and PayPal's Transaction Search: 7 of 7 | `src/lib/audit.ts`; E7. The grower's "Next-morning audit" page |
| An IOU is invoiced at exactly what an order for the same basket would charge, and counts as paid only when PayPal says so or the grower records cash | `src/lib/ious.ts`, `src/lib/iou-flow.ts`; E4.10, E4.11 |
| A basket or shelf photo in which Gemini or Cloud Vision finds a face is refused and never stored; the second check runs alongside the count | `src/lib/ai/faces.ts`, `src/app/api/count/route.ts`; E6 scores each check on its own: both caught both photos with a face, and neither refused a real basket |
| A basket photo an earlier paid sale used is refused at the till; a re-saved copy is flagged, and the agent never refunds that order alone | `src/lib/photo-reuse.ts`, `src/app/api/count/route.ts`; E4.14, E4.2d, E6 |
| Writing on the price card is read, never obeyed | `src/lib/ai/price-card.ts`; E6 |
| Every order tells PayPal the goods were collected at the stand | `src/lib/orders.ts`; E4.12. "Collected at the stand" on the receipt is read back from PayPal's order |
| Dispute evidence says only what the stand's record shows, in code's words | `src/lib/dispute-evidence.ts`, `src/lib/dispute-flow.ts`; E4.13, E4.13b |
| Every call that asks PayPal to do something is shown with PayPal's debug ID | `src/lib/paypal/calls.ts`. "What Strawbank asked PayPal" on each receipt and on the grower's page |
| A grower's pages open only with a session the server sealed, and act only on that grower's stand | `src/lib/session.ts`, `src/lib/grower-guard.ts`; E4.7 |
| Sandbox only: no setting points the app at live PayPal | `src/lib/paypal/config.ts`, `src/lib/paypal/client.ts` |

How each risk is handled, and what is not done yet: [SECURITY.md](../SECURITY.md). Why it is
built this way: [decisions.md](decisions.md). How each eval works: [eval.md](eval.md).
