import { z } from "zod";
import { type StudioRequest, runStudioTurn } from "@/lib/ai/studio-turn";
import { growerStand } from "@/lib/grower-guard";
import { allow, limited } from "@/lib/rate-limit";

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

// Every judge shares the demo grower, so this cap is generous; the per-visitor limit does the rest.
const TURNS_PER_HOUR = 600;

export async function POST(request: Request) {
  const tooMany = limited(request, "studioTurn");
  if (tooMany) return tooMany;
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  if (!allow(`studio-grower:${guard.grower.growerId}`, TURNS_PER_HOUR, 60 * 60 * 1000)) {
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
