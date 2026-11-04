// The fingerprint behind the reuse check (src/lib/photo-reuse.ts), worked out
// on the server, where the customer cannot change it.

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { PhotoPrint } from "./photo-reuse";

/**
 * The photo's own SHA-256, and its difference hash: the photo shrunk to 9 x 8
 * greys, each compared with its right-hand neighbour, which survives re-saving,
 * resizing and a change of brightness.
 */
export async function photoPrint(photo: Uint8Array): Promise<PhotoPrint> {
  const sha256 = createHash("sha256").update(photo).digest("hex");
  const { data } = await sharp(photo).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let dhash = "";
  for (let nibble = 0; nibble < 16; nibble++) {
    let value = 0;
    for (let bit = 0; bit < 4; bit++) {
      const i = nibble * 4 + bit;
      const at = Math.floor(i / 8) * 9 + (i % 8);
      value = (value << 1) | (data[at] > data[at + 1] ? 1 : 0);
    }
    dhash += value.toString(16);
  }
  return { sha256, dhash };
}
