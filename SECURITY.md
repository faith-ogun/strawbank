# Security

Strawbank is a hackathon entry that runs on **PayPal's sandbox only**. No real money moves,
and there is no setting that points it at live PayPal. Even so, it handles payments,
refunds, photos and email addresses as if they were real, and this page says how.

## Reporting a problem

Please report it privately: on this repository's **Security** tab, open **Advisories** and
press **Report a vulnerability**. Please do not open a public issue for it.

## What could go wrong, and what stops it

| Risk | What stops it | Where to check |
|---|---|---|
| The app charges or refunds real money | The PayPal base address and the SDK's environment are fixed to the sandbox in code; nothing reads them from settings | `src/lib/paypal/config.ts`, `src/lib/paypal/client.ts` |
| The AI decides an amount of money | Totals, refunds, caps and gaps are plain code. No tool handed to the model can move money; the refund runs from code with code's amount | `src/agent/tools.ts`, `src/agent/toolkit.ts`; evals E4.1, E4.2, E4.6 to E4.6c |
| The AI's words state a wrong amount | Any number in the AI's text that code did not compute is replaced by code's own words, at dusk and in the ledger's assistant | `src/lib/explain-check.ts`, `src/lib/ai/studio-turn.ts`; evals E4.5 to E4.5e, E4.8 |
| Text written on a photo tries to steer the AI | The prompts treat text in a photo as data, never as an instruction, and the numbers check above applies whatever the model was told | `src/lib/ai/count.ts`, `src/lib/ai/price-card.ts`; eval E6 (an instruction written on the price card is listed as ignored) |
| A photo shows a person | Two checks at the same moment: Gemini says whether a face is in the photo in the call that counts it, and Google Cloud Vision's face detection looks at it alongside. If either finds a face, the basket or shelf photo is refused and never stored, and the customer is asked to take it again. Vision detects faces; it does not recognise anyone, and it processes the photo in memory without storing it | `src/lib/ai/faces.ts`, `src/lib/ai/count.ts`, `src/app/api/count/route.ts`, `src/app/api/dusk/count/route.ts`; eval E6, which scores each check on its own |
| A forged PayPal webhook writes to the ledger | PayPal confirms every webhook's signature (`verify-webhook-signature`) before anything is stored; a repeated or late event changes nothing | `src/app/api/webhooks/paypal/route.ts`, `src/lib/paypal/webhooks.ts`, `src/lib/ledger.ts`; evals E4.4, E4.4b |
| A refund is paid twice, or for more than was paid | One refund per request, decided inside a Firestore transaction, with its own PayPal-Request-Id, so PayPal answers a repeated request with the same refund; refunds never add up to more than the capture, even under concurrent requests. A refund call with no answer in 20 seconds ends as unknown, and the refund stays pending | `src/lib/refund-store.ts`, `src/lib/refunds.ts`, `src/agent/tools.ts`; evals E4.2b, E4.2c, E4.3, E4.6d |
| Someone opens a grower's pages | The grower's session is a cookie the server seals with an HMAC (SHA-256, compared in constant time), `HttpOnly`, `Secure`, `SameSite=Lax`, for 7 days. Every grower page and route checks it and acts only on that grower's own stand | `src/lib/session.ts`, `src/lib/grower-guard.ts`; eval E4.7 |
| A secret leaks | Keys live in Google Secret Manager for Cloud Run and in a gitignored `.env.local` for local work; `.env.example` holds names only. Every push is scanned with gitleaks | `.gitignore`, `.env.example`, `.github/workflows/ci.yml` |
| A script runs up the bill on the public demo | Per-visitor limits on every route that calls Gemini or Cloud Vision or makes PayPal do something, a cap on the ledger assistant's turns per grower per hour, a timeout on every Gemini and PayPal call, and at most two Cloud Run instances | `src/lib/rate-limit.ts`, `src/app/api/studio/llm/route.ts`, `src/lib/paypal/client.ts` |
| Photos are seen or kept too long | Photos go to a private bucket (public access blocked, uniform access) and are deleted 30 days after upload. A photo behind an open refund or dispute is held until it closes. The grower sees a basket photo only through a route that checks their session | `src/lib/photos.ts`, `src/app/api/photos/basket/[countId]/route.ts` |
| A customer's email address is exposed | Customers never sign in or make an account. An IOU's address goes to PayPal, which sends the invoice; Strawbank keeps only a masked copy ("h…@example.com") | `src/lib/ious.ts`, `src/lib/iou-flow.ts`; eval E4.10 |

## Known limits

- **The demo grower is shared.** Anyone can press "Be the grower" and act as the demo
  stand's grower, including approving refunds, so that judges can try both sides without an
  account. It is the sandbox, so no real money moves. A grower who signs in with PayPal acts
  only on their own stand.
- **The per-visitor limits are approximate.** They live in the memory of each Cloud Run
  instance (at most two), keyed by the address Cloud Run's front end reports. That is enough
  to stop a loop or a script, not a determined attacker with many addresses.
- **The face checks have not yet seen a face.** Eval E6 has run both on every photo so far,
  and neither refused a real basket, but the trap photos with a face in them are still to
  come. Both checks see the photo before it is refused: Gemini once, in the call that counts
  it, and Vision once, alongside.
- **If Vision does not answer, Gemini's check alone decides.** Vision has 5 seconds, so the
  customer is never kept waiting on it; a call that fails or runs late is logged.
- **A timed-out Agent Toolkit call is abandoned, not cancelled.** The toolkit gives us no way
  to stop its request, so after 20 seconds Strawbank stops waiting, and PayPal may still act
  on it. That is why such a refund stays pending until PayPal's word settles it.
- **Dependencies.** `npm audit` reports advisories in packages that
  `@paypal/agent-toolkit` 1.11.0 brings in with it: its own older copies of the Vercel AI
  SDK (v4), Zod 3, LangChain, LangSmith and the OpenAI SDK. Strawbank imports only the
  toolkit's AI SDK entry point (`@paypal/agent-toolkit/ai-sdk`) and never calls LangChain,
  LangSmith or the OpenAI SDK itself. The only fix `npm audit` offers is downgrading the
  toolkit to an older release, so it stays on 1.11.0. The app's own dependencies, Zod 4
  among them, are kept up to date.

## Related

- [How each eval works](docs/eval.md)
- [Decisions](docs/decisions.md)
