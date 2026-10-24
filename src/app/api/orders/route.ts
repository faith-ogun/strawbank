import { notBuilt } from "@/lib/not-built";

// F2 step 4: confirmed counts x confirmed prices -> Orders v2 create, with each
// item as a line (createOrderBody in src/lib/orders.ts).
export async function POST() {
  return notBuilt("F2. Create order");
}
