import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MorningSetup } from "@/components/grower/morning-setup";
import { dayState, readDay, standToday } from "@/lib/days";
import { toDecimal } from "@/lib/money";
import { currentGrower } from "@/lib/session";

// F1. The AI reads the price card and counts the shelf; nothing is priced
// until the grower confirms. The confirmed list becomes the day's catalogue.

export const metadata: Metadata = { title: "Strawbank · morning set-up" };

const SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };

const clock = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("en-IE", { timeStyle: "short", timeZone: "Europe/Dublin" }).format(new Date(iso)) : undefined;

async function Setup({ searchParams }: { searchParams: PageProps<"/grower/morning">["searchParams"] }) {
  const grower = await currentGrower();
  if (!grower?.standId) redirect("/grower");
  const today = await standToday(grower.standId);
  if (!today) redirect("/grower");
  const state = dayState(await readDay(today.stand.id));
  const setup = (
    <MorningSetup
      standId={today.stand.id}
      currencySymbol={SYMBOLS[today.stand.currency] ?? today.stand.currency}
      standing={today.catalogue.map(({ key, name, unitMinor }) => ({ key, name, price: toDecimal(unitMinor) }))}
    />
  );
  if (state === "not-set-up") return setup;

  // Already open or closed today: say so first, so nobody resets the day by accident (9 Nov).
  const since = clock(today.morning?.openedAt);
  const asked = (await searchParams).new === "1";
  // The day's state shows until the grower opens the set-up; then only the set-up
  // shows, so its own "The stand is open" is never under an old "closed" (9 Nov).
  // The details come first in the page so the card can follow its open state.
  return (
    <div className="flex flex-col">
        <details className="peer group order-2 mt-6" open={asked}>
          <summary className="block cursor-pointer list-none rounded-full border border-line-2 bg-canvas py-3 text-center font-semibold text-ink group-open:hidden">
            {state === "open" ? "Set up the stand again" : "Start a new day"}
          </summary>
          <p className="rounded-2xl bg-straw-soft px-4 py-3 text-sm text-ink">
            A new day starts from a new count of the shelf and a new price card. The dusk report then counts only the sales and IOUs made after it; earlier ones stay in the ledger.
          </p>
          {setup}
        </details>
        <section className="order-1 mt-6 rounded-3xl border border-line bg-canvas p-5 shadow-card peer-open:hidden">
          <h2 className="display text-xl text-ink">{state === "open" ? "The stand is open" : "Today's stand is closed"}</h2>
          <p className="mt-2 text-ink-2">
            {state === "open"
              ? `Open${since ? ` since ${since}` : ""}, with this morning's prices and count. Customers pay on the stand page.`
              : "The dusk report is done. To run the stand again, start a new day."}
          </p>
          <div className="mt-4 grid gap-2">
            {state === "open" ? (
              <Link href={`/s/${today.stand.id}`} className="rounded-full bg-ink py-3 text-center font-semibold text-canvas">
                See the stand page
              </Link>
            ) : (
              <Link href="/grower/dusk" className="rounded-full bg-ink py-3 text-center font-semibold text-canvas">
                See the dusk report
              </Link>
            )}
            <Link href="/grower" className="rounded-full border border-line-2 py-3 text-center font-semibold text-ink">
              Back to today
            </Link>
          </div>
        </section>
    </div>
  );
}

export default function MorningPage({ searchParams }: PageProps<"/grower/morning">) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Morning set-up</p>
          <h1 className="display text-2xl text-ink">Set up the stand</h1>
        </div>
      </header>
      <p className="mt-4 text-ink-2">Photograph the price card, then the stocked stand. Check what the AI read and correct anything wrong.</p>
      <Suspense fallback={<p className="mt-6 text-ink-3">Opening…</p>}>
        <Setup searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
