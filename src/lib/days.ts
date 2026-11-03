// F1 step 3: the grower's confirmed list for the day and the morning count,
// kept in Firestore at stands/{standId}/days/{YYYY-MM-DD} (Irish date). The
// stand page, the count and the order all price from today's confirmed list;
// until the grower confirms one, the stand's standing list is used.

import { FieldValue } from "@google-cloud/firestore";
import { connection } from "next/server";
import { findStand } from "./demo-stand";
import { firestore } from "./firestore";
import type { CatalogueItem } from "./orders";
import type { Stand } from "./types";

export type Morning = {
  date: string;
  catalogue: CatalogueItem[];
  /** The shelf count the grower confirmed, per item key. */
  counts: Record<string, number>;
  confirmedBy: string;
};

/** Today's date at the stand, as YYYY-MM-DD. */
export function standDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayDoc = (standId: string, date: string) => firestore().collection("stands").doc(standId).collection("days").doc(date);

export async function readMorning(standId: string, date = standDate()): Promise<Morning | undefined> {
  const data = (await dayDoc(standId, date).get()).data();
  return data?.morning as Morning | undefined;
}

export async function saveMorning(standId: string, morning: Morning): Promise<void> {
  await dayDoc(standId, morning.date).set({ morning, morningAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** The stand and the list it sells from today: the grower's confirmed list, or its standing one. */
export async function standToday(standId: string): Promise<{ stand: Stand; catalogue: CatalogueItem[]; morning?: Morning } | undefined> {
  const found = findStand(standId);
  if (!found) return undefined;
  await connection(); // "today" reads the clock, so never at build time
  const morning = await readMorning(standId);
  return { stand: found.stand, catalogue: morning?.catalogue ?? found.catalogue, morning };
}
