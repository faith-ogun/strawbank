import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IouActions } from "@/components/grower/iou-actions";
import { findStand } from "@/lib/demo-stand";
import { iousForStand } from "@/lib/iou-flow";
import { iouPayment } from "@/lib/ious";
import { formatMoney } from "@/lib/money";
import { currentGrower } from "@/lib/session";

// The honesty-box IOUs: each one a PayPal invoice for a basket a customer
// took without PayPal to hand. Open ones first. PayPal's signed webhook marks
// them paid; the grower can remind, record cash, or cancel.

export const metadata: Metadata = { title: "Strawbank · IOUs" };

const STATUS: Record<string, string> = {
  confirmed: "paid",
  pending: "open",
  unpaid: "cancelled",
};

async function List() {
  const grower = await currentGrower();
  const found = grower?.standId ? findStand(grower.standId) : undefined;
  if (!found) redirect("/grower");
  const ious = await iousForStand(found.stand.id);
  const open = ious.filter((i) => iouPayment(i.status) === "pending");
  const settled = ious.filter((i) => iouPayment(i.status) !== "pending");
  const owed = open.reduce((sum, i) => sum + i.totalMinor, 0);
  return (
    <>
      <p className="mt-4 text-ink-2">
        {open.length === 0 ? "No open IOUs." : `${open.length} open, ${formatMoney(owed, found.stand.currency)} owed in all.`} The dusk report counts an open IOU as a payment on its way, never as walked.
      </p>
      {[...open, ...settled].map((iou) => {
        const payment = iouPayment(iou.status);
        return (
          <section key={iou.invoiceId} className="mt-4 rounded-3xl border border-line bg-canvas p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
              <p className="display text-xl text-ink">{formatMoney(iou.totalMinor, iou.currency)}</p>
              <p className={`text-sm font-semibold ${payment === "confirmed" ? "text-mint-ink" : payment === "pending" ? "text-straw-ink" : "text-ink-4"}`}>
                {STATUS[payment]}
                {iou.paidBy === "cash" ? ", in cash" : iou.paidBy === "paypal" ? " through PayPal" : ""}
              </p>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              {iou.lines.map((l) => `${l.quantity} ${l.name.replace(/, (each|jar)$/i, "").toLowerCase()}`).join(", ")} · {iou.date} · {iou.maskedEmail}
            </p>
            <p className="mt-1 break-all font-mono text-[0.6875rem] text-ink-3">PayPal invoice {iou.invoiceId}</p>
            {payment === "pending" && <IouActions invoiceId={iou.invoiceId} amount={formatMoney(iou.totalMinor, iou.currency)} />}
          </section>
        );
      })}
    </>
  );
}

export default function IousPage() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Grower</p>
          <h1 className="display text-2xl text-ink">IOUs</h1>
        </div>
      </header>
      <Suspense fallback={<p className="mt-6 text-ink-3">Reading the IOUs…</p>}>
        <List />
      </Suspense>
    </div>
  );
}
