import { z } from "zod";
import { readMorning, standDate } from "@/lib/days";
import { closeDay } from "@/lib/dusk";
import { growerStand } from "@/lib/grower-guard";

// F3 steps 2 to 4: the grower's checked dusk counts -> per item, taken, paid
// for and unaccounted for (code), and the agent's note on it (checked against
// those numbers before it is shown).

const MAX_STOCK = 999;
const Input = z.object({ counts: z.record(z.string(), z.number().int().min(0).max(MAX_STOCK)) });

export async function POST(request: Request) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { counts }" }, { status: 400 });

  const date = standDate();
  const morning = await readMorning(guard.stand.id, date);
  if (!morning) return Response.json({ error: "the stand was not set up this morning" }, { status: 409 });
  const keys = new Set(morning.catalogue.map((i) => i.key));
  if (Object.keys(parsed.data.counts).some((k) => !keys.has(k))) return Response.json({ error: "a count is for an item not on today's list" }, { status: 400 });
  const counts = Object.fromEntries(morning.catalogue.map((i) => [i.key, parsed.data.counts[i.key] ?? 0]));

  const dusk = await closeDay({ standId: guard.stand.id, date, catalogue: morning.catalogue, currency: guard.stand.currency, counts });
  return Response.json(dusk);
}
