// The ledger, kept in Firestore. Each verified webhook is applied in one
// transaction: if its event id is already stored, nothing changes; otherwise
// the captures and refunds it touches are read, merged by the same Ledger the
// evals test (E4.4), and written back with the event id. The capture reply our
// server gets at checkout is merged the same way (`record`), so a late webhook
// never hides a payment PayPal has already confirmed; a capture the signed
// webhook has also confirmed is marked `confirmedByWebhook`. Only what the
// ledger needs is stored: no payer names or emails.

import { FieldValue, type Firestore } from "@google-cloud/firestore";
import { firestore } from "./firestore";
import { factsFromWebhook, Ledger, type LedgerCapture, type LedgerFact, type LedgerRefund, type WebhookEvent } from "./ledger";

const EVENTS = "ledgerEvents";
const CAPTURES = "ledgerCaptures";
const REFUNDS = "ledgerRefunds";

const docFor = (store: Firestore, fact: LedgerFact) =>
  fact.kind === "capture" ? store.collection(CAPTURES).doc(fact.captureId) : store.collection(REFUNDS).doc(fact.refundId);

export const firestoreLedger = {
  async apply(event: WebhookEvent): Promise<{ duplicate: boolean; changed: boolean }> {
    let facts: LedgerFact[] = [];
    let unusable: string | undefined;
    try {
      facts = factsFromWebhook(event);
    } catch (error) {
      // Kept, so PayPal does not resend it 25 times, but it adds nothing to the ledger.
      unusable = (error as Error).message;
    }

    const store = firestore();
    const eventRef = store.collection(EVENTS).doc(event.id);
    const factRefs = facts.map((fact) => docFor(store, fact));

    return store.runTransaction(async (tx) => {
      const [eventSnap, ...factSnaps] = await tx.getAll(eventRef, ...factRefs);
      if (eventSnap.exists) return { duplicate: true, changed: false };

      const ledger = new Ledger();
      facts.forEach((fact, i) => {
        const stored = factSnaps[i].data();
        if (!stored) return;
        if (fact.kind === "capture") ledger.captures.set(fact.captureId, stored as LedgerCapture);
        else ledger.refunds.set(fact.refundId, stored as LedgerRefund);
      });
      let changed = false;
      for (const fact of facts) changed = ledger.record(fact) || changed;

      facts.forEach((fact, i) => {
        const merged = fact.kind === "capture" ? ledger.captures.get(fact.captureId) : ledger.refunds.get(fact.refundId);
        tx.set(factRefs[i], { ...merged, confirmedByWebhook: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      tx.create(eventRef, {
        eventType: event.event_type,
        resourceId: typeof event.resource.id === "string" ? event.resource.id : null,
        receivedAt: FieldValue.serverTimestamp(),
        unusable,
      });
      return { duplicate: false, changed };
    });
  },

  /** Merges one fact from our own PayPal call (the capture reply at checkout). */
  async record(fact: LedgerFact): Promise<boolean> {
    const store = firestore();
    const ref = docFor(store, fact);
    return store.runTransaction(async (tx) => {
      const stored = (await tx.get(ref)).data();
      const ledger = new Ledger();
      if (stored && fact.kind === "capture") ledger.captures.set(fact.captureId, stored as LedgerCapture);
      if (stored && fact.kind === "refund") ledger.refunds.set(fact.refundId, stored as LedgerRefund);
      const changed = ledger.record(fact);
      const merged = fact.kind === "capture" ? ledger.captures.get(fact.captureId) : ledger.refunds.get(fact.refundId);
      tx.set(ref, { ...merged, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return changed;
    });
  },
};
