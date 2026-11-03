import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DisputeActions } from "@/components/grower/dispute-actions";
import { findStand } from "@/lib/demo-stand";
import { evidenceNotes } from "@/lib/dispute-evidence";
import { disputesForStand } from "@/lib/dispute-flow";
import { formatMoney, toMinor } from "@/lib/money";
import { canDo } from "@/lib/paypal/disputes";
import { currentGrower } from "@/lib/session";

// Disputes customers have opened with PayPal on payments made at this stand,
// each with the evidence the stand already holds: the basket photo taken at
// the stand, the count the customer confirmed, and what PayPal itself recorded.
// The words PayPal's reviewer reads are written by code (eval E4.13).

export const metadata: Metadata = { title: "Strawbank · disputes" };

const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "says they did not get the goods",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "says the goods were not as described",
  UNAUTHORISED: "says they did not make this payment",
  INCORRECT_AMOUNT: "says they were charged the wrong amount",
  DUPLICATE_TRANSACTION: "says they were charged twice",
  CREDIT_NOT_PROCESSED: "says a refund was not made",
  PAYMENT_BY_OTHER_MEANS: "says they paid another way",
};

const plain = (s?: string) => (s ?? "").toLowerCase().replaceAll("_", " ");

async function List() {
  const grower = await currentGrower();
  const found = grower?.standId ? findStand(grower.standId) : undefined;
  if (!found) redirect("/grower");
  const disputes = await disputesForStand(found.stand.id);
  if (disputes.length === 0) {
    return (
      <p className="mt-6 leading-relaxed text-ink-2">
        No customer has disputed a payment at your stand. If one does, it shows here with the evidence your stand already holds, ready to send to PayPal in one tap.
      </p>
    );
  }
  return (
    <>
      {disputes.map(({ dispute, pack, countId, evidenceSentAt }) => {
        const amount = dispute.dispute_amount ? formatMoney(toMinor(dispute.dispute_amount.value), pack.currency) : formatMoney(pack.capturedMinor, pack.currency);
        return (
          <section key={dispute.dispute_id} className="mt-4 rounded-3xl border border-line bg-canvas p-5 shadow-card">
            <p className="eyebrow text-ink-3">
              {dispute.dispute_id} · {plain(dispute.status)}
            </p>
            <h2 className="display mt-1 text-xl text-ink">
              {amount}: the customer {REASONS[dispute.reason ?? ""] ?? plain(dispute.reason)}
            </h2>
            {dispute.seller_response_due_date && (
              <p className="mt-1 text-sm text-straw-ink">
                PayPal wants an answer by{" "}
                {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date(dispute.seller_response_due_date))}.
              </p>
            )}
            <div className="mt-3 flex gap-3">
              {countId && pack.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- a private photo served to this grower only
                <img src={`/api/photos/basket/${countId}`} alt="The customer's basket at the stand" className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover" />
              )}
              <p className="text-sm leading-relaxed text-ink-2">{evidenceNotes(pack)}</p>
            </div>
            {evidenceSentAt ? (
              <p className="mt-3 text-sm text-mint-ink">Evidence sent to PayPal on {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" }).format(new Date(evidenceSentAt))}.</p>
            ) : (
              <DisputeActions disputeId={dispute.dispute_id} canSend={canDo(dispute, "provide_evidence")} canRefund={canDo(dispute, "accept_claim")} amount={amount} />
            )}
          </section>
        );
      })}
    </>
  );
}

export default function DisputesPage() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Grower</p>
          <h1 className="display text-2xl text-ink">Disputes</h1>
        </div>
      </header>
      <Suspense fallback={<p className="mt-6 text-ink-3">Asking PayPal…</p>}>
        <List />
      </Suspense>
    </div>
  );
}
