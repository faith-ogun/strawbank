// For the grower's API routes: the signed-in grower and their stand, or the
// response that refuses the request.

import { findStand } from "./demo-stand";
import { currentGrower } from "./session";

export async function growerStand() {
  const grower = await currentGrower();
  if (!grower) return { refused: Response.json({ error: "sign in first" }, { status: 401 }) };
  const found = grower.standId ? findStand(grower.standId) : undefined;
  if (!found) return { refused: Response.json({ error: "you have no stand yet" }, { status: 403 }) };
  return { grower, ...found };
}

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The uploaded photo, or why it was refused. */
export async function photoFrom(form: FormData | undefined): Promise<{ photo: Uint8Array; mediaType: string } | { refused: Response }> {
  const file = form?.get("photo");
  if (!(file instanceof File)) return { refused: Response.json({ error: "expected a photo" }, { status: 400 }) };
  if (!TYPES.includes(file.type) || file.size === 0 || file.size > MAX_BYTES) {
    return { refused: Response.json({ error: "the photo must be a JPEG, PNG or WebP under 8 MB" }, { status: 400 }) };
  }
  return { photo: new Uint8Array(await file.arrayBuffer()), mediaType: file.type };
}
