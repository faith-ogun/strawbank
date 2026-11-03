import fc from "fast-check";
import { type EvidencePack, NOTES_MAX, evidenceNotes, evidenceType } from "../../src/lib/dispute-evidence";
import { formatMoney } from "../../src/lib/money";
import { MAX_QUANTITY, buildLines, orderTotalMinor } from "../../src/lib/orders";
import { assert, catalogueArb, currencyArb, moneyProperty } from "./shared";

// What the grower sends PayPal in a dispute is the stand's own record, in
// code's words: the amount PayPal captured, each line exactly as charged, any
// refund already made, and never an evidence type that claims a tracking
// number or refund id the stand does not have.

const packCase = catalogueArb.chain((catalogue) =>
  fc.record({
    catalogue: fc.constant(catalogue),
    quantities: fc.tuple(...catalogue.map(() => fc.integer({ min: 0, max: MAX_QUANTITY }))),
    currency: currencyArb,
    refundShare: fc.double({ min: 0, max: 1, noNaN: true }),
    photo: fc.boolean(),
    webhook: fc.boolean(),
    pickup: fc.boolean(),
  }),
);

const notesStateTheRecord = fc.property(packCase, ({ catalogue, quantities, currency, refundShare, photo, webhook, pickup }) => {
  const counts = Object.fromEntries(catalogue.map((item, i) => [item.key, quantities[i]]));
  fc.pre(Object.values(counts).some((q) => q > 0));
  const lines = buildLines(catalogue, counts);
  const capturedMinor = orderTotalMinor(lines);
  const pack: EvidencePack = {
    disputeId: "PP-D-1",
    standName: "Test stand",
    orderId: "ORDER1",
    captureId: "CAPTURE1",
    capturedAt: "2026-11-03T12:00:00Z",
    date: "2026-11-03",
    lines,
    capturedMinor,
    currency,
    confirmedByWebhook: webhook,
    collectedAtStand: pickup,
    photo: photo ? { taken: "2026-11-03T11:58:00Z" } : undefined,
    refundedMinor: Math.floor(capturedMinor * refundShare),
  };
  const notes = evidenceNotes(pack);
  assert(notes.length <= NOTES_MAX, "notes longer than PayPal takes");
  assert(notes.includes(`PayPal captured ${formatMoney(capturedMinor, currency)}.`), "the captured amount is missing or wrong");
  for (const line of lines) {
    const text = `${line.quantity} x ${line.name.replace(/, (each|jar)$/i, "")} at ${formatMoney(line.unitMinor, currency)}`;
    assert(notes.includes(text), `a line is missing or changed: ${text}`);
  }
  assert(
    pack.refundedMinor > 0 ? notes.includes(`refunded through PayPal for this payment: ${formatMoney(pack.refundedMinor, currency)}`) : !/refunded through PayPal/.test(notes),
    "the refund already made is missing, wrong or invented",
  );
  assert(notes.includes("collected at the stand") === pickup, "the pickup is claimed when PayPal was not told, or left out");
  assert(notes.includes("Attached: the photo") === photo, "a photo is claimed that is not there, or left out");
  assert(notes.includes("signed webhook") === webhook, "a webhook confirmation is claimed that did not happen, or left out");
});

const TYPES = ["PROOF_OF_FULFILLMENT", "PROOF_OF_REFUND", "PROOF_OF_RETURN", "PROOF_OF_INSTORE_RECEIPT", "DETAILS_OF_PURCHASE", "RECEIPT_OF_MERCHANDISE", "ITEM_DESCRIPTION", "OTHER"];

const neverClaimsTracking = fc.property(fc.subarray(TYPES), (requested) => {
  const type = evidenceType(requested);
  assert(!["PROOF_OF_FULFILLMENT", "PROOF_OF_REFUND", "PROOF_OF_RETURN"].includes(type), `would send ${type}, which needs a tracking number or refund id`);
});

export const p11 = [
  moneyProperty("E4.13", "Dispute evidence states the stand's own record exactly: the amount captured, each line, any refund, and only what really happened", notesStateTheRecord),
  moneyProperty("E4.13b", "Dispute evidence never claims a type that needs a tracking number or refund id", neverClaimsTracking),
];
