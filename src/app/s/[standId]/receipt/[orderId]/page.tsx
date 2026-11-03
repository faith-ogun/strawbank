import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findStand } from "@/lib/demo-stand";
import { formatMoney, fromPayPalAmount } from "@/lib/money";
import { lineTotalMinor } from "@/lib/orders";
import { PayPalError, getPayPalOrder } from "@/lib/paypal/orders";
import { requestMessage } from "@/lib/refund-flow";
import { requestsForOrder } from "@/lib/refund-store";
import { readSale } from "@/lib/sales";
import { RefundClaim } from "@/components/stand/refund-claim";

// F2 step 5: the receipt, read back from PayPal's own record of the order.
// Amounts are PayPal's, parsed into minor units; each line total is worked
// out by src/lib/orders.ts. Under it, "something's wrong" (F4) and what became
// of any claim.

export const metadata: Metadata = { title: "Strawbank · your receipt" };

const ORDER_ID = /^[A-Z0-9]{8,40}$/;

const time = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" }).format(new Date(iso)) : "";

async function Receipt({ params }: { params: PageProps<"/s/[standId]/receipt/[orderId]">["params"] }) {
  const { standId, orderId } = await params;
  const found = findStand(standId);
  if (!found || !ORDER_ID.test(orderId)) notFound();
  const { currency } = found.stand;

  let order;
  try {
    order = await getPayPalOrder(orderId);
  } catch (error) {
    if (error instanceof PayPalError && error.status === 404) notFound();
    throw error;
  }
  const unit = order.purchaseUnits?.[0];
  const minor = (m?: { currencyCode: string; value: string }) => (m ? fromPayPalAmount({ currency_code: m.currencyCode, value: m.value }, currency) : 0);
  const capture = unit?.payments?.captures?.[0];
  const refunds = unit?.payments?.refunds ?? [];
  const paid = order.status === "COMPLETED" && capture?.status !== "DECLINED";
  const [sale, claims] = await Promise.all([readSale(orderId).catch(() => undefined), requestsForOrder(orderId).catch(() => [])]);

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        <div>
          <p className="eyebrow text-straw-ink">Receipt</p>
          <h1 className="display text-2xl text-ink">{found.stand.name}</h1>
        </div>
      </header>

      <p className={`mt-6 inline-block rounded-full px-3 py-1 text-sm font-semibold ${paid ? "bg-mint text-ink" : "bg-straw-soft text-straw-ink"}`}>
        {paid ? "Paid with PayPal. Thank you!" : `Not paid yet (${order.status?.toLowerCase().replaceAll("_", " ")})`}
      </p>

      <div className="receipt-edge mt-6 bg-white px-5 pb-8 pt-5 font-mono text-sm leading-relaxed text-ink shadow-card">
        <p className="text-center font-semibold tracking-[0.2em]">STRAWBANK</p>
        <p className="text-center text-ink-3">{time(capture?.createTime ?? order.createTime)}</p>
        <div className="mt-3 space-y-1 border-t border-dashed border-line-2 pt-2">
          {(unit?.items ?? []).map((item) => {
            const unitMinor = minor(item.unitAmount);
            const quantity = Number(item.quantity);
            return (
              <p key={item.sku ?? item.name} className="flex justify-between gap-3">
                <span>
                  {item.name.replace(/, each$/i, "")} {quantity} × {formatMoney(unitMinor, currency)}
                </span>
                <span>{formatMoney(lineTotalMinor({ key: item.sku ?? item.name, name: item.name, quantity, unitMinor }), currency)}</span>
              </p>
            );
          })}
        </div>
        <p className="mt-2 flex justify-between border-t border-dashed border-line-2 pt-2 font-semibold">
          <span>Total</span>
          <span>{formatMoney(minor(unit?.amount), currency)}</span>
        </p>
        {refunds.map((refund) => (
          <p key={refund.id} className="flex justify-between text-mint-ink">
            <span>Refunded {time(refund.createTime)}</span>
            <span>−{formatMoney(minor(refund.amount), currency)}</span>
          </p>
        ))}
        <p className="mt-3 break-all text-xs text-ink-3">
          PayPal order {order.id}
          {capture?.id && <> · payment {capture.id}</>}
        </p>
      </div>

      {claims.map((claim) => (
        <p key={claim.requestId} className={`mt-4 rounded-2xl px-4 py-3 text-sm text-ink ${claim.status === "COMPLETED" ? "bg-mint-soft" : "bg-paper"}`}>
          {requestMessage(claim)}
        </p>
      ))}
      {paid && sale?.standId === standId && (
        <RefundClaim orderId={orderId} lines={sale.lines.map(({ key, name, quantity }) => ({ key, name, quantity }))} />
      )}

      <p className="mt-8 text-center">
        <Link href={`/s/${standId}`} className="font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4">
          Back to the stand
        </Link>
      </p>
    </div>
  );
}

export default function ReceiptPage({ params }: PageProps<"/s/[standId]/receipt/[orderId]">) {
  return (
    <main className="landing min-h-svh flex-1">
      <Suspense fallback={<p className="mx-auto max-w-[480px] px-4 pt-10 text-ink-3">Fetching your receipt from PayPal…</p>}>
        <Receipt params={params} />
      </Suspense>
    </main>
  );
}
