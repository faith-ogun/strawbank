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
          Your basket photo is sent to Google&apos;s Gemini model on Google Cloud to count what is in it. Strawbank does
          not store the photo. Point the camera at the basket, not at people.
        </li>
        <li>
          PayPal handles the payment. Strawbank never sees your card or bank details. It keeps PayPal&apos;s order,
          payment and refund numbers and their amounts, not your name or email.
        </li>
      </ul>
      <h2>Growers</h2>
      <ul>
        <li>
          Growers sign in with Log in with PayPal, which shares their name and email with Strawbank so it knows whose
          stand is whose.
        </li>
        <li>Shelf and price-card photos are counted by Gemini in the same way.</li>
      </ul>
      <h2>Where it lives</h2>
      <p>
        The app and its records run on Google Cloud in Belgium (europe-west1). Any photo kept for a refund check will be
        deleted automatically after 30 days.
      </p>
    </PlainPage>
  );
}
