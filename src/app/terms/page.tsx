import type { Metadata } from "next";
import { PlainPage } from "@/components/plain-page";

// Linked from the PayPal app's "Log in with PayPal" settings as the user agreement.

export const metadata: Metadata = { title: "Strawbank · terms" };

export default function Terms() {
  return (
    <PlainPage eyebrow="Terms" title="Using Strawbank">
      <ul>
        <li>Strawbank is a prototype for the PayPal AI Hackathon. It is free to try and comes with no guarantee.</li>
        <li>
          It uses PayPal&apos;s sandbox only. Payments and refunds are test transactions; nothing you buy here is real
          and no real money moves.
        </li>
        <li>Photograph goods, shelves and price cards only. Do not photograph people.</li>
        <li>
          The AI counts and explains. Every price, total and refund is worked out by plain code from prices the grower
          confirmed, and the customer always has the final word on the count.
        </li>
        <li>The code is open source under the MIT licence.</li>
      </ul>
    </PlainPage>
  );
}
