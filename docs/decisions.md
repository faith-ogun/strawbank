# Decisions

The decisions that shape Strawbank, oldest first, each with its reason and where it shows
in the code. A decision that changes is marked superseded, never rewritten.

## D1. The model never does money

**24 Oct 2026.** The AI reads, counts and explains. Every total, refund, cap and gap is plain
code, and any number in the AI's words that code did not compute is replaced by code's own
line.

**Why:** the same basket must always cost the same, and a model's guess cannot promise that.

**In the code:** `src/lib/money.ts`, `src/lib/orders.ts`, `src/lib/refunds.ts`,
`src/lib/reconcile.ts`, `src/lib/explain-check.ts`. Eval E4, all of it.

## D2. Each eval is built before the feature it measures

**24 Oct 2026.** The money properties (E4) were written before any feature; the dusk report
waited for E5, and the audit for E7. Only numbers from `npm run eval` go in the README.

**Why:** a test written after the feature tends to test what was built, not what was meant.

**In the code:** `eval/`, described in [eval.md](eval.md). CI runs the evals that need no keys
on every push.

## D3. PayPal's sandbox only, fixed in code

**From the start.** The PayPal base address and the SDK's environment are constants, with no
setting that changes them.

**Why:** a hackathon entry has no business near live money, and a setting can be got wrong.

**In the code:** `src/lib/paypal/config.ts`, `src/lib/paypal/client.ts`.

## D4. Gemini on Vertex AI, two models

**24 Oct 2026, the second model 28 Oct.** Gemini is the one AI model. A fast model counts the
customer's basket at the stand; a slower, more careful one does work that can wait, such as
the recount behind a refund.

**Why:** on the same test photos the fast model answered in about a second every time, while
the careful one took two to four seconds and sometimes stalled. The customer checks every
count anyway; a refund recount moves money, so it gets the careful model.

**In the code:** `src/lib/ai/model.ts` (`GEMINI_FAST_MODEL`, `GEMINI_MODEL`),
`src/lib/ai/count.ts`.

## D5. PayPal server calls go through the PayPal Server SDK

**25 Oct 2026.** Orders, captures and Transaction Search use `@paypal/paypal-server-sdk`.
Where the SDK has no controller (Invoicing, Disputes, webhook signatures), the call is a plain
request that borrows the SDK's own OAuth token. Log in with PayPal is a plain request too, as
it acts for the grower rather than the app.

**Why:** one client, one token cache, one place for timeouts. The SDK's default timeout is 0
(wait forever), so the client sets 20 seconds, and it never re-sends a POST.

**In the code:** `src/lib/paypal/`.

## D6. Ireland and euros in the sandbox

**26 Oct 2026.** The sandbox merchant and buyer are Irish accounts, and the stand prices in
euros.

**Why:** the story is set at a farm stand in County Monaghan, Ireland, and the sandbox buyer
and merchant are best kept in the same country.

**In the code:** `src/lib/demo-stand.ts`.

## D7. The model is never handed `create_refund`

**28 Oct 2026.** The Agent Toolkit's refund tool sends whatever amount it is given straight to
PayPal, so code runs it, with the amount code decided. The model recounts the photo and
explains; it never holds a tool that can move money.

**Why:** a model holding the refund tool could choose the amount.

**In the code:** `src/agent/tools.ts`, `src/agent/toolkit.ts`, `src/lib/paypal/refunds.ts`.
Evals E4.6 to E4.6c.

## D8. One Agent Toolkit instance per refund

**28 Oct 2026.** The toolkit sends one PayPal-Request-Id per instance, so each refund builds a
fresh one, keyed on the refund request.

**Why:** PayPal then answers a repeated request with the same refund, never a second one. The
cost is one extra token request per refund.

**In the code:** `src/lib/paypal/refunds.ts`. Eval E4.3.

## D9. Who signs in

**28 Oct 2026.** Customers never sign in: they scan, photograph and pay, and PayPal is their
identity at checkout. Growers sign in with Log in with PayPal (built; it waits for the
sandbox app's Log in with PayPal setting to be switched on). Judges get a one-click demo
grower, so every path can be tried without an account.

**Why:** the grower's pages hold sales and refund approvals, so they cannot be public, and
signing in through PayPal keeps identity inside PayPal.

**In the code:** `src/lib/session.ts`, `src/lib/grower-guard.ts`, `src/app/api/auth/`. Eval
E4.7.

## D10. Count goods, not their packaging; sell everything one at a time

**28 and 29 Oct 2026.** Eggs in a supermarket box are the stand's eggs, and whatever box, bag
or tray holds them, every egg, onion, potato and jar counts on its own. A closed box gets a
note asking the customer to open it.

**Why:** growers reuse any box or bag, and a count that refuses them makes the customer count
by hand. A short box should simply cost less.

**In the code:** `src/lib/ai/count.ts`, `src/lib/demo-stand.ts`.

## D11. The dusk report trusts PayPal's signed webhooks; the audit runs next morning

**October 2026.** At dusk, what was paid comes from our own ledger, built from webhooks that
PayPal has confirmed as signed. The next morning, the audit checks that ledger against PayPal's
Transaction Search.

**Why:** Transaction Search can take up to three hours to show a transaction, too late for
dusk. Two independent records, compared, are stronger than one.

**In the code:** `src/lib/ledger.ts`, `src/lib/dusk.ts`, `src/lib/audit.ts`. Evals E4.4,
E4.4b, E5, E7.

## D12. Photos are evidence, kept 30 days

**3 Nov 2026.** Basket and shelf photos go to a private bucket and are deleted 30 days after
upload. A photo behind an open refund or dispute is held until it closes. A photo with a face
in it is to be refused and the customer asked to retake it, with nothing blurred, sent to the
model or kept (decided, not built yet).

**Why:** a refund recount or a dispute needs the photo; nothing else does.

**In the code:** `src/lib/photos.ts`.

## D13. The ledger shows real records; practice days only on request, and labelled

**3 Nov 2026.** The AG Studio ledger opens on the stand's own records. Twenty practice days,
the simulated days from eval E5 put through the same code, show only when asked for, labelled
as simulated wherever they appear, and never mixed with real records.

**Why:** charts need weeks of data to show anything, and simulated data must never pass for
real sales.

**In the code:** `src/lib/practice-ledger.ts`, `src/app/grower/ledger/page.tsx`.

## D14. AG Studio's agents run on Gemini, and their numbers are checked

**3 Nov 2026.** Strawbank's own agent leads and hands the building to AG Studio's planning,
page, widget and data agents, all on Gemini through our own adapter. They answer by building
widgets; any number in their words that the ledger's own tools did not return that
conversation is replaced by code's line. None of them has a PayPal tool.

**Why:** one AI model in the whole app, and instructions alone can fail where a check cannot.

**In the code:** `src/components/ledger/`, `src/lib/ai/studio-turn.ts`. Evals E4.8, E4.9.

## D15. The IOU is a PayPal invoice

**3 Nov 2026.** A customer with no PayPal to hand leaves an email address; code prices the
basket exactly as an order would, and PayPal sends the invoice. It is sent only if PayPal's
total equals code's to the cent. Strawbank keeps only a masked copy of the address.

**Why:** real honesty boxes have IOU notes, and an IOU is money, so code prices it.

**In the code:** `src/lib/ious.ts`, `src/lib/iou-flow.ts`, `src/lib/paypal/invoices.ts`. Evals
E4.10, E4.11.

## D16. "Collected at the stand" is the order's own fulfilment type

**3 Nov 2026.** Every order tells PayPal the goods were collected at the stand
(`PICKUP_IN_STORE`, at the stand's address). No tracking number is added.

**Why:** PayPal's spec says in-store pickup keeps Seller Protection. Pickup from a person was
rejected because a customer at an honesty box meets no one, and nothing is shipped, so a
tracking number would be made up.

**In the code:** `src/lib/orders.ts`. Eval E4.12.

## D17. Disputes are answered from the stand's own record, by the grower's tap

**3 Nov 2026.** When a customer disputes a payment, code writes the evidence from the stand's
record (the order, the capture, any refund, the basket photo) and the grower decides whether to
send it or to accept the claim. The evidence type is the one PayPal asked for, never one that
needs a tracking number or refund id. A signed dispute webhook holds the basket photo while the
dispute is open.

**Why:** evidence must state only what happened, and only the grower decides how to answer.

**In the code:** `src/lib/dispute-evidence.ts`, `src/lib/dispute-flow.ts`,
`src/lib/paypal/disputes.ts`. Evals E4.13, E4.13b.

## D18. Limits and second tries for the public demo

**3 Nov 2026.** Every route that calls Gemini or makes PayPal do something allows each visitor
a fair number of tries in ten minutes. A Gemini call that has not answered in time gets a
second try alongside it, and the first answer wins. A refund recount that fails leaves the
claim with the grower.

**Why:** the demo has to survive weeks of judging on a small budget, and a stalled call should
not cost the customer their answer.

**In the code:** `src/lib/rate-limit.ts`, `src/lib/ai/hedged.ts`, `src/lib/refund-flow.ts`.

## Related

- [Security](../SECURITY.md)
- [How each eval works](eval.md)
