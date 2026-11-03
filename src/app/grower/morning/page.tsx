import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MorningSetup } from "@/components/grower/morning-setup";
import { standToday } from "@/lib/days";
import { toDecimal } from "@/lib/money";
import { currentGrower } from "@/lib/session";

// F1. The AI reads the price card and counts the shelf; nothing is priced
// until the grower confirms. The confirmed list becomes the day's catalogue.

export const metadata: Metadata = { title: "Strawbank · morning set-up" };

const SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };

async function Setup() {
  const grower = await currentGrower();
  if (!grower?.standId) redirect("/grower");
  const today = await standToday(grower.standId);
  if (!today) redirect("/grower");
  return (
    <>
      {today.morning && (
        <p className="mt-4 rounded-2xl bg-mint-soft px-4 py-3 text-sm text-ink">
          The stand is already open today. Setting it up again replaces this morning&apos;s prices and count.
        </p>
      )}
      <MorningSetup
        standId={today.stand.id}
        currencySymbol={SYMBOLS[today.stand.currency] ?? today.stand.currency}
        standing={today.catalogue.map(({ key, name, unitMinor }) => ({ key, name, price: toDecimal(unitMinor) }))}
      />
    </>
  );
}

export default function MorningPage() {
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
        <Setup />
      </Suspense>
    </div>
  );
}
