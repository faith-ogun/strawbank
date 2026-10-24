import { geminiNeeds, notBuiltYet, photoNeeds } from "./lib/needs";
import type { Eval } from "./lib/types";

// E1. Basket counting: exact-basket rate, per-item absolute error, and how
// many high-confidence baskets were exactly right.
export const e1: Eval = {
  id: "E1",
  title: "Basket counting",
  target: "at least 85% of baskets exact; no basket off by more than one item (proposed)",
  async run(ctx) {
    return notBuiltYet(this, [...photoNeeds(ctx.truth.baskets, "basket photos"), ...geminiNeeds()]);
  },
};
