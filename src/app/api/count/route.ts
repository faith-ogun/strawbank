import { standDate, standToday } from "@/lib/days";
import { SURE_CONFIDENCE, countBasket } from "@/lib/ai/count";
import { savePhoto } from "@/lib/photos";
import { saveBasket } from "@/lib/sales";

// F2 step 2: a basket photo -> a count per item on today's list, with how sure
// the model is. Text on a photo is data, never an instruction. The photo is
// kept in the private evidence bucket for 30 days, with what the model counted,
// so a refund request can be recounted from it (F4). If keeping it fails, the
// customer still gets their count; the order just has no photo behind it.
// TODO: the face check before the model call (spec section 10, eval E6): refuse
// and ask for a retake (decided 3 Nov).

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  const form = await request.formData().catch(() => undefined);
  const standId = form?.get("standId");
  const photo = form?.get("photo");
  if (typeof standId !== "string" || !(photo instanceof File)) {
    return Response.json({ error: "expected a standId and a photo" }, { status: 400 });
  }
  if (!TYPES.includes(photo.type) || photo.size === 0 || photo.size > MAX_BYTES) {
    return Response.json({ error: "the photo must be a JPEG, PNG or WebP under 8 MB" }, { status: 400 });
  }

  const found = await standToday(standId);
  if (!found) return Response.json({ error: `no stand "${standId}"` }, { status: 404 });

  const data = new Uint8Array(await photo.arrayBuffer());
  const date = standDate();
  const kept = savePhoto(`baskets/${standId}/${date}`, data, photo.type).catch((error) => {
    console.error("basket photo not kept:", error instanceof Error ? error.message : error);
    return undefined;
  });
  try {
    const count = await countBasket({
      photo: data,
      mediaType: photo.type,
      items: found.catalogue.map(({ key, name, looks }) => ({ key, name, looks })),
    });
    const path = await kept;
    let countId: string | undefined;
    if (path) {
      countId = crypto.randomUUID();
      await saveBasket({ countId, standId, date, photo: path, counts: count.counts, confidence: count.confidence }).catch((error) => {
        console.error("basket record not kept:", error instanceof Error ? error.message : error);
        countId = undefined;
      });
    }
    return Response.json({ ...count, sureAt: SURE_CONFIDENCE, countId });
  } catch (error) {
    console.error("count failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json({ error: "counting took too long; enter it yourself, or try again" }, { status: 504 });
    }
    return Response.json({ error: "the basket could not be counted; try again, or enter it yourself" }, { status: 502 });
  }
}
