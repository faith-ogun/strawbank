import { z } from "zod";
import { runAudit } from "@/lib/audit-run";
import { growerStand } from "@/lib/grower-guard";
import { PayPalError } from "@/lib/paypal/orders";

// F5: the next-morning audit for one day, on the grower's request: Strawbank's
// ledger against PayPal's Transaction Search (src/lib/audit.ts, eval E7).

const Input = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(request: Request) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { date: YYYY-MM-DD }" }, { status: 400 });
  try {
    return Response.json(await runAudit(guard.stand.id, parsed.data.date, guard.stand.currency));
  } catch (error) {
    if (error instanceof PayPalError) return Response.json({ error: error.message, debugId: error.debugId }, { status: 502 });
    throw error;
  }
}
