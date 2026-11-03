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
  <a href="#the-rule-the-ai-never-touches-money">The money rule</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#what-this-is-not">What this is not</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PayPal-sandbox-0088F5" alt="PayPal sandbox">
  <img src="https://img.shields.io/badge/Gemini-Vertex_AI-0F1252" alt="Gemini on Vertex AI">
  <img src="https://img.shields.io/badge/Next.js-16-0A0C3C" alt="Next.js 16">
  <img src="https://img.shields.io/badge/eval_E4-16_properties,_0_failures-2ea043" alt="eval E4: 16 properties, 0 failures">
  <img src="https://img.shields.io/badge/status-in_development-5D6B7A" alt="in development">
  <img src="https://img.shields.io/badge/licence-MIT-43FE8A" alt="MIT licence">
</p>

---

> **Status: in development.** The money code is written and tested (eval E4, below), and a
> sandbox order with one line per item is created and captured through the PayPal Server SDK,
> and partial refunds go through the PayPal Agent Toolkit with the amount code decided. The
> customer's stand page and receipt are live, with sandbox payments; the grower and ledger
> pages are being built. This README only claims what works, and every result in it comes
> from `npm run eval`.
>
> **Try it on a phone:** [the demo stand](https://strawbank-434001576954.europe-west1.run.app/s/demo).
> Payments are PayPal sandbox only; no real money moves.

---

## What is this, in plain terms?

All over Ireland, Britain and North America, farms sell eggs, jam, vegetables and flowers
from a table at the end of the lane, with nobody there. You take what you want and leave
the money in a jar or tin: an **honesty box**. It runs on trust, and three things go wrong:

- **The tin gets stolen**
  ([Laois](https://www.rte.ie/news/leinster/2023/0330/1367373-honesty-box-eggs), [Kildare](https://www.farmersjournal.ie/tillage/news/kildare-farmer-tracks-down-egg-and-potato-thieves-838832),
  [British Columbia](https://globalnews.ca/news/11323028/lake-country-b-c-farm-stand-operating-on-the-honour-system-raided)).
- **Fewer people carry cash**, so sales walk past.
- **At dusk the grower cannot tell what sold from what walked**, so they cannot tell
  whether the stand is worth keeping.

Strawbank keeps the trust and adds a shopkeeper. A QR code on the stand opens the shop on
the customer's phone, the AI counts the basket from a photo, and PayPal takes the payment.
At dusk, one more photo of the shelf, and the grower gets the day's truth in plain words.

---

## How a day works

| Moment | The AI | Plain code | PayPal (sandbox) |
|---|---|---|---|
| **Morning:** the grower photographs the price card and the shelf | reads the prices, counts the stock | nothing is for sale until the grower confirms | each new item becomes a catalogue product |
| **A customer:** scans the QR code, photographs the basket | counts the basket, with how sure it is | the customer has the final word; code works out the total | an order with one line per item, then the capture |
| **Something's wrong:** "I took one jar, not two" | recounts the stored photo | works out the refund, its cap, and who decides | the agent refunds small, clear cases within the grower's limit |
| **Dusk:** the grower photographs the shelf | counts what is left, then explains the day | taken minus paid, per item; an unsure count says "uncertain", never "missing" | our ledger, built from signed webhooks |
| **Next morning** | | compares our ledger with PayPal's records | Transaction Search |

---

## The rule: the AI never touches money

The AI reads, counts and explains. **Every total, refund, cap and gap is plain code**,
because if the same input must always give the same answer, a guess is not good enough.
Even the AI's dusk explanation is checked: any number in it that code did not compute, and
the AI's words are replaced by a plain template.

That rule is tested before anything else is built. `npm run eval` runs eval **E4**: 16
properties, each tried against generated cases (fast-check), on **14,002 cases with 0
failures** (scorecard `eval/results/2026-10-28.json`).

| Id | The property |
|---|---|
| E4.1 | Order total = sum of lines (quantity x price) = PayPal `item_total`, in minor units |
| E4.1b | A basket with an unknown item or a bad quantity never becomes an order |
| E4.1c | The PayPal SDK request carries the order body's amounts and lines unchanged |
| E4.2 | A refund never exceeds what was paid minus earlier refunds; the agent acts only within its limit, on a confident recount that backs the claim |
| E4.2b | Under repeated, concurrent and failing requests, refunds never exceed what was captured |
| E4.2c | A refund sent to PayPal is exactly the amount code decided; a refusal frees it, and no answer keeps it pending |
| E4.3 | The same refund request never produces two refunds |
| E4.4 | A duplicate or late webhook never changes the ledger twice |
| E4.5 | The AI's text never introduces a number that is not in the computed reconciliation |
| E4.5b | Text that uses only computed numbers passes the check |
| E4.5c | Whatever the AI writes, the text shown contains only computed numbers |
| E4.5d | No note the AI writes about a basket reaches the customer if it mentions money |
| E4.5e | A plain counting note, with no money in it, is shown as written |
| E4.6 | The PayPal Agent Toolkit, as configured, offers the agent exactly its allowed tools |
| E4.6b | The agent never calls a tool outside its allowlist |
| E4.6c | No tool handed to the model can move money; refunds run only from code |

The tests were checked by planting bugs in the money code (a total off by a cent, a refund
limit off by a cent, a missing duplicate check, a ledger that counts a repeat twice); each
planted bug made a property fail.

Basket counting (eval **E1**) now runs on real photos of eggs, onions and potatoes, loose,
in an egg box, in a bag and in a hand. On the first **10 baskets, 9 were counted exactly**;
the miss was one egg too many in a pile of eight (scorecard `eval/results/2026-11-03.json`,
provisional until all 40 photos are in). The other evals (shelf and price-card counting,
whole simulated days, agent safety, the next-morning audit) are defined in
[docs/eval.md](docs/eval.md) and switch on as their photos and features arrive.

---

## Built with

The stack, as each part lands:

- **PayPal, sandbox only:** Orders v2 with itemised lines and capture, Payments v2 refunds,
  Catalog Products, Transaction Search, signed webhooks, the PayPal JS SDK, the PayPal Agent
  Toolkit for the agent's tools, and the PayPal Server SDK, written with the **APIMatic
  Context Plugin**.
- **Gemini** on Google Vertex AI, through the Vercel AI SDK: reading, counting, explaining.
- **AG Studio** by AG Grid: the grower's ledger dashboard and its agent.
- **Next.js 16** (TypeScript), hosted on Google Cloud Run.

---

## Run it yourself

Needs Node.js 20.9 or later.

```bash
npm install
npm run eval       # the evals; writes eval/results/<date>.json
npm run dev        # the app shell, on http://localhost:3000
```

For the PayPal and Gemini parts, copy `.env.example` to `.env.local` and fill in sandbox
credentials. The hosted demo needs none of this: it is live at
https://strawbank-434001576954.europe-west1.run.app, and the demo stand is
[`/s/demo`](https://strawbank-434001576954.europe-west1.run.app/s/demo). A sandbox buyer
login for judges: to come.

---

## Code layout

| Path | What |
|---|---|
| `src/lib/money.ts` | money as whole minor units; decimal strings only at the edges |
| `src/lib/orders.ts` | counts x confirmed prices, order lines, the Orders v2 body |
| `src/lib/paypal/` | the PayPal Server SDK client (sandbox only); order create, capture and get; the refund gateway |
| `src/lib/refunds.ts` | refund amount, cap and who decides; at most one refund per request |
| `src/lib/ledger.ts` | the webhook ledger; repeated or late webhooks change nothing |
| `src/lib/reconcile.ts` | taken, paid and gap per item at dusk |
| `src/lib/explain-check.ts` | rejects AI text with a number code did not compute |
| `src/agent/tools.ts` | the agent's PayPal tool allowlist |
| `src/agent/toolkit.ts` | the PayPal Agent Toolkit, sandbox only, adapted to AI SDK v7; money tools never reach the model |
| `src/app/` | the stand page and receipt, the grower's pages, the ledger, the API routes |
| `eval/` | the eval; see [docs/eval.md](docs/eval.md) |

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
