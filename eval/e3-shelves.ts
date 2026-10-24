import { geminiNeeds, notBuiltYet, photoNeeds } from "./lib/needs";
import type { Eval } from "./lib/types";

// E3. Shelf counting: per-item absolute error, morning and dusk. When the
// model is unsure, the dusk report must say "uncertain", never "missing".
export const e3: Eval = {
  id: "E3",
  title: "Shelf counting",
  target: "absolute error 0 on at least 90% of item counts (proposed)",
  async run(ctx) {
    return notBuiltYet(this, [...photoNeeds(ctx.truth.shelves, "shelf photos (10 days, morning and dusk)"), ...geminiNeeds()]);
  },
};
