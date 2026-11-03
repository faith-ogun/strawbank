import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** A plain text page (privacy, terms) in the app's own look. */
export function PlainPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Strawbank home">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">{eyebrow}</p>
          <h1 className="display text-2xl text-ink">{title}</h1>
        </div>
      </header>
      <div className="mt-6 space-y-4 leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
