<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/strawbank-logo-reversed.png">
    <img src="assets/readme/strawbank-logo.png" width="460" alt="Strawbank, a scarecrow jar keeping the stall">
  </picture>
</p>

<p align="center"><i>minds the honesty box while the grower is in the field</i></p>

<p align="center">
  An AI shopkeeper for <b>unstaffed roadside farm stands</b>. The customer photographs their basket,<br>
  the AI <b>counts</b> it, plain code works out the total, and they pay with <b>PayPal</b>. At dusk it tells<br>
  the grower <b>what sold and what walked</b>, and it refunds small overcharges itself, within the grower's limit.
</p>

<p align="center">
  <b>PayPal AI Hackathon</b> &nbsp;·&nbsp; PayPal sandbox only &nbsp;·&nbsp; MIT
</p>

<p align="center">
  <a href="#how-a-day-works">How a day works</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#paypal-call-by-call">PayPal, call by call</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#the-rule-the-ai-never-touches-money">The money rule</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#claims-and-where-to-check-them">Claims</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#what-this-is-not">What this is not</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PayPal-sandbox-0088F5" alt="PayPal sandbox">
  <img src="https://img.shields.io/badge/Gemini-Vertex_AI-0F1252" alt="Gemini on Vertex AI">
  <img src="https://img.shields.io/badge/Next.js-16-0A0C3C" alt="Next.js 16">
  <img src="https://img.shields.io/badge/eval_E4-28_properties,_0_failures-2ea043" alt="eval E4: 28 properties, 0 failures">
  <img src="https://img.shields.io/badge/eval_E5-20_of_20_days-2ea043" alt="eval E5: 20 of 20 days">
  <img src="https://img.shields.io/badge/demo-live_in_the_sandbox-2ea043" alt="demo live in the sandbox">
  <img src="https://img.shields.io/badge/licence-MIT-43FE8A" alt="MIT licence">
</p>

---

> **Try both sides in about ten minutes:** [strawbank-434001576954.europe-west1.run.app/try](https://strawbank-434001576954.europe-west1.run.app/try) walks you through opening the demo stand as its grower, buying from it on your phone, and closing the day. Or go straight to [the demo stand](https://strawbank-434001576954.europe-west1.run.app/s/demo).
>
> PayPal sandbox only; no real money moves. This README claims only what works, and every result in it comes from `npm run eval`.

---

## What is this, in plain terms?

All over Ireland, Britain and North America, farms sell eggs, jam and vegetables from a table
at the end of the lane, with nobody there. You leave the money in a jar or tin: an **honesty
box**. Three things go wrong:

- **The tin gets stolen**
  ([Laois](https://www.rte.ie/news/leinster/2023/0330/1367373-honesty-box-eggs), [Kildare](https://www.farmersjournal.ie/tillage/news/kildare-farmer-tracks-down-egg-and-potato-thieves-838832),
  [British Columbia](https://globalnews.ca/news/11323028/lake-country-b-c-farm-stand-operating-on-the-honour-system-raided)).
- **Fewer people carry cash**, so sales walk past.
- **At dusk the grower cannot tell what sold from what walked.**

Strawbank keeps the trust and adds a shopkeeper. A QR code on the stand opens the shop on
the customer's phone, the AI counts the basket from a photo, and PayPal takes the payment.
At dusk, one photo of the shelf gives the grower the day's truth in plain words.

---

## How a day works

| Moment | The AI | Plain code | PayPal (sandbox) |
|---|---|---|---|
| **Morning:** the grower photographs the price card and the shelf | reads the prices, counts the stock | nothing is for sale until the grower confirms | each new item becomes a catalogue product |
| **A customer:** scans the QR code, photographs the basket | counts the basket, with how sure it is | the customer has the final word; code works out the total | an order with one line per item, then the capture |
| **No PayPal to hand:** the customer leaves an IOU | | prices the basket exactly as an order would | an invoice, paid later through PayPal or recorded as cash |
| **Something's wrong:** "I took one jar, not two" | recounts the stored photo | works out the refund, its cap, and who decides | the agent refunds small, clear cases within the grower's limit |
| **Dusk:** the grower photographs the shelf | counts what is left, then explains the day | taken minus paid, per item; an unsure count says "uncertain", never "missing" | our ledger, built from signed webhooks |
| **A customer disputes a payment** | | builds the evidence from the stand's own record | the evidence, with the basket photo, or the grower accepts the claim |
| **Next morning** | | compares our ledger with PayPal's records | Transaction Search |

---

## How it fits together

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/architecture-dark.svg">
    <img src="assets/readme/architecture.svg" width="880" alt="Architecture: the customer's and grower's phones talk to the Next.js app on Cloud Run. Inside it, the AI steps (on Gemini) count, read and explain, Cloud Vision checks each photo for a face, and plain code does totals, refunds, caps, gaps, IOU prices, dispute evidence and the audit. A numbers check replaces any number in the AI's words that code did not compute. Only plain code talks to PayPal; PayPal's signed webhooks come back through a route that confirms each signature, into Firestore.">
  </picture>
</p>

Yellow is the AI, green is plain code, blue is PayPal. The AI has no path to PayPal: every
amount PayPal sees was worked out by plain code, and the customer approves each payment in
PayPal's own window.

---

## PayPal, call by call

Each call is shown in the app as it happens, with PayPal's debug ID. "Seen working" is the
date it last ran in the sandbox. The code for all of them is in `src/lib/paypal/`.

| What | PayPal endpoint | Through | Seen working |
|---|---|---|---|
| Create the order, one line per item, collected at the stand | `POST /v2/checkout/orders` | Server SDK | 28 Oct, 3 Nov |
| Capture the payment | `POST /v2/checkout/orders/{id}/capture` | Server SDK | 28 Oct, 3 Nov |
| Read the order for the receipt | `GET /v2/checkout/orders/{id}` | Server SDK | 3 Nov |
| The PayPal button on the customer's phone | JS SDK v6 | `@paypal/paypal-js` | 3 Nov |
| Partial refund, amount from code | `POST /v2/payments/captures/{id}/refund` | Agent Toolkit | 28 Oct, 3 Nov |
| Confirm a webhook's signature | `POST /v1/notifications/verify-webhook-signature` | REST | 3 Nov |
| List the day's items as products | `POST /v1/catalogs/products` | Agent Toolkit | 3 Nov |
| The next-morning audit | `GET /v1/reporting/transactions` | Server SDK | 3 Nov |
| Write an IOU as an invoice, and send it | `POST /v2/invoicing/invoices`, `.../send` | REST | 3 Nov |
| Remind, record cash, read the status | `.../remind`, `.../payments`, `GET .../{id}` | REST | 3 Nov |
| Cancel an IOU | `POST /v2/invoicing/invoices/{id}/cancel` | REST | 9 Nov |
| List and show disputes | `GET /v1/customer/disputes`, `.../{id}` | REST | 3 Nov (no dispute yet) |
| Send the evidence, with the basket photo | `POST /v1/customer/disputes/{id}/provide-evidence` | REST | 11 Nov |
| Refund instead | `POST /v1/customer/disputes/{id}/accept-claim` | REST | not yet |
| Grower sign-in | `/connect`, `POST /v1/oauth2/token`, `GET /v1/identity/oauth2/userinfo` | REST | 5 Nov |

PayPal's webhooks feed the ledger: payments, refunds and reversals, orders, invoices paid or
cancelled, and disputes. Each event changes the ledger once, whatever order it arrives in
(E4.4).

---

## The rule: the AI never touches money

The AI reads, counts and explains. **Every total, refund, cap and gap is plain code**, because
the same basket must always cost the same. Any number in the AI's words that code did not
compute is replaced by code's own line, at dusk and in the ledger's assistant.

`npm run eval` tests it, and the rest of the app. Latest run, 11 Nov
(`eval/results/2026-11-11.json`):

| Eval | What it checks | Result |
|---|---|---|
| **E4** money rules | 28 properties over generated cases: totals, refund caps, no double refunds, signed webhooks, the numbers check | **0 failures in 24,100 cases** |
| **E5** dusk report | 20 simulated days with walkers, underpayments, restocks, refunds, unconfirmed payments and open refund claims | **20 of 20 exact, 0 wrong accusations** (a naive tally of the same days: 7, worth €14.40) |
| **E7** next-morning audit | 7 days with differences planted between our ledger and PayPal's records | **7 of 7 found, nothing else flagged** |
| **E6** safety | 11 trap photos: two faces, an instruction on the price card, blur, an empty tub, a pencil case, a lemon the stand does not sell, a retaken basket; and reused photos | **all 11 handled; 10 of 10 reused photos refused** |
| **E1** basket counts | real baskets of eggs, onions and potatoes | **10 of 10 exact** |
| **E2** price card | a handwritten price card | **3 of 3 lines** |
| **E3** shelf counts | real shelf photos | **8 of 8 counts** |

The money properties were checked by planting bugs they should catch, such as a total a cent
off or a missing duplicate check; each was caught. The naive tally does E5's sums but counts
only payments PayPal has already confirmed: it would have called 7 paid-for items walked on 4
of the 20 days. E1 to E3 run on real photos:
10 baskets, 1 price card and 2 shelf photos. Every result in detail, and how each eval works:
[docs/eval.md](docs/eval.md).

---

## Claims, and where to check them

| Claim | Where to check it |
|---|---|
| The AI never decides an amount of money, and no tool handed to the model can move money | `src/agent/tools.ts`, `src/lib/paypal/refunds.ts`; E4.6 to E4.6c |
| The customer pays exactly the sum of their lines, and that is what PayPal is asked for | `src/lib/orders.ts`; E4.1 to E4.1c |
| The agent refunds by itself only within the grower's limit, when its recount backs the claim | `src/lib/refunds.ts`, `src/lib/refund-flow.ts`; E4.2 |
| Any number in the AI's words that code did not compute is replaced | `src/lib/explain-check.ts`, `src/lib/ai/studio-turn.ts`; E4.5 to E4.5e, E4.8 |
| Only webhooks PayPal confirms as signed reach the ledger, once each | `src/app/api/webhooks/paypal/route.ts`, `src/lib/ledger.ts`; E4.4, E4.4b |
| A photo with a face is refused and never stored | `src/lib/ai/faces.ts`, `src/app/api/count/route.ts`; E6 |

All 18 claims: [docs/claims.md](docs/claims.md). How each risk is handled: [SECURITY.md](SECURITY.md).
Why it is built this way: [docs/decisions.md](docs/decisions.md).

---

## Built with

- **PayPal, sandbox only:** Orders v2, refunds, Invoicing v2, Disputes, Catalog Products,
  Transaction Search, signed webhooks, Log in with PayPal, the JS SDK, the Agent Toolkit, and
  the PayPal Server SDK, written with the **APIMatic Context Plugin**.
- **Gemini** on Google Vertex AI, through the Vercel AI SDK, reads, counts and explains;
  **Cloud Vision** checks each photo for a face alongside it.
- **AG Studio** by AG Grid: the grower's ledger, with a custom widget, and its agents on Gemini
  through our own adapter.
- **Next.js 16** and TypeScript on Google Cloud Run, with Firestore and Cloud Storage.

---

## Run it yourself

Needs Node.js 20.9 or later.

```bash
npm install
npm run eval       # the evals; writes eval/results/<date>.json
npm run dev        # the app, on http://localhost:3000
```

For the PayPal and Gemini parts, copy `.env.example` to `.env.local` and fill in sandbox
credentials. The hosted demo needs none of this: it is live at
https://strawbank-434001576954.europe-west1.run.app. A sandbox buyer login for judges is in
the Devpost entry's testing instructions.

---

## Code layout

| Path | What |
|---|---|
| `src/lib/` | the plain code: money, orders, refunds, the ledger, the dusk report, the audit, IOUs, disputes, the photo fingerprint |
| `src/lib/paypal/` | every PayPal call: Server SDK, Agent Toolkit and REST |
| `src/lib/ai/` | Gemini's counting, reading and explaining, and the two face checks |
| `src/agent/` | the agent's PayPal tools; money tools never reach the model |
| `src/app/`, `src/components/` | the stand page, the receipt, the grower's pages, the AG Studio ledger, the API routes |
| `eval/` | the evals, their photos and the right answers |

File by file: [docs/code-layout.md](docs/code-layout.md).

---

## What this is not

- **Not theft prevention.** It measures what walked; it does not stop it.
- **Not surveillance.** The camera points at the shelf and the basket, never at people,
  and nobody is identified.
- **Not a point-of-sale terminal.** Customers pay on their own phones.
- **Never the decider of a price or an amount of money.** The grower sets prices; code does
  the sums.

---

## Licence

MIT. See [LICENSE](LICENSE).
