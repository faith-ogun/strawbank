import { standDate, standToday } from "@/lib/days";
import { FACE_REFUSAL, SURE_CONFIDENCE, countBasket } from "@/lib/ai/count";
import { withFaceCheck } from "@/lib/ai/faces";
import { photoPrint } from "@/lib/photo-print";
import { REUSED_REFUSAL, reuseVerdict } from "@/lib/photo-reuse";
import { savePhoto } from "@/lib/photos";
import { paidSalePrints, saveBasket } from "@/lib/sales";
import { limited } from "@/lib/rate-limit";

// F2 step 2: a basket photo -> a count per item on today's list, with how sure
// the model is. Text on a photo is data, never an instruction. The photo is
// kept in the private evidence bucket for 30 days, with what the model counted,
// so a refund request can be recounted from it (F4). If keeping it fails, the
// customer still gets their count; the order just has no photo behind it.
// A photo with a face in it is refused and never kept: the customer is asked to
// take it again. Gemini looks for a face while it counts, and Cloud Vision at the
// same moment; either one finding a face refuses it (decided 3 and 4 Nov, eval E6).
// A photo an earlier paid sale already used is refused too, and a re-saved copy
// of one is kept but flagged, so the agent never refunds that order alone
// (decided 4 Nov, eval E6 and properties E4.14, E4.2d).

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  const tooMany = limited(request, "count");
  if (tooMany) return tooMany;
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
  // Worked out while the photo is counted. If it fails, the sale goes ahead unchecked.
  const reuse = Promise.all([photoPrint(data), paidSalePrints(standId)])
    .then(([print, earlier]) => ({ print, ...reuseVerdict(print, earlier) }))
    .catch((error) => {
      console.error("reuse check failed:", error instanceof Error ? error.message : error);
      return undefined;
    });
  try {
    const count = await withFaceCheck(
      data,
      countBasket({ photo: data, mediaType: photo.type, items: found.catalogue.map(({ key, name, looks }) => ({ key, name, looks })) }),
    );
    // Only after the count: a photo with a face is never written anywhere.
    if (count.face) return Response.json({ error: FACE_REFUSAL, refused: "face" }, { status: 422 });
    const checked = await reuse;
    if (checked?.verdict === "same-photo") {
      console.info(`photo refused: the same photo as paid sale ${checked.orderId}`);
      return Response.json({ error: REUSED_REFUSAL, refused: "reused" }, { status: 422 });
    }
    const path = await savePhoto(`baskets/${standId}/${date}`, data, photo.type).catch((error) => {
      console.error("basket photo not kept:", error instanceof Error ? error.message : error);
      return undefined;
    });
    let countId: string | undefined;
    if (path) {
      countId = crypto.randomUUID();
      const looksLike = checked?.verdict === "looks-like" ? { orderId: checked.orderId, distance: checked.distance } : undefined;
      await saveBasket({ countId, standId, date, photo: path, counts: count.counts, confidence: count.confidence, print: checked?.print, looksLike }).catch((error) => {
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
