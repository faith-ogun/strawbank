import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuditButton } from "@/components/grower/audit-button";
import { findStand } from "@/lib/demo-stand";
import { readDay, recentStandDates } from "@/lib/days";
import { currentGrower } from "@/lib/session";

// F5. The next-morning audit: two independent records of the day, Strawbank's
// ledger and PayPal's own Transaction Search, must agree (src/lib/audit.ts,
// eval E7). PayPal can take up to three hours to list a transaction, so the
// default is yesterday.

export const metadata: Metadata = { title: "Strawbank · audit" };

async function Day({ searchParams }: { searchParams: PageProps<"/grower/audit">["searchParams"] }) {
  const grower = await currentGrower();
  const found = grower?.standId ? findStand(grower.standId) : undefined;
  if (!found) redirect("/grower");
  const asked = (await searchParams).date;
  const days = recentStandDates(7);
  const yesterday = days[1];
  const date = typeof asked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : yesterday;
  const { audit } = await readDay(found.stand.id, date);
  return (
    <>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {days.map((d) => (
          <Link key={d} href={`/grower/audit?date=${d}`} className={`rounded-full px-3 py-1 ${d === date ? "bg-ink text-canvas" : "border border-line-2 text-ink"}`}>
            {d === days[0] ? "today" : d === yesterday ? "yesterday" : d.slice(5)}
          </Link>
        ))}
      </nav>
      <section className="mt-4 rounded-3xl border border-line bg-canvas p-5 shadow-card">
        <p className="eyebrow text-ink-3">{date}</p>
        {!audit && <p className="mt-2 text-ink-2">Not checked yet.</p>}
        {audit && (
          <>
            <h2 className={`display mt-1 text-xl ${audit.agree ? "text-mint-ink" : "text-gap"}`}>
              {audit.agree ? "PayPal and the ledger agree" : `${audit.differences.length} difference${audit.differences.length === 1 ? "" : "s"} to look at`}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              PayPal lists {audit.payments} payment{audit.payments === 1 ? "" : "s"} and {audit.refunds} refund{audit.refunds === 1 ? "" : "s"} for this day. Checked{" "}
              {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" }).format(new Date(audit.checkedAt))}.
            </p>
            <ul className="mt-3 space-y-2">
              {audit.differences.map((d) => (
                <li key={`${d.kind}-${d.id}`} className="rounded-2xl bg-gap-soft px-4 py-3 text-sm text-ink">
                  <span className="font-semibold">{d.what === "payment" ? "Payment" : "Refund"} {d.id}:</span> {d.note}.
                </li>
              ))}
            </ul>
          </>
        )}
        <AuditButton date={date} again={Boolean(audit)} />
      </section>
    </>
  );
}

export default function AuditPage({ searchParams }: PageProps<"/grower/audit">) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Next-morning audit</p>
          <h1 className="display text-2xl text-ink">Does PayPal agree?</h1>
        </div>
      </header>
      <p className="mt-4 text-ink-2">
        Strawbank keeps its own record of every payment and refund. Each morning it checks that record against PayPal&apos;s Transaction Search for the day before. PayPal can take up to three hours to list a payment.
      </p>
      <Suspense fallback={<p className="mt-6 text-ink-3">Opening…</p>}>
        <Day searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
