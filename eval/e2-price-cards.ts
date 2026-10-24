import { geminiNeeds, notBuiltYet, photoNeeds } from "./lib/needs";
import type { Eval } from "./lib/types";

// E2. Price card reading: items and prices read exactly, per card.
export const e2: Eval = {
  id: "E2",
  title: "Price card reading",
  target: "10 of 10 counting the grower's confirmation; at least 8 of 10 with no correction (proposed)",
  async run(ctx) {
    return notBuiltYet(this, [...photoNeeds(ctx.truth["price-cards"], "price card photos"), ...geminiNeeds()]);
  },
};
