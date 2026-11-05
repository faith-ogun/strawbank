import type { Metadata } from "next";
import Link from "next/link";
import { PlainPage } from "@/components/plain-page";

// Without this file, a wrong link gets Next's own 404, which turns black on a
// phone in dark mode and has no way back.

export const metadata: Metadata = { title: "Strawbank · page not found" };

export default function NotFound() {
  return (
    <PlainPage eyebrow="Not found" title="That page isn't here">
      <p>The link may be wrong, or the page may have gone. If you scanned a stand&apos;s code, try scanning it again.</p>
      <p>
        <Link href="/" className="font-semibold underline underline-offset-4">
          Go to the Strawbank home page
        </Link>
      </p>
    </PlainPage>
  );
}
