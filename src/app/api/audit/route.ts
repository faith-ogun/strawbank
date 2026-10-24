import { notBuilt } from "@/lib/not-built";

// F5: next morning, compare our ledger with Transaction Search for the day and
// flag every difference. Runs when the grower opens the morning page, so no
// scheduler is needed.
export async function POST() {
  return notBuilt("F5. Next-morning audit");
}
