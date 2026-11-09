// F1 step 3: the grower's confirmed list for the day and the morning count,
// kept in Firestore at stands/{standId}/days/{YYYY-MM-DD} (Irish date). The
// stand page, the count and the order all price from today's confirmed list;
// until the grower confirms one, the stand's standing list is used.

import { FieldValue } from "@google-cloud/firestore";
import { connection } from "next/server";
import { findStand } from "./demo-stand";
import { firestore } from "./firestore";
import type { AuditResult } from "./audit";
import type { CatalogueItem } from "./orders";
import type { ItemReconciliation } from "./reconcile";
import type { Stand } from "./types";

export type Morning = {
  date: string;
  catalogue: CatalogueItem[];
  /** The shelf count the grower confirmed, per item key. */
  counts: Record<string, number>;
  confirmedBy: string;
  /**
   * When the stand opened (ISO time; since 9 Nov). Setting the stand up again
   * starts a new day from a new count, so the dusk report counts only the sales
   * and IOUs made after this.
   */
  openedAt?: string;
};

/** What the AI counted on the dusk shelf photo, before the grower checked it. */
export type DuskReading = { counts: Record<string, number>; confidence: Record<string, number>; photo?: string };

export type PaymentSummary = {
  orderId: string;
  captureId?: string;
  totalMinor: number;
  payment: "confirmed" | "pending" | "unpaid";
  /**
   * Who said so: PayPal's signed webhook as well as its capture reply, the
   * capture reply alone, a PayPal invoice (an IOU), or cash the grower
   * recorded against an IOU in PayPal.
   */
  source: "webhook" | "capture" | "invoice" | "cash" | "none";
  refundedMinor: number;
};

export type Dusk = {
  date: string;
  counts: Record<string, number>;
  confidence: Record<string, number>;
  items: ItemReconciliation[];
  explanation: { text: string; source: "model" | "template" };
  payments: PaymentSummary[];
  /** Confirmed takings net of completed refunds, in minor units. */
  takingsMinor: number;
};

export type Audit = AuditResult & { checkedAt: string };

export type DayRecord = { morning?: Morning; duskReading?: DuskReading; dusk?: Dusk; audit?: Audit; restocks?: Record<string, number>[] };

/** Today's date at the stand, as YYYY-MM-DD. */
export function standDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The stand's last `n` dates, today first. */
export function recentStandDates(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => standDate(new Date(now - i * 24 * 60 * 60 * 1000)));
}

const dayDoc = (standId: string, date: string) => firestore().collection("stands").doc(standId).collection("days").doc(date);

export async function readMorning(standId: string, date = standDate()): Promise<Morning | undefined> {
  const data = (await dayDoc(standId, date).get()).data();
  return data?.morning as Morning | undefined;
}

export async function readDay(standId: string, date = standDate()): Promise<DayRecord> {
  return ((await dayDoc(standId, date).get()).data() ?? {}) as DayRecord;
}

export async function saveDuskReading(standId: string, date: string, reading: DuskReading): Promise<void> {
  await dayDoc(standId, date).set({ duskReading: reading }, { merge: true });
}

export async function saveDusk(standId: string, dusk: Dusk): Promise<void> {
  await dayDoc(standId, dusk.date).set({ dusk, duskAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function saveAudit(standId: string, date: string, audit: Audit): Promise<void> {
  await dayDoc(standId, date).set({ audit }, { merge: true });
}

/** Opens the stand: a new count and list, and a fresh day (any earlier dusk count and restocks today are cleared). */
export async function saveMorning(standId: string, morning: Morning): Promise<void> {
  await dayDoc(standId, morning.date).set(
    {
      morning: { ...morning, openedAt: morning.openedAt ?? new Date().toISOString() },
      morningAt: FieldValue.serverTimestamp(),
      dusk: FieldValue.delete(),
      duskReading: FieldValue.delete(),
      duskAt: FieldValue.delete(),
      restocks: FieldValue.delete(),
    },
    { merge: true },
  );
}

/** Where the grower's day stands: not set up, open, or closed at dusk. */
export function dayState(day: DayRecord): "not-set-up" | "open" | "closed" {
  return !day.morning ? "not-set-up" : day.dusk ? "closed" : "open";
}

/** True if a sale or IOU made at `createdAt` belongs to the day the stand opened at `openedAt`. */
export function inThisOpening(createdAt: string | undefined, openedAt: string | undefined): boolean {
  if (!openedAt || !createdAt) return true;
  return createdAt >= openedAt;
}

/** The stand and the list it sells from today: the grower's confirmed list, or its standing one. */
export async function standToday(standId: string): Promise<{ stand: Stand; catalogue: CatalogueItem[]; morning?: Morning } | undefined> {
  const found = findStand(standId);
  if (!found) return undefined;
  await connection(); // "today" reads the clock, so never at build time
  const morning = await readMorning(standId);
  return { stand: found.stand, catalogue: morning?.catalogue ?? found.catalogue, morning };
}
