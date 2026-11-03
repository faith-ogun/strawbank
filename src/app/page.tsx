import Image from "next/image";
import type { ReactNode } from "react";
import { DuskArtefact, Marked, PriceCardArtefact, RefundArtefact } from "@/components/landing/artefacts";
import { BasketCard } from "@/components/landing/basket-card";
import { Story } from "@/components/landing/story";

const REPO = "https://github.com/faith-ogun/strawbank";

function Strip() {
  return (
    <div className="bg-ink text-white">
      <p className="mx-auto flex max-w-[1240px] items-center justify-center gap-2 px-4 py-2 text-center font-mono text-[0.6875rem] tracking-wide">
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-mint" />
        <span>
          In build for the PayPal AI Hackathon <span className="text-white/50">·</span> PayPal sandbox only, no real money
          moves
        </span>
      </p>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-line bg-white">
      <nav className="mx-auto flex h-full max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2" aria-label="Strawbank, back to the top">
          <Image src="/brand/strawbank-mark.png" alt="" width={34} height={38} priority />
          <span className="display text-[1.4rem] text-ink">Strawbank</span>
        </a>
        <div className="hidden items-center gap-7 text-sm font-medium text-ink-2 md:flex">
          <a className="hover:text-ink" href="#tin">
            A day
          </a>
          <a className="hover:text-ink" href="#rule">
            The money rule
          </a>
          <a className="hover:text-ink" href="#paypal">
            PayPal
          </a>
          <a className="hover:text-ink" href="#not">
            What it is not
          </a>
        </div>
        <a
          href="/try"
          className="rounded-full border border-ink bg-straw px-4 py-2 text-sm font-semibold text-ink shadow-tag transition-transform hover:-translate-y-px active:translate-y-px"
        >
          Try both sides
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <div>
      <p className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-paper px-3 py-1 font-mono text-[0.6875rem] text-ink-2">
        <span className="h-1.5 w-1.5 rounded-full bg-straw-2" />
        An AI shopkeeper for roadside farm stands
      </p>
      <h1 className="display mt-6 text-[2.9rem] text-ink sm:text-6xl xl:text-[4.6rem]">
        Minds the honesty box while you&apos;re in the <Marked>field</Marked>.
      </h1>
      <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">
        A customer photographs their basket, the AI counts it, plain code works out the total, and they pay with PayPal.
        At dusk, Strawbank tells you what sold and what walked, and it refunds small overcharges itself, within your limit.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href="#tin"
          className="rounded-full border border-ink bg-straw px-6 py-3 font-semibold text-ink shadow-tag transition-transform hover:-translate-y-px active:translate-y-px"
        >
          Follow a day at the stand ↓
        </a>
        <a href="/try" className="rounded-full border border-line-2 bg-white px-6 py-3 font-semibold text-ink hover:border-ink">
          Try it: be the grower and the customer
        </a>
      </div>
      <p className="mt-6 font-mono text-[0.75rem] text-ink-3">
        The AI counts. Code does every sum. Nobody on camera.
      </p>
    </div>
  );
}

function Chapter({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-3 text-straw-ink">
        <span className="h-px w-8 bg-straw-2" />
        {eyebrow}
      </p>
      <h2 className="display mt-4 max-w-[30rem] text-[2.1rem] text-ink sm:text-[2.6rem]">{title}</h2>
      {children}
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink-2">{children}</p>;
}

const TROUBLES = [
  {
    title: "The tin gets stolen.",
    text: (
      <>
        Sometimes again and again: reported in{" "}
        <a
          className="underline decoration-line-2 underline-offset-2 hover:decoration-ink"
          href="https://www.lep.co.uk/news/crime/callous-thieves-strike-again-after-honesty-box-stolen-from-ribble-valley-farm-3261252"
        >
          Lancashire
        </a>{" "}
        and in{" "}
        <a
          className="underline decoration-line-2 underline-offset-2 hover:decoration-ink"
          href="https://globalnews.ca/news/11323028/lake-country-b-c-farm-stand-operating-on-the-honour-system-raided"
        >
          British Columbia
        </a>
        .
      </>
    ),
  },
  { title: "Fewer people carry cash.", text: "A customer with only a card or a phone walks past." },
  {
    title: "At dusk, nobody knows.",
    text: "Without a count, the grower can't tell what sold from what walked, or whether the stand is worth keeping.",
  },
];

const chapters = [
  <Chapter key="tin" eyebrow="07:30 · The old way" title="It runs on trust, and the tin is the weak point.">
    <Body>
      All over Ireland, Britain and North America, farms sell eggs, vegetables and jam from a table at the end of the
      lane, with nobody there. You take what you want and leave the money in a tin.
    </Body>
    <ol className="mt-8 max-w-[34rem] divide-y divide-line border-y border-line">
      {TROUBLES.map((t, i) => (
        <li key={t.title} className="flex gap-5 py-4">
          <span className="font-mono text-sm text-straw-ink">0{i + 1}</span>
          <p className="text-ink-2">
            <span className="font-semibold text-ink">{t.title}</span> {t.text}
          </p>
        </li>
      ))}
    </ol>
    <Body>Strawbank keeps the trust and adds a shopkeeper. Here is one day at a stand.</Body>
  </Chapter>,

  <Chapter key="morning" eyebrow="07:40 · Morning set-up" title="Two photos, and the stand is open.">
    <Body>
      The grower photographs the chalk price card and the stocked shelf. The AI reads the prices and counts the stock.
      Nothing goes on sale until the grower confirms each line, and each new item becomes a product in the grower&apos;s
      PayPal catalogue.
    </Body>
    <PriceCardArtefact />
  </Chapter>,

  <Chapter key="customer" eyebrow="11:15 · A customer" title="Scan the code. Photograph the basket. Pay.">
    <Body>
      The AI counts each item and says how sure it is. Anything it isn&apos;t sure of is marked for the customer to check,
      and they can change any count: it is still an honesty box, so they have the final word. Code works out the total
      from the grower&apos;s confirmed prices. Try the buttons.
    </Body>
    <div className="mt-8">
      <BasketCard />
    </div>
  </Chapter>,

  <Chapter key="wrong" eyebrow="11:20 · Something's wrong" title={<>&ldquo;I took three onions, not four.&rdquo;</>}>
    <Body>
      Every receipt has a &ldquo;something&apos;s wrong&rdquo; link. The agent recounts the stored basket photo, and code
      works out the refund and its cap. If the photo backs the claim and the amount is within the grower&apos;s limit, the
      agent refunds it through PayPal. If not, the grower decides.
    </Body>
    <RefundArtefact />
  </Chapter>,

  <Chapter key="dusk" eyebrow="19:50 · Dusk" title="What sold, and what walked.">
    <Body>
      One more photo of the shelf. Code compares what was taken with what was paid for, item by item. The AI explains the
      day in plain words, and every number it writes is checked against the table first. A count it isn&apos;t sure of
      says &ldquo;uncertain&rdquo;, never &ldquo;missing&rdquo;.
    </Body>
    <DuskArtefact />
    <Body>
      Every day goes into the grower&apos;s ledger, a dashboard built with AG Studio, where they can ask things like
      &ldquo;which items go missing on Saturdays?&rdquo;
    </Body>
  </Chapter>,
];

const MODEL_DOES = [
  "Reads the grower's price card",
  "Counts the shelf and the basket, and says how sure it is",
  "Recounts a basket photo when a customer says something's wrong",
  "Explains the day in plain words",
];

const CODE_DOES = [
  "Every total, line by line, in whole cents",
  "Every refund, its cap, and whether the grower must decide",
  "Taken against paid, for each item",
  "The check on every number the AI writes",
];

function MoneyRule() {
  return (
    <section id="rule" className="scroll-mt-16 bg-ink text-white">
      <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <p className="eyebrow flex items-center gap-3 text-straw">
          <span className="h-px w-8 bg-straw" />
          The rule
        </p>
        <h2 className="display mt-4 max-w-[46rem] text-[2.4rem] sm:text-[3.4rem]">
          The AI counts. Code does the <Marked>sums</Marked>.
        </h2>
        <p className="mt-5 max-w-[40rem] text-lg leading-relaxed text-white/75">
          If the same input must always give the same answer, a guess is not good enough. So the model reads, counts and
          explains, and plain code does every total, refund, cap and gap.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            { head: "The AI", dot: "bg-mint", rows: MODEL_DOES },
            { head: "Plain code", dot: "bg-straw", rows: CODE_DOES },
          ].map((col) => (
            <div key={col.head} className="rounded-[22px] border border-white/15 p-6">
              <p className="eyebrow flex items-center gap-2 text-white/60">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {col.head}
              </p>
              <ul className="mt-4 space-y-3">
                {col.rows.map((r) => (
                  <li key={r} className="border-t border-white/10 pt-3 text-white/90">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-white/15 bg-white/15 sm:grid-cols-3">
          {[
            { n: "25", what: "money properties, each a rule that must always hold" },
            { n: "22,050", what: "generated cases tried against them" },
            { n: "0", what: "failures" },
          ].map((s) => (
            <div key={s.what} className="bg-ink p-6">
              <p className="display text-5xl text-straw">{s.n}</p>
              <p className="mt-2 text-white/80">{s.what}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[0.6875rem] text-white/50">
          Eval E4 scorecard, 3 Nov 2026. Bugs planted in the money code on purpose each made a property fail.
        </p>
      </div>
    </section>
  );
}

const PAYPAL = [
  { when: "07:40", moment: "Morning set-up", api: "Catalog Products", what: "each new item on the price card becomes a product, made once and reused" },
  { when: "11:15", moment: "A customer", api: "Orders v2", what: "one order line per item, collected at the stand, then the capture, by PayPal wallet or card" },
  { when: "11:20", moment: "Something's wrong", api: "Payments v2 refunds", what: "partial refunds, never more than was captured" },
  { when: "13:05", moment: "No PayPal to hand", api: "Invoicing v2", what: "the honesty-box IOU: an invoice for the basket at the stand's prices, paid later" },
  { when: "Any day", moment: "A dispute", api: "Disputes", what: "answered with the basket photo and the stand's own record, or the claim accepted" },
  { when: "All day", moment: "The ledger", api: "Webhooks", what: "signed events, verified, build the ledger; a repeated one changes nothing" },
  { when: "Next day", moment: "The audit", api: "Transaction Search", what: "our ledger checked against PayPal's own records" },
  { when: "Always", moment: "The agent", api: "Agent Toolkit", what: "its PayPal tools come from a short allowlist, and nothing else" },
];

function PayPalSection() {
  return (
    <section id="paypal" className="scroll-mt-16 bg-paper">
      <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <p className="eyebrow flex items-center gap-3 text-straw-ink">
          <span className="h-px w-8 bg-straw-2" />
          Where PayPal comes in
        </p>
        <h2 className="display mt-4 max-w-[40rem] text-[2.4rem] text-ink sm:text-[3.2rem]">PayPal runs through the whole day.</h2>
        <p className="mt-5 max-w-[40rem] text-lg leading-relaxed text-ink-2">
          Every moment of the day maps to a PayPal API. All of it runs in PayPal&apos;s sandbox, so no real money moves.
        </p>
        <ul className="mt-12 border-t border-line-2">
          {PAYPAL.map((row) => (
            <li
              key={row.api}
              className="grid gap-1 border-b border-line-2 py-5 md:grid-cols-[6rem_12rem_14rem_minmax(0,1fr)] md:items-baseline md:gap-6"
            >
              <span className="font-mono text-sm text-straw-ink">{row.when}</span>
              <span className="font-semibold text-ink">{row.moment}</span>
              <span className="font-mono text-sm text-ink">{row.api}</span>
              <span className="text-ink-2">{row.what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const NOT = [
  { title: "prevent theft", text: "It measures what walked. It does not stop it." },
  { title: "watch people", text: "The camera points at the shelf and the basket. A photo with a face is never kept, and nobody is identified." },
  { title: "need a till", text: "Customers pay on their own phones." },
  { title: "set a price or a sum", text: "The grower sets the prices. Code does the sums." },
];

function NotSection() {
  return (
    <section id="not" className="scroll-mt-16">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-28">
        <div>
          <p className="eyebrow flex items-center gap-3 text-straw-ink">
            <span className="h-px w-8 bg-straw-2" />
            What this is not
          </p>
          <h2 className="display mt-4 text-[2.4rem] text-ink sm:text-[3.2rem]">What Strawbank won&apos;t do.</h2>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2">
          {NOT.map((n) => (
            <li key={n.title} className="bg-white p-6">
              <p className="display text-2xl text-ink">
                <span className="text-ink-4">Won&apos;t </span>
                {n.title}
              </p>
              <p className="mt-2 text-ink-2">{n.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const BUILT_WITH = ["PayPal, sandbox", "Gemini on Vertex AI", "AG Studio by AG Grid", "APIMatic Context Plugin", "Next.js on Google Cloud Run"];

function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <Image src="/brand/strawbank-logo-reversed.png" alt="Strawbank" width={262} height={125} />
            <p className="mt-3 max-w-[22rem] text-white/70">Minds the honesty box while the grower is in the field.</p>
          </div>
          <div>
            <p className="eyebrow text-white/50">Built with</p>
            <ul className="mt-3 flex max-w-[36rem] flex-wrap gap-2">
              {BUILT_WITH.map((b) => (
                <li key={b} className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/85">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 font-mono text-[0.6875rem] text-white/50 sm:flex-row sm:justify-between">
          <span>An entry to the PayPal AI Hackathon, 2026 · MIT licence</span>
          <a className="hover:text-white" href={REPO}>
            Code on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div id="top" className="landing flex-1">
      <Strip />
      <Nav />
      <main>
        <Story hero={<Hero />} chapters={chapters} />
        <MoneyRule />
        <PayPalSection />
        <NotSection />
      </main>
      <Footer />
    </div>
  );
}
