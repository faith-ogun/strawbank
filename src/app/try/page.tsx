import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import QRCode from "qrcode";
import { type ReactNode, Suspense } from "react";
import { ArrowIcon, BasketIcon, InboxIcon, MoonIcon, PhoneIcon, PlugIcon, ReceiptIcon, SearchIcon, StoreIcon, SunIcon, TableIcon } from "@/components/icons";
import { appUrl } from "@/lib/app-url";
import { DEMO_STAND } from "@/lib/demo-stand";
import { formatMoney } from "@/lib/money";
import { type DayRecord, type PaymentSummary, dayState, readDay, standDate } from "@/lib/days";
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
  const day = await readDay(DEMO_STAND.id, date).catch((): DayRecord => ({}));
  const { payments } = await paymentsForDay(DEMO_STAND.id, date, day.morning?.openedAt).catch(() => ({ payments: [] as PaymentSummary[] }));
  // Payments PayPal itself confirmed; an IOU settled in cash is the grower's word, not PayPal's.
  const confirmed = payments.filter((p) => p.payment === "confirmed" && (p.source === "webhook" || p.source === "capture")).length;
  const state = dayState(day);
  const said = {
    "not-set-up": "not open yet: start as the grower",
    open: "open: you can buy straight away",
    closed: "closed: as the grower, press Start a new day",
  }[state];
  return (
    <p className="mt-6 inline-flex flex-wrap items-center gap-x-2 rounded-full border border-line-2 bg-white px-4 py-2 text-sm text-ink-2">
      <span className={`h-2 w-2 rounded-full ${state === "open" ? "bg-mint" : "bg-straw-2"}`} />
      <span className="font-semibold text-ink">The demo stand today:</span>
      {said}
      <span className="text-ink-4">·</span>
      {confirmed === 0 ? "no payments yet" : `${confirmed} payment${confirmed === 1 ? "" : "s"} confirmed by PayPal`}
    </p>
  );
}

async function StandQr({ className = "" }: { className?: string }) {
  const url = `${appUrl()}/s/${DEMO_STAND.id}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0a1643", light: "#ffffff" } });
  // On a laptop, the customer's side is best tried on a phone: scan to open it there.
  return (
    <figure className={`mt-4 hidden items-center gap-3 sm:flex ${className}`}>
      <div className="w-20 shrink-0 rounded-xl border border-line bg-white p-1.5" aria-label={`QR code for ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="text-xs leading-snug text-ink-3">Or scan this with your phone, and buy there as a customer would.</figcaption>
    </figure>
  );
}

const pill = "inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold transition-transform hover:-translate-y-px active:translate-y-px";

function DemoGrowerButton({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <form action="/api/auth/demo" method="post">
      <button type="submit" className={`${pill} border ${dark ? "border-straw bg-straw text-ink" : "border-ink bg-straw text-ink shadow-tag"}`}>
        {label} <ArrowIcon />
      </button>
    </form>
  );
}

/** Who does a step: the two roles have their own colours everywhere in the app. */
function Role({ who, onDark }: { who: "grower" | "customer"; onDark?: boolean }) {
  const style = who === "grower" ? (onDark ? "bg-white text-ink" : "bg-ink text-white") : "bg-straw text-ink";
  return <span className={`rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${style}`}>{who}</span>;
}

function Point({ icon, children, onDark }: { icon: ReactNode; children: ReactNode; onDark?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-xl ${onDark ? "bg-white/10 text-straw" : "bg-paper text-ink"}`}>{icon}</span>
      <span className={`pt-1.5 ${onDark ? "text-white/85" : "text-ink-2"}`}>{children}</span>
    </li>
  );
}

const STEPS: { n: number; who: "grower" | "customer"; icon: ReactNode; title: string; text: string }[] = [
  { n: 1, who: "grower", icon: <SunIcon />, title: "Open the stand", text: "Photograph the price card and the shelf, or set the counts with the buttons." },
  { n: 2, who: "customer", icon: <BasketIcon />, title: "Buy something", text: "Photograph a basket, check the count, and pay with PayPal as the sandbox buyer." },
  { n: 3, who: "customer", icon: <ReceiptIcon />, title: "Ask for a refund", text: "On the receipt, say you took one fewer. The agent recounts your photo and refunds you itself." },
  { n: 4, who: "grower", icon: <MoonIcon />, title: "Close the day", text: "Count what is left. See what sold and what walked, against PayPal's own record." },
];

const COUNTER: { href: string; icon: ReactNode; title: string; text: string }[] = [
  { href: "/grower/ledger", icon: <TableIcon />, title: "Ledger", text: "The stand in AG Studio, with an assistant on Gemini. Best on a laptop." },
  { href: "/grower/refunds", icon: <InboxIcon />, title: "Refunds, IOUs, disputes", text: "What waits for the grower, and the evidence sent to PayPal." },
  { href: "/grower/audit", icon: <SearchIcon />, title: "Next-morning audit", text: "The day against PayPal's Transaction Search. Best the day after." },
  { href: "/grower", icon: <PlugIcon />, title: "Every PayPal call", text: "Who asked, what for, and PayPal's debug id, on the grower's page." },
];

export default function TryPage() {
  return (
    <main className="landing min-h-svh flex-1">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <nav className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Strawbank home">
            <Image src="/brand/strawbank-mark.png" alt="" width={34} height={38} priority />
            <span className="display text-[1.4rem] text-ink">Strawbank</span>
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium text-ink-2">
            <Link className="hidden hover:text-ink sm:inline" href="/">
              The story of a day
            </Link>
            <a className="hover:text-ink" href={REPO}>
              The code
            </a>
          </div>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-10 sm:px-6">
        {/* Who is who: two roles, side by side on a wide screen. */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="eyebrow text-straw-ink">For judges, and anyone curious</p>
            <h1 className="display mt-3 text-[2.6rem] leading-[1.05] text-ink sm:text-[3.4rem]">Try both sides of the stand.</h1>
            <p className="mt-4 max-w-[30rem] text-lg leading-relaxed text-ink-2">
              Play the grower and the customer, on the real app. About ten minutes, in PayPal&apos;s sandbox: no real money moves.
            </p>
            <Suspense fallback={<p className="mt-6 text-sm text-ink-3">Reading today at the demo stand…</p>}>
              <Today />
            </Suspense>
            <p className="mt-4 text-sm text-ink-3">The sandbox buyer&apos;s login is in the testing instructions on Devpost.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="flex flex-col rounded-[26px] bg-ink p-6 text-white shadow-card">
              <div className="flex items-center justify-between">
                <Role who="grower" onDark />
                <StoreIcon className="h-7 w-7 text-straw" />
              </div>
              <h2 className="display mt-4 text-2xl">You run the stand</h2>
              <ul className="mt-4 flex-1 space-y-3 text-[0.9375rem]">
                <Point onDark icon={<SunIcon className="h-5 w-5" />}>
                  Set it up in the morning
                </Point>
                <Point onDark icon={<InboxIcon className="h-5 w-5" />}>
                  Decide refunds and IOUs
                </Point>
                <Point onDark icon={<MoonIcon className="h-5 w-5" />}>
                  See what walked at dusk
                </Point>
              </ul>
              <div className="mt-6">
                <DemoGrowerButton label="Be the grower" dark />
              </div>
              <p className="mt-3 text-xs text-white/60">No account needed: you sign in as the demo stand&apos;s grower.</p>
            </article>

            <article className="flex flex-col rounded-[26px] border-2 border-straw bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <Role who="customer" />
                <BasketIcon className="h-7 w-7 text-straw-ink" />
              </div>
              <h2 className="display mt-4 text-2xl text-ink">You buy from it</h2>
              <ul className="mt-4 flex-1 space-y-3 text-[0.9375rem]">
                <Point icon={<BasketIcon className="h-5 w-5" />}>Photograph your basket</Point>
                <Point icon={<PhoneIcon className="h-5 w-5" />}>Pay with PayPal on your phone</Point>
                <Point icon={<ReceiptIcon className="h-5 w-5" />}>Claim a refund if charged too much</Point>
              </ul>
              <div className="mt-6">
                <Link href={`/s/${DEMO_STAND.id}`} className={`${pill} whitespace-nowrap border border-ink bg-white text-ink`}>
                  Open the stand <ArrowIcon />
                </Link>
              </div>
              <Suspense fallback={null}>
                <StandQr />
              </Suspense>
            </article>
          </div>
        </section>

        {/* The day, in four steps, each with who does it. */}
        <section className="mt-16">
          <h2 className="display text-[1.9rem] text-ink">The day, in four steps</h2>
          <p className="mt-2 text-ink-2">Grower steps on a laptop or phone; customer steps on your own phone, as a customer would.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className={`relative flex flex-col rounded-3xl border bg-white p-5 shadow-card ${step.who === "grower" ? "border-line" : "border-straw"}`}>
                <div className="flex items-center justify-between">
                  <span className="display grid h-9 w-9 place-items-center rounded-full bg-paper text-lg text-ink">{step.n}</span>
                  <Role who={step.who} />
                </div>
                <span className={`mt-5 grid h-12 w-12 place-items-center rounded-2xl ${step.who === "grower" ? "bg-ink text-straw" : "bg-straw-soft text-straw-ink"}`}>{step.icon}</span>
                <h3 className="display mt-4 text-xl text-ink">{step.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* What the grower can look at after. */}
        <section className="mt-16">
          <h2 className="display text-[1.9rem] text-ink">Behind the counter</h2>
          <p className="mt-2 text-ink-2">As the grower, every page is in the bar: along the bottom on a phone, along the top on a laptop.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COUNTER.map((tile) => (
              <Link key={tile.title} href={tile.href} className="group rounded-3xl border border-line bg-white p-5 transition-colors hover:border-ink">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-paper text-ink">{tile.icon}</span>
                <h3 className="mt-4 flex items-center gap-1.5 font-semibold text-ink">
                  {tile.title} <ArrowIcon className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{tile.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 rounded-[28px] bg-ink p-7 text-white md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
          <div>
            <h2 className="display text-2xl">Check what we claim</h2>
            <p className="mt-3 leading-relaxed text-white/80">
              The AI reads, counts and explains. Plain code does every total, refund and gap, and the tests that prove it run on every commit.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm md:justify-end">
            <a className="rounded-full border border-white/30 px-4 py-2 font-semibold hover:border-white" href={REPO}>
              The code and README
            </a>
            <a className="rounded-full border border-white/30 px-4 py-2 font-semibold hover:border-white" href={`${REPO}/blob/main/docs/eval.md`}>
              How each eval works
            </a>
            <p className="w-full text-xs text-white/60 md:text-right">The grower&apos;s refund limit on the demo stand is {formatMoney(DEMO_STAND.refundLimitMinor, DEMO_STAND.currency)}.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
