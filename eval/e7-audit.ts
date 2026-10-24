import { notBuiltYet, sandboxNeeds } from "./lib/needs";
import type { Eval } from "./lib/types";

// E7. Next-morning audit: after a sandbox day, remove one webhook-created
// capture from the ledger and make one refund in the sandbox dashboard. The
// audit must flag both and nothing else.
export const e7: Eval = {
  id: "E7",
  title: "Next-morning audit",
  target: "both planted differences flagged, nothing else",
  async run() {
    return notBuiltYet(this, [
      ...sandboxNeeds(),
      "a finished sandbox day with Transaction Search turned on (it can take up to 3 hours to show transactions)",
    ]);
  },
};
