import { z } from "zod";
import { type StudioRequest, runStudioTurn } from "@/lib/ai/studio-turn";
import { growerStand } from "@/lib/grower-guard";

// F6: one turn of the ledger's AG Studio agents, on Gemini (src/lib/ai/studio-turn.ts).
// Signed-in growers only, with a cap on turns per grower so the public demo
// cannot run up the Vertex bill (the project has a EUR 20 monthly budget alert).

const Input = z.object({
  request: z.object({
    input: z.array(z.object({ type: z.string() }).passthrough()).max(400),
    instructions: z.string().max(60_000).optional(),
    tools: z.array(z.object({ name: z.string(), description: z.string().optional(), parameters: z.unknown(), kind: z.string().optional() }).passthrough()).max(40).optional(),
    toolChoice: z.union([z.enum(["auto", "none", "required"]), z.object({ name: z.string() })]).optional(),
    responseFormat: z.object({ type: z.enum(["text", "json"]) }).passthrough().optional(),
  }),
  signatures: z.record(z.string(), z.string()).default({}),
});

const TURNS_PER_HOUR = 150;
const turns = new Map<string, number[]>();

function allowTurn(growerId: string, now = Date.now()): boolean {
  const recent = (turns.get(growerId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= TURNS_PER_HOUR) return false;
  recent.push(now);
  turns.set(growerId, recent);
  return true;
}

export async function POST(request: Request) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  if (!allowTurn(guard.grower.growerId)) {
    return Response.json({ error: "the ledger's assistant has answered a lot this hour; try again later" }, { status: 429 });
  }
  const parsed = Input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: "expected { request, signatures }" }, { status: 400 });
  try {
    return Response.json(await runStudioTurn(parsed.data.request as StudioRequest, parsed.data.signatures, request.signal));
  } catch (error) {
    console.error("studio turn failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return Response.json({ error: "Gemini did not answer this turn" }, { status: 502 });
  }
}
