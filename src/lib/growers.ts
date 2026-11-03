// Growers who signed in with PayPal, kept in Firestore by their PayPal account
// id: their name, and their stand once they have one. No email is kept.

import { FieldValue } from "@google-cloud/firestore";
import { DEMO_STAND } from "./demo-stand";
import { firestore } from "./firestore";
import type { Grower } from "./session";

export const DEMO_GROWER: Grower = { growerId: "demo", name: "the demo grower", standId: DEMO_STAND.id };

/** Records a PayPal sign-in and returns the grower, with their stand if they have one. */
export async function growerFromPayPal(accountId: string, name: string): Promise<Grower> {
  const ref = firestore().collection("growers").doc(accountId);
  const stored = (await ref.get()).data() as { standId?: string } | undefined;
  await ref.set(
    { name, lastSignIn: FieldValue.serverTimestamp(), ...(!stored && { createdAt: FieldValue.serverTimestamp() }) },
    { merge: true },
  );
  return { growerId: accountId, name, standId: stored?.standId };
}
