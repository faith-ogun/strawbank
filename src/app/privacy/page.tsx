import type { Metadata } from "next";
import { PlainPage } from "@/components/plain-page";

// Linked from the PayPal app's "Log in with PayPal" settings. It says only what
// the app does today; change it when the app changes.

export const metadata: Metadata = { title: "Strawbank · privacy" };

export default function Privacy() {
  return (
    <PlainPage eyebrow="Privacy" title="What Strawbank keeps">
      <p>
        Strawbank is a prototype built for the PayPal AI Hackathon. It runs on PayPal&apos;s sandbox, so no real money
        moves and no real PayPal account is charged.
      </p>
      <h2>Customers</h2>
      <ul>
        <li>You do not sign up. You photograph your basket, check the count and pay with PayPal.</li>
        <li>
          Your basket photo goes to Google Cloud. Gemini counts what is in it, and Gemini and Cloud Vision each check it
          for a face. A photo with a person in it is refused and not kept. Nothing tries to identify anyone. Point the
          camera at the basket, not at people.
        </li>
        <li>
          Any other basket photo is kept in a private store for 30 days, in case you ask for a refund or dispute the
          payment, and is then deleted automatically. A photo behind an open refund request is held until that is
          settled. The agent recounts it if you ask for a refund, the grower can see it, and if the grower answers a
          PayPal dispute, it goes to PayPal as evidence.
        </li>
        <li>
          A short fingerprint of the photo stays with the sale, to spot a photo used twice. It cannot be turned back into
          the photo.
        </li>
        <li>
          PayPal handles the payment. Strawbank never sees your card or bank details. It keeps PayPal&apos;s order,
          payment and refund numbers and their amounts, not your name or email.
        </li>
        <li>
          If you leave an IOU, PayPal holds the address you give and sends the invoice to it. Strawbank keeps only a
          shortened form, such as a…@example.com, so the grower can recognise it.
        </li>
      </ul>
      <h2>Growers</h2>
      <ul>
        <li>
          Growers sign in with Log in with PayPal, which shares their name and email with Strawbank. Strawbank keeps the
          name and the PayPal account ID, so it knows whose stand is whose, and does not keep the email.
        </li>
        <li>
          Price-card photos are read by Gemini and not kept. Shelf photos are counted by Gemini and checked for a face in
          the same way as a basket. The morning shelf photo is not kept; the dusk shelf photo is kept for 30 days.
        </li>
      </ul>
      <h2>Where it lives</h2>
      <p>
        The app, its records and the kept photos are on Google Cloud in Belgium (europe-west1). Gemini and Cloud Vision
        are called through Google&apos;s global addresses, so a photo being counted or checked may be processed outside
        the EU. Cloud Vision processes it in memory and does not store it.
      </p>
    </PlainPage>
  );
}
