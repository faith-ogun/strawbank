import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { findStand } from "@/lib/demo-stand";
import { currentGrower } from "@/lib/session";
import { PayPalCalls } from "@/components/paypal-calls";
import { callsForStand } from "@/lib/paypal/calls";

// The grower's front door. Customers never sign in; growers sign in with
// PayPal, and judges get a one-click demo grower beside it (decision log,
// "Who signs in").

export const metadata: Metadata = { title: "Strawbank · your stand" };

const SIGN_IN_PROBLEMS: Record<string, string> = {
  cancelled: "You cancelled the PayPal sign-in. Nothing was shared.",
  expired: "That sign-in took too long or came from another tab. Please try again.",
  failed: "PayPal could not sign you in just now. Please try again.",
};

const button = "block w-full rounded-full py-3.5 text-center font-semibold";

/** The grower's pages; one that is not built yet is shown but not linked. */
const GROWER_PAGES = (standId: string) => [
  { href: "/grower/morning", label: "Morning set-up", hint: "Photograph the price card and the shelf", ready: true },
  { href: "/grower/dusk", label: "Dusk report", hint: "What sold and what walked", ready: true },
  { href: "/grower/refunds", label: "Refunds", hint: "Requests waiting for you", ready: true },
  { href: "/grower/audit", label: "Next-morning audit", hint: "Does PayPal agree with the ledger?", ready: true },
  { href: "/grower/ledger", label: "Ledger", hint: "Every payment, refund and PayPal call, in AG Studio", ready: true },
  { href: `/s/${standId}`, label: "The stand page", hint: "What customers see", ready: true },
];

function DemoButton({ label }: { label: string }) {
  return (
    <form action="/api/auth/demo" method="post">
      <button type="submit" className={`${button} border border-line-2 bg-canvas text-ink`}>
        {label}
      </button>
    </form>
  );
}

async function Front({ searchParams }: { searchParams: PageProps<"/grower">["searchParams"] }) {
  const grower = await currentGrower();
  const problem = SIGN_IN_PROBLEMS[String((await searchParams).signin ?? "")];

  if (!grower) {
    return (
      <>
        <p className="mt-6 leading-relaxed text-ink-2">
          Sign in to set up the day, see the dusk report and approve refunds. Customers never need to sign in.
        </p>
        {problem && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-ink">{problem}</p>}
        <div className="mt-6 space-y-3">
          <a href="/api/auth/paypal/login" className={`${button} bg-ink text-canvas`}>
            Log in with PayPal
          </a>
          <DemoButton label="Try the demo stand as its grower" />
        </div>
        <p className="mt-4 text-sm text-ink-3">The demo needs no account. Everything runs in PayPal&apos;s sandbox: no real money moves.</p>
      </>
    );
  }

  const stand = grower.standId ? findStand(grower.standId)?.stand : undefined;
  const calls = stand ? await callsForStand(stand.id).catch(() => []) : [];
  return (
    <>
      <p className="mt-6 text-ink-2">
        Signed in as <span className="font-semibold text-ink">{grower.name}</span>
        {grower.growerId !== "demo" && " with PayPal"}.
      </p>
      {stand ? (
        <div className="mt-6 rounded-3xl border border-line bg-canvas p-5 shadow-card">
          <p className="eyebrow text-straw-ink">Your stand</p>
          <h2 className="display text-xl text-ink">{stand.name}</h2>
          <nav className="mt-4 grid gap-2">
            {GROWER_PAGES(stand.id).map(({ href, label, hint, ready }) =>
              ready ? (
                <Link key={href} href={href} className="rounded-2xl bg-paper px-4 py-3">
                  <span className="block font-semibold text-ink">{label}</span>
                  <span className="block text-sm text-ink-3">{hint}</span>
                </Link>
              ) : (
                <div key={href} className="rounded-2xl border border-dashed border-line-2 px-4 py-3">
                  <span className="block font-semibold text-ink-3">{label}</span>
                  <span className="block text-sm text-ink-4">{hint} · coming this week</span>
                </div>
              ),
            )}
          </nav>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="leading-relaxed text-ink-2">
            You don&apos;t have a stand yet. Setting up your own comes next; until then, you can run the demo stand.
          </p>
          <DemoButton label="Run the demo stand" />
        </div>
      )}
      <PayPalCalls calls={calls} title="What Strawbank asked PayPal" />
      <form action="/api/auth/logout" method="post" className="mt-6">
        <button type="submit" className="text-sm font-semibold text-ink-3 underline underline-offset-4">
          Sign out
        </button>
      </form>
    </>
  );
}

export default function GrowerPage({ searchParams }: PageProps<"/grower">) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Strawbank home">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Grower</p>
          <h1 className="display text-2xl text-ink">Your stand</h1>
        </div>
      </header>
      <Suspense fallback={<p className="mt-6 text-ink-3">Checking who you are…</p>}>
        <Front searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
