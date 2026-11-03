// One Firestore client per server process, in the app's own Google Cloud
// project (found automatically on Cloud Run).

import { Firestore } from "@google-cloud/firestore";

let db: Firestore | undefined;

export function firestore(): Firestore {
  db ??= new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GOOGLE_VERTEX_PROJECT,
    ignoreUndefinedProperties: true,
  });
  return db;
}

/** Firestore's limit on an "in" query. */
const IN_LIMIT = 30;

/** Every document in `collection` whose `field` is one of `values`, however many there are. */
export async function whereIn<T>(collection: string, field: string, values: string[]): Promise<T[]> {
  const store = firestore();
  const parts: string[][] = [];
  for (let i = 0; i < values.length; i += IN_LIMIT) parts.push(values.slice(i, i + IN_LIMIT));
  const results = await Promise.all(parts.map((part) => store.collection(collection).where(field, "in", part).get()));
  return results.flatMap((snap) => snap.docs.map((d) => d.data() as T));
}
