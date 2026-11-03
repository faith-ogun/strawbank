import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import QRCode from "qrcode";
import { type ReactNode, Suspense } from "react";
import { appUrl } from "@/lib/app-url";
import { DEMO_STAND } from "@/lib/demo-stand";
import { formatMoney } from "@/lib/money";
import { readDay, standDate } from "@/lib/days";
import { paymentsForDay } from "@/lib/dusk";

// The judge's path: both sides of the stand in about ten minutes, on the real
// app, in PayPal's sandbox. The grower opens the stand, the judge buys from it
// on their own phone, then closes the day and sees what PayPal recorded. The
// "today" line is read from the stand's own records, not written for show.

export const metadata: Metadata = {
  title: "Strawbank · try both sides of the stand",
  description: "Open the demo stand as its grower, buy from it on your phone, and close the day. PayPal sandbox only.",
};

const REPO = "https://github.com/faith-ogun/strawbank";

async function Today() {
  await connection(); // today's stand, read when the page is asked for
  const date = standDate();
  const [day, { payments }] = await Promise.all([readDay(DEMO_STAND.id, date).catch(() => ({})), paymentsForDay(DEMO_STAND.id, date).catch(() => ({ payments: [] }))]);
  // Payments PayPal itself confirmed; an IOU settled in cash is the grower's word, not PayPal's.
  const confirmed = payments.filter((p) => p.payment === "confirmed" && (p.source === "webhook" || p.source === "capture")).length;
  const open = "morning" in day && Boolean(day.morning);
  const closed = "dusk" in day && Boolean(day.dusk);
  return (
    <p className="mt-6 inline-flex flex-wrap items-center gap-x-2 rounded-full border border-line-2 bg-white px-4 py-2 text-sm text-ink-2">
      <span className={`h-2 w-2 rounded-full ${open ? "bg-mint" : "bg-straw-2"}`} />
      <span className="font-semibold text-ink">Today at the demo stand:</span>
      {closed ? "closed for the day" : open ? "open" : "not opened yet, so start with step 1"}
      <span className="text-ink-4">·</span>
      {confirmed === 0 ? "no payments confirmed by PayPal yet" : `${confirmed} payment${confirmed === 1 ? "" : "s"} confirmed by PayPal`}
    </p>
  );
}

async function StandQr() {
  const url = `${appUrl()}/s/${DEMO_STAND.id}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0a1643", light: "#ffffff" } });
  return (
    <figure className="hidden w-40 shrink-0 rounded-2xl border border-line bg-white p-3 shadow-card sm:block">
      <div aria-label={`QR code for ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="mt-2 text-center font-mono text-[0.625rem] text-ink-3">The stand&apos;s QR code</figcaption>
    </figure>
  );
}

function DemoGrowerButton({ label }: { label: string }) {
  return (
    <form action="/api/auth/demo" method="post">
      <button type="submit" className="rounded-full border border-ink bg-straw px-5 py-2.5 font-semibold text-ink shadow-tag active:translate-y-px">
        {label}
      </button>
    </form>
  );
}

function Step({ n, title, minutes, children }: { n: number; title: string; minutes: string; children: ReactNode }) {
  return (
    <li className="rounded-3xl border border-line bg-white p-6 shadow-card">
      <p className="eyebrow text-straw-ink">
        Step {n} · about {minutes}
      </p>
      <h2 className="display mt-1 text-2xl text-ink">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-2">{children}</div>
    </li>
  );
}

const look = "font-semibold text-ink";

export default function TryPage() {
  return (
    <main className="landing min-h-svh flex-1">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-20 pt-8 sm:px-6">
        <header className="flex items-center gap-3">
          <Link href="/" aria-label="Strawbank home">
            <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
          </Link>
          <p className="eyebrow text-straw-ink">For judges, and anyone curious</p>
        </header>
        <h1 className="display mt-4 text-[2.4rem] leading-tight text-ink sm:text-5xl">Try both sides of the stand.</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          You are the grower and the customer at once. It takes about ten minutes, on the real app, in PayPal&apos;s sandbox: no real money moves. The sandbox buyer&apos;s email and password are in the testing instructions on Devpost.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-ink-3">Reading today at the demo stand…</p>}>
          <Today />
        </Suspense>

        <ol className="mt-8 space-y-4">
          <Step n={1} title="Open the stand, as its grower" minutes="2 minutes">
            <p>
              Press the button: you are signed in as the demo stand&apos;s grower, with no account. Open <span className={look}>Morning set-up</span>. Photograph a price card and the shelf if you have some eggs, onions, potatoes or a jar of jam to hand; otherwise press{" "}
              <span className={look}>These prices are right</span>, count the shelf with the <span className={look}>+</span> buttons, and press <span className={look}>Open the stand</span>.
            </p>
            <p>Each item becomes a product in the grower&apos;s PayPal catalogue. If the stand is already open today, skip to step 2.</p>
            <DemoGrowerButton label="Be the grower" />
          </Step>

          <Step n={2} title="Buy something, on your own phone" minutes="3 minutes">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="space-y-3">
                <p>
                  Scan the code, or open <Link className="font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4" href={`/s/${DEMO_STAND.id}`}>the stand page</Link>. Photograph a basket (eggs, onions, potatoes, a jar), or press <span className={look}>Count it myself instead</span>. Check the count: you have the final word. Pay with PayPal as the sandbox buyer.
                </p>
                <p>
                  On the receipt: PayPal&apos;s order and payment ids, &quot;collected at the stand&quot;, and every call Strawbank made to PayPal with its debug id. Then press <span className={look}>Something&apos;s wrong with this?</span> and say you took one fewer: the agent recounts your photo and, if it agrees and the amount is within the grower&apos;s {formatMoney(DEMO_STAND.refundLimitMinor, DEMO_STAND.currency)} limit, refunds you itself.
                </p>
                <p>
                  No PayPal to hand? Under the total, <span className={look}>Leave an IOU</span> asks PayPal to invoice the basket to an email address (a made-up one is fine in the sandbox).
                </p>
              </div>
              <Suspense fallback={null}>
                <StandQr />
              </Suspense>
            </div>
          </Step>

          <Step n={3} title="Close the day, as the grower" minutes="2 minutes">
            <p>
              Back on the grower&apos;s page, open <span className={look}>Dusk report</span>. Photograph what is left on the shelf, or count it with the buttons, and close the stand. You get what sold and what walked, item by item, with your payment confirmed by PayPal&apos;s own signed webhook. An item whose count or payment is not sure says &quot;uncertain&quot;, never &quot;missing&quot;.
            </p>
          </Step>

          <Step n={4} title="Look behind the counter" minutes="3 minutes">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className={look}>Ledger</span>: the stand in AG Studio. Press <span className={look}>Try it with 20 practice days</span> for weeks of (clearly labelled, simulated) data, then <span className={look}>Ask the assistant</span> and pick a question. It builds the chart on Gemini; any number in its words must already be in the ledger. A laptop screen works best.
              </li>
              <li>
                <span className={look}>Refunds</span>, <span className={look}>IOUs</span> and <span className={look}>Disputes</span>: what waits for the grower, and the evidence the stand would send PayPal.
              </li>
              <li>
                <span className={look}>Next-morning audit</span>: the day checked against PayPal&apos;s Transaction Search. PayPal can take a few hours to list a payment, so it is best the day after.
              </li>
              <li>
                <span className={look}>What Strawbank asked PayPal</span>, on the grower&apos;s page: every call, who asked, and PayPal&apos;s debug id.
              </li>
            </ul>
          </Step>
        </ol>

        <section className="mt-10 rounded-3xl bg-ink p-6 text-white">
          <h2 className="display text-2xl">Check what we claim</h2>
          <p className="mt-3 leading-relaxed text-white/80">
            The AI reads, counts and explains; plain code does every total, refund and gap, and the tests that prove it run on every commit. The README lists every PayPal endpoint with the date it was seen working, and every result in it comes from the evals.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <a className="rounded-full border border-white/30 px-4 py-2 font-semibold hover:border-white" href={REPO}>
              The code and README
            </a>
            <a className="rounded-full border border-white/30 px-4 py-2 font-semibold hover:border-white" href={`${REPO}/blob/main/docs/eval.md`}>
              How each eval works
            </a>
            <Link className="rounded-full border border-white/30 px-4 py-2 font-semibold hover:border-white" href="/">
              The story of a day
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
