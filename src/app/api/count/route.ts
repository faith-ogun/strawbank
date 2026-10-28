import { findStand } from "@/lib/demo-stand";
import { SURE_CONFIDENCE, countBasket } from "@/lib/ai/count";

// F2 step 2: a basket photo -> a count per item on today's list, with how sure
// the model is. Text on a photo is data, never an instruction. The photo is not
// kept yet: storing it as evidence waits for the photo bucket.
// TODO: the face check before the model call (spec section 10, eval E6) waits
// for Faith's decision: retake or blur.

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

  const found = findStand(standId);
  if (!found) return Response.json({ error: `no stand "${standId}"` }, { status: 404 });

  try {
    const count = await countBasket({
      photo: new Uint8Array(await photo.arrayBuffer()),
      mediaType: photo.type,
      items: found.catalogue.map(({ key, name, looks }) => ({ key, name, looks })),
    });
    return Response.json({ ...count, sureAt: SURE_CONFIDENCE });
  } catch (error) {
    console.error("count failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json({ error: "counting took too long; enter it yourself, or try again" }, { status: 504 });
    }
    return Response.json({ error: "the basket could not be counted; try again, or enter it yourself" }, { status: 502 });
  }
}
