import { z } from "zod";
import { FACE_REFUSAL, countShelf } from "@/lib/ai/count";
import { withFaceCheck } from "@/lib/ai/faces";
import { growerStand, photoFrom } from "@/lib/grower-guard";
import { limited } from "@/lib/rate-limit";

// F1 step 2: the stocked shelf -> a count per item on the list the grower just
// confirmed. The grower checks every count before the stand opens. The photo
// is not kept; one in which Gemini or Cloud Vision finds a face is refused all
// the same (eval E6).
const Items = z.array(z.object({ key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().min(1).max(60) })).min(1).max(20);

export async function POST(request: Request) {
  const tooMany = limited(request, "growerPhoto");
  if (tooMany) return tooMany;
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const form = await request.formData().catch(() => undefined);
  const items = Items.safeParse(JSON.parse(String(form?.get("items") ?? "null")));
  if (!items.success) return Response.json({ error: "expected the day's items" }, { status: 400 });
  const upload = await photoFrom(form);
  if ("refused" in upload) return upload.refused;
  const looks = new Map(guard.catalogue.map((i) => [i.key, i.looks]));
  try {
    const count = await withFaceCheck(upload.photo, countShelf({ ...upload, items: items.data.map((i) => ({ ...i, looks: looks.get(i.key) })) }));
    if (count.face) return Response.json({ error: FACE_REFUSAL, refused: "face" }, { status: 422 });
    return Response.json(count);
  } catch (error) {
    console.error("shelf count failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return Response.json({ error: "the shelf could not be counted; try again, or count it yourself" }, { status: 502 });
  }
}
