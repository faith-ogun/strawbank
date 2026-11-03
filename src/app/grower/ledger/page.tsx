import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LedgerLoader } from "@/components/ledger/ledger-loader";
import { findStand } from "@/lib/demo-stand";
import { readMorning } from "@/lib/days";
import { standLedger } from "@/lib/ledger-rows";
import { practiceLedger } from "@/lib/practice-ledger";
import { currentGrower } from "@/lib/session";

// F6. The grower's ledger in AG Studio: the stand's real records by default,
// or, on request, the twenty simulated practice days from eval E5, labelled
// as such. The AG Studio licence key is read here at request time and passed
// to the browser, as AG's browser-side licences work; it is never in the repo.

export const metadata: Metadata = { title: "Strawbank · ledger" };

async function Ledger({ searchParams }: { searchParams: PageProps<"/grower/ledger">["searchParams"] }) {
  const grower = await currentGrower();
  const found = grower?.standId ? findStand(grower.standId) : undefined;
  if (!found) redirect("/grower");
  const practice = (await searchParams).data === "practice";
  const morning = practice ? undefined : await readMorning(found.stand.id);
  const rows = practice ? practiceLedger() : await standLedger(found.stand.id, morning?.catalogue ?? found.catalogue);
  const empty = rows.itemDays.length === 0 && rows.payments.length === 0;
  return (
    <>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${practice ? "bg-unsure-soft" : "bg-paper"}`}>
        {practice ? (
          <p className="text-ink">
            <span className="font-semibold">Practice data:</span> 20 simulated days from eval E5, put through the same code as a real stand. Not real sales.
          </p>
        ) : (
          <p className="text-ink">
            <span className="font-semibold">{rows.standName}:</span> real records, every payment confirmed by PayPal itself.
            {empty && " Nothing to show until the stand's first sale or dusk count."}
          </p>
        )}
        <Link href={practice ? "/grower/ledger" : "/grower/ledger?data=practice"} className="font-semibold text-ink underline underline-offset-4">
          {practice ? "Back to your stand" : "Try it with 20 practice days"}
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <LedgerLoader key={practice ? "practice" : "stand"} rows={rows} licenseKey={process.env.AG_STUDIO_LICENSE_KEY} />
      </div>
    </>
  );
}

export default function LedgerPage({ searchParams }: PageProps<"/grower/ledger">) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={28} height={32} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Grower</p>
          <h1 className="display text-lg leading-tight text-ink">Ledger</h1>
        </div>
      </header>
      <Suspense fallback={<p className="p-6 text-ink-3">Reading the ledger…</p>}>
        <Ledger searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
