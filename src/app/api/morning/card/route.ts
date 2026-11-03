import { readPriceCard } from "@/lib/ai/price-card";
import { growerStand, photoFrom } from "@/lib/grower-guard";
import { limited } from "@/lib/rate-limit";

// F1 step 1: the grower's price card photo -> the lines it shows. Nothing is
// priced until the grower confirms them (/api/morning/open).
export async function POST(request: Request) {
  const tooMany = limited(request, "growerPhoto");
  if (tooMany) return tooMany;
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const upload = await photoFrom(await request.formData().catch(() => undefined));
  if ("refused" in upload) return upload.refused;
  try {
    const reading = await readPriceCard({ ...upload, known: guard.catalogue.map(({ key, name }) => ({ key, name })) });
    return Response.json(reading);
  } catch (error) {
    console.error("price card failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return Response.json({ error: "the card could not be read; try again, or type the prices in" }, { status: 502 });
  }
}
