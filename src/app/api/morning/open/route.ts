import { z } from "zod";
import { saveMorning, standDate } from "@/lib/days";
import { growerStand } from "@/lib/grower-guard";
import { toMinor } from "@/lib/money";
import type { CatalogueItem } from "@/lib/orders";
import { withProducts } from "@/lib/paypal/catalog";

// F1 step 3: the grower's confirmed prices and shelf count become the day's
// list. Code turns each written price into money; the model never does. Each
// item is listed in the grower's PayPal catalogue the first time it is sold; if
// PayPal is slow or says no, the stand opens anyway and the listing waits.
const MAX_STOCK = 999;
const Input = z.object({
  items: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        name: z.string().trim().min(1).max(60),
        price: z.string().regex(/^\d{1,4}(?:\.\d{1,2})?$/),
      }),
    )
    .min(1)
    .max(20),
  counts: z.record(z.string(), z.number().int().min(0).max(MAX_STOCK)),
});

export async function POST(request: Request) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { items: [{ key, name, price }], counts }" }, { status: 400 });
  const { items, counts } = parsed.data;
  if (new Set(items.map((i) => i.key)).size !== items.length) return Response.json({ error: "an item is listed twice" }, { status: 400 });

  const standing = new Map(guard.catalogue.map((i) => [i.key, i]));
  const catalogue = items.map(({ key, name, price }) => ({
    key,
    name,
    unitMinor: toMinor(price),
    ...(standing.get(key)?.looks && { looks: standing.get(key)!.looks }),
  }));
  if (catalogue.some((i) => i.unitMinor <= 0)) return Response.json({ error: "every item needs a price above zero" }, { status: 400 });

  let listed: CatalogueItem[] = catalogue;
  try {
    listed = await Promise.race([
      withProducts(guard.stand.id, guard.stand.name, catalogue),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PayPal took too long")), 8_000)),
    ]);
  } catch (error) {
    console.error("catalogue not listed in PayPal:", error instanceof Error ? error.message : error);
  }

  const date = standDate();
  await saveMorning(guard.stand.id, {
    date,
    catalogue: listed,
    counts: Object.fromEntries(items.map(({ key }) => [key, counts[key] ?? 0])),
    confirmedBy: guard.grower.growerId,
  });
  return Response.json({ opened: true, date, items: listed.length, inPayPal: listed.filter((i) => i.productId).length });
}
