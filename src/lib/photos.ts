// Photos kept as evidence in the private bucket gs://honesty-box-2026-photos
// (europe-west1). The bucket deletes every object 30 days after upload; a photo
// behind an open refund request gets a temporary hold, which that rule
// respects. Nothing here is public: only the server reads photos back.

import { Storage } from "@google-cloud/storage";

let storage: Storage | undefined;

function bucket() {
  storage ??= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GOOGLE_VERTEX_PROJECT });
  return storage.bucket(process.env.PHOTO_BUCKET ?? "honesty-box-2026-photos");
}

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Stores a photo under `folder` and returns its path in the bucket. */
export async function savePhoto(folder: string, data: Uint8Array, contentType: string): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
  await bucket().file(path).save(Buffer.from(data), { contentType, resumable: false });
  return path;
}

export async function readPhoto(path: string): Promise<{ data: Uint8Array; contentType: string }> {
  const file = bucket().file(path);
  const [[data], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return { data: new Uint8Array(data), contentType: metadata.contentType ?? "image/jpeg" };
}

/** A held photo outlives the 30-day rule until the hold is released. */
export async function holdPhoto(path: string, hold: boolean): Promise<void> {
  await bucket().file(path).setMetadata({ temporaryHold: hold });
}
