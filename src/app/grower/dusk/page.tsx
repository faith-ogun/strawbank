import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DuskClose } from "@/components/grower/dusk-close";
import { DuskReport } from "@/components/grower/dusk-report";
import { findStand } from "@/lib/demo-stand";
import { readDay, standDate } from "@/lib/days";
import { currentGrower } from "@/lib/session";

// F3. Code works out taken, paid and the gap per item (src/lib/reconcile.ts,
// eval E5); the model explains, and its numbers are checked
// (src/lib/explain-check.ts, eval E4.5).

export const metadata: Metadata = { title: "Strawbank · dusk report" };

async function Day() {
  const grower = await currentGrower();
  const found = grower?.standId ? findStand(grower.standId) : undefined;
  if (!found) redirect("/grower");
  const day = await readDay(found.stand.id, standDate());
  if (!day.morning) {
    return (
      <section className="mt-6 rounded-3xl border border-line bg-canvas p-5 shadow-card">
        <h2 className="display text-xl text-ink">The stand was not set up today</h2>
        <p className="mt-2 text-ink-2">The dusk report compares tonight&apos;s shelf with this morning&apos;s. Set up the stand first.</p>
        <Link href="/grower/morning" className="mt-4 block rounded-full bg-ink py-3 text-center font-semibold text-canvas">
          Morning set-up
        </Link>
      </section>
    );
  }
  const items = day.morning.catalogue.map(({ key, name }) => ({ key, name }));
  return day.dusk ? (
    <>
      <DuskReport dusk={day.dusk} currency={found.stand.currency} />
      <details className="mt-6">
        <summary className="cursor-pointer text-center text-sm font-semibold text-ink-3 underline underline-offset-4">Count the shelf again</summary>
        <DuskClose items={items} currency={found.stand.currency} again />
      </details>
    </>
  ) : (
    <DuskClose items={items} currency={found.stand.currency} />
  );
}

export default function DuskPage() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Dusk report</p>
          <h1 className="display text-2xl text-ink">What sold, and what walked</h1>
        </div>
      </header>
      <p className="mt-4 text-ink-2">
        Photograph what is left on the stand. Strawbank compares it with this morning&apos;s count and the payments PayPal confirmed today.
      </p>
      <Suspense fallback={<p className="mt-6 text-ink-3">Opening…</p>}>
        <Day />
      </Suspense>
    </div>
  );
}
