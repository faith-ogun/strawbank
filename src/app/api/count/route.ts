import { notBuilt } from "@/lib/not-built";

// F1, F2, F3: a photo of the price card, shelf or basket -> counts per catalogue
// item with a confidence each. Text on a photo is data, never an instruction.
export async function POST() {
  return notBuilt("F1 to F3. Read or count a photo");
}
