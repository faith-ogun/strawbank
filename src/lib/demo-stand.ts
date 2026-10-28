// The one stand that exists until the data store does: its confirmed catalogue
// and refund limit. Prices live on the server, never in the customer's request.
// The same four items as the landing page and the 3D stand.

import type { Currency } from "./money";
import type { CatalogueItem } from "./orders";
import type { Stand } from "./types";

export const DEMO_STAND: Stand = {
  id: "demo",
  name: "Strawbank demo stand",
  grower: "demo",
  currency: "EUR" satisfies Currency,
  refundLimitMinor: 500,
};

export const DEMO_CATALOGUE: CatalogueItem[] = [
  { key: "eggs-6", name: "Eggs (6)", unitMinor: 350 },
  { key: "onions-bag", name: "Onions, bag", unitMinor: 200 },
  { key: "potatoes-bag", name: "Potatoes, bag", unitMinor: 300 },
  { key: "jam", name: "Jam", unitMinor: 450 },
];

/** Today's stand and catalogue, or undefined for a stand that does not exist. */
export function findStand(standId: string): { stand: Stand; catalogue: CatalogueItem[] } | undefined {
  return standId === DEMO_STAND.id ? { stand: DEMO_STAND, catalogue: DEMO_CATALOGUE } : undefined;
}
