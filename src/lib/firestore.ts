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
