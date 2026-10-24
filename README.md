# Honesty Box (working title)

An AI shopkeeper for unstaffed farm stands, built for the
[PayPal AI Hackathon](https://paypalaihackathon.devpost.com).

> **Status: in development.** The app shell runs locally and the money code is tested
> (eval E4), but none of the flows below is built yet. This README will describe only what
> works, with the numbers from `npm run eval`.

## The idea

Roadside stands selling eggs, vegetables, jam and flowers run on trust and a cash tin. The
tin gets stolen, fewer people carry cash, and at dusk the grower cannot tell what sold from
what walked.

- **Morning:** the grower photographs the price card and the shelf. The AI reads the prices
  and counts the stock; the grower confirms.
- **Customer:** scans the QR code on the stand, photographs their basket, checks the count
  and pays with PayPal.
- **Dusk:** the grower photographs the shelf again. The agent compares stock, payments and
  photos and says what sold and what is unaccounted for.
- **Refunds:** small overcharges are refunded by the agent within the grower's limit; larger
  ones wait for the grower.

The model reads, counts and explains. Every amount of money is worked out by plain code.

## Built with

- PayPal (sandbox): Orders v2, Payments v2 refunds, Catalog Products, Transaction Search,
  webhooks, the PayPal JS SDK and the PayPal Agent Toolkit
- Gemini, through the Vercel AI SDK
- AG Studio by AG Grid, for the grower's ledger
- APIMatic Context Plugin, used while building

## Setup

Needs Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local   # then fill in the sandbox and Gemini values
npm run dev                  # http://localhost:3000
npm run eval                 # writes eval/results/<date>.json
```

To come: sandbox accounts, the hosted demo link and test logins.

## Code layout

The layout follows the product spec's flows (F1 to F6).

| Path | What |
|---|---|
| `src/lib/money.ts` | Money as whole minor units; decimal strings only at the edges |
| `src/lib/orders.ts` | Counts x confirmed prices -> order lines and the Orders v2 body (F2) |
| `src/lib/refunds.ts` | Refund amount, cap and who decides; at most one refund per request (F4) |
| `src/lib/ledger.ts` | The webhook ledger; repeated or late webhooks change nothing |
| `src/lib/reconcile.ts` | Taken, paid and gap per item at dusk (F3) |
| `src/lib/explain-check.ts` | Rejects model text that uses a number code did not compute |
| `src/agent/tools.ts` | The agent's PayPal tool allowlist |
| `src/lib/ai/model.ts` | Gemini through the Vercel AI SDK |
| `src/lib/paypal/config.ts` | PayPal sandbox endpoint and credentials |
| `src/app/s/[standId]` | The customer's stand page and receipt (F2, F4) |
| `src/app/grower` | Morning set-up, dusk count, refund queue (F1, F3, F4) |
| `src/app/ledger` | The grower's ledger (F6) |
| `src/app/api` | Orders, capture, photo counting, refunds, webhooks, dusk, audit |
| `eval/` | The eval: see [docs/eval.md](docs/eval.md) |

The model reads photos, counts and explains. Totals, refunds, caps and gaps are plain code,
and the model's explanations are checked against the computed numbers before they are
shown.

## Licence

MIT. See [LICENSE](LICENSE).
