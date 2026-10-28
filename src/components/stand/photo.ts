// A phone photo is often 4000 px and several megabytes. Shrink it on the phone,
// upright, before it is uploaded: 1280 px on the long side is plenty to count a
// basket (the model looks at less than that), and at about 250 KB it uploads
// quickly on a weak signal by a country lane.

const MAX_SIDE = 1280;
const QUALITY = 0.8;

export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // A format this browser cannot draw (some HEIC photos): send it as it is.
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("the photo could not be read"))), "image/jpeg", QUALITY),
  );
}
