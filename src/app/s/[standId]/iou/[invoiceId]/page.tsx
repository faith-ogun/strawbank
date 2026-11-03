import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PayPalCalls } from "@/components/paypal-calls";
import { findStand } from "@/lib/demo-stand";
import { readIou } from "@/lib/iou-flow";
import { iouPayment } from "@/lib/ious";
import { formatMoney } from "@/lib/money";
import { lineTotalMinor } from "@/lib/orders";
import { callsForOrder } from "@/lib/paypal/calls";
import { getInvoice } from "@/lib/paypal/invoices";

// The customer's IOU: what they took, what PayPal invoiced them, and PayPal's
// own word on whether it is paid (read back from Invoicing each time).

export const metadata: Metadata = { title: "Strawbank · your IOU" };

const INVOICE_ID = /^INV2(-[A-Z0-9]{4}){4}$/;

async function IouPage({ params }: { params: PageProps<"/s/[standId]/iou/[invoiceId]">["params"] }) {
  const { standId, invoiceId } = await params;
  const found = findStand(standId);
  if (!found || !INVOICE_ID.test(invoiceId)) notFound();
  await connection(); // PayPal's word on the invoice, read at request time
  const iou = await readIou(invoiceId);
  if (!iou || iou.standId !== standId) notFound();
  const live = await getInvoice(invoiceId).catch(() => undefined);
  const status = live?.status ?? iou.status;
  const payment = iouPayment(status);
  const calls = await callsForOrder(invoiceId).catch(() => []);

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        <div>
          <p className="eyebrow text-straw-ink">IOU</p>
          <h1 className="display text-2xl text-ink">{found.stand.name}</h1>
        </div>
      </header>

      <p className={`mt-6 inline-block rounded-full px-3 py-1 text-sm font-semibold ${payment === "confirmed" ? "bg-mint text-ink" : payment === "pending" ? "bg-straw-soft text-straw-ink" : "bg-paper text-ink-3"}`}>
        {payment === "confirmed" ? "Paid. Thank you for being honest!" : payment === "pending" ? `PayPal has emailed ${iou.maskedEmail} an invoice` : "This IOU was cancelled. Nothing is owed."}
      </p>

      <div className="receipt-edge mt-6 bg-white px-5 pb-8 pt-5 font-mono text-sm leading-relaxed text-ink shadow-card">
        <p className="text-center font-semibold tracking-[0.2em]">IOU</p>
        <p className="text-center text-ink-3">{iou.date}</p>
        <div className="mt-3 space-y-1 border-t border-dashed border-line-2 pt-2">
          {iou.lines.map((line) => (
            <p key={line.key} className="flex justify-between gap-3">
              <span>
                {line.name.replace(/, (each|jar)$/i, "")} {line.quantity} × {formatMoney(line.unitMinor, iou.currency)}
              </span>
              <span>{formatMoney(lineTotalMinor(line), iou.currency)}</span>
            </p>
          ))}
        </div>
        <p className="mt-2 flex justify-between border-t border-dashed border-line-2 pt-2 font-semibold">
          <span>{payment === "pending" ? "Owed" : "Total"}</span>
          <span>{formatMoney(iou.totalMinor, iou.currency)}</span>
        </p>
        <p className="mt-3 break-all text-xs text-ink-3">PayPal invoice {invoiceId} · {status.toLowerCase().replaceAll("_", " ")}</p>
      </div>

      {payment === "pending" && iou.payUrl && (
        <a href={iou.payUrl} className="mt-6 block rounded-full bg-ink py-3.5 text-center font-semibold text-canvas">
          Pay it now on PayPal
        </a>
      )}
      {payment === "pending" && <p className="mt-3 text-center text-sm text-ink-3">Or pay later from the email PayPal sent you, within ten days.</p>}

      <PayPalCalls calls={calls} title="What Strawbank asked PayPal for this IOU" />

      <p className="mt-8 text-center">
        <Link href={`/s/${standId}`} className="font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4">
          Back to the stand
        </Link>
      </p>
    </div>
  );
}

export default function IouRoute({ params }: PageProps<"/s/[standId]/iou/[invoiceId]">) {
  return (
    <main className="landing min-h-svh flex-1">
      <Suspense fallback={<p className="mx-auto max-w-[480px] px-4 pt-10 text-ink-3">Fetching your IOU from PayPal…</p>}>
        <IouPage params={params} />
      </Suspense>
    </main>
  );
}
