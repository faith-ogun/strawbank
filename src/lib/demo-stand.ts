// The one stand that exists until the data store does: its confirmed catalogue
// and refund limit. Prices live on the server, never in the customer's request.
// The same four items as the landing page and the 3D stand. Everything is sold
// one at a time; jam by the jar.

import type { Currency } from "./money";
import type { CatalogueItem } from "./orders";
import type { Stand } from "./types";

export const DEMO_STAND: Stand = {
  id: "demo",
  name: "Strawbank demo stand",
  grower: "demo",
  currency: "EUR" satisfies Currency,
  refundLimitMinor: 500,
  // A demo stand, set in County Monaghan like the story; not a real farm's address.
  place: { line1: "Strawbank demo stand", town: "Monaghan", country: "IE" },
};

export const DEMO_CATALOGUE: CatalogueItem[] = [
  { key: "egg", name: "Eggs, each", unitMinor: 60, looks: "one egg, loose or in an egg box or tray of any brand; a closed egg box hides the eggs inside" },
  { key: "onion", name: "Onions, each", unitMinor: 30, looks: "one onion, brown or red, loose or in a net or bag" },
  { key: "potato", name: "Potatoes, each", unitMinor: 20, looks: "one potato, loose or in a bag" },
  { key: "jam", name: "Jam, jar", unitMinor: 450, looks: "one jar with a cloth or metal lid, label turned away" },
];

/** Today's stand and catalogue, or undefined for a stand that does not exist. */
export function findStand(standId: string): { stand: Stand; catalogue: CatalogueItem[] } | undefined {
  return standId === DEMO_STAND.id ? { stand: DEMO_STAND, catalogue: DEMO_CATALOGUE } : undefined;
}
