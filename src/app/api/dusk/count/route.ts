import { FACE_REFUSAL, countShelf } from "@/lib/ai/count";
import { withFaceCheck } from "@/lib/ai/faces";
import { readMorning, saveDuskReading, standDate } from "@/lib/days";
import { growerStand, photoFrom } from "@/lib/grower-guard";
import { savePhoto } from "@/lib/photos";
import { limited } from "@/lib/rate-limit";

// F3 step 1: the shelf at dusk -> what is left of each item on today's list.
// The reading is kept with its photo, so closing the day can tell which counts
// the grower checked and which are the AI's alone. A photo in which Gemini or
// Cloud Vision finds a face is refused and never kept (eval E6).

export async function POST(request: Request) {
  const tooMany = limited(request, "growerPhoto");
  if (tooMany) return tooMany;
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const date = standDate();
  const morning = await readMorning(guard.stand.id, date);
  if (!morning) return Response.json({ error: "the stand was not set up this morning" }, { status: 409 });
  const form = await request.formData().catch(() => undefined);
  const upload = await photoFrom(form);
  if ("refused" in upload) return upload.refused;

  const looks = new Map(guard.catalogue.map((i) => [i.key, i.looks]));
  try {
    const count = await withFaceCheck(
      upload.photo,
      countShelf({ ...upload, items: morning.catalogue.map(({ key, name }) => ({ key, name, looks: looks.get(key) })) }),
    );
    if (count.face) return Response.json({ error: FACE_REFUSAL, refused: "face" }, { status: 422 });
    const kept = await savePhoto(`shelves/${guard.stand.id}/${date}`, upload.photo, upload.mediaType).catch(() => undefined);
    await saveDuskReading(guard.stand.id, date, { counts: count.counts, confidence: count.confidence, photo: kept });
    return Response.json(count);
  } catch (error) {
    console.error("dusk count failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return Response.json({ error: "the shelf could not be counted; try again, or count it yourself" }, { status: 502 });
  }
}
