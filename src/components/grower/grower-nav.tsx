"use client";

// The grower's way around, on every grower page (added 9 Nov: in the dry run
// there was no way back from a page but the browser's back button). On a phone,
// a bar along the bottom within thumb's reach: Today, Morning, Dusk, Refunds,
// and More for the rest. On a wider screen, every page in a bar along the top.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Page = { href: string; label: string; short?: string };

const MAIN: Page[] = [
  { href: "/grower", label: "Today" },
  { href: "/grower/morning", label: "Morning set-up", short: "Morning" },
  { href: "/grower/dusk", label: "Dusk report", short: "Dusk" },
  { href: "/grower/refunds", label: "Refunds" },
];

const MORE: Page[] = [
  { href: "/grower/ious", label: "IOUs" },
  { href: "/grower/disputes", label: "Disputes" },
  { href: "/grower/audit", label: "Next-morning audit", short: "Audit" },
  { href: "/grower/ledger", label: "Ledger" },
];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="ml-1 inline-grid min-w-5 place-items-center rounded-full bg-gap px-1.5 text-[0.6875rem] font-semibold leading-5 text-canvas">{n}</span>;
}

export function GrowerNav({ standId, refundsWaiting }: { standId: string; refundsWaiting: number }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const here = (href: string) => (href === "/grower" ? path === "/grower" : path.startsWith(href));
  const moreHere = MORE.some((p) => here(p.href));

  return (
    <>
      {/* Wider screens: every page along the top. */}
      <nav aria-label="Grower pages" className="sticky top-0 z-30 hidden border-b border-line bg-canvas/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 text-sm">
          <span className="mr-3 font-semibold text-ink">Strawbank · grower</span>
          {[...MAIN, ...MORE].map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={here(p.href) ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 font-medium ${here(p.href) ? "bg-ink text-canvas" : "text-ink-2 hover:bg-paper"}`}
            >
              {p.short ?? p.label}
              {p.href === "/grower/refunds" && <Badge n={refundsWaiting} />}
            </Link>
          ))}
          <Link href={`/s/${standId}`} className="ml-auto rounded-full border border-line-2 px-3 py-1.5 font-medium text-ink">
            The stand page
          </Link>
        </div>
      </nav>

      {/* Phones: the main pages along the bottom, the rest under More. */}
      <nav aria-label="Grower pages" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden">
        {more && (
          <div className="border-b border-line bg-canvas px-4 pb-3 pt-2">
            <ul className="grid grid-cols-2 gap-2">
              {[...MORE, { href: `/s/${standId}`, label: "The stand page" }].map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    onClick={() => setMore(false)}
                    aria-current={here(p.href) ? "page" : undefined}
                    className={`block rounded-2xl px-3 py-3 text-center text-sm font-semibold ${here(p.href) ? "bg-ink text-canvas" : "bg-paper text-ink"}`}
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="grid grid-cols-5">
          {MAIN.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                onClick={() => setMore(false)}
                aria-current={here(p.href) ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center text-xs font-semibold ${here(p.href) ? "text-ink" : "text-ink-3"}`}
              >
                <span className={`mb-1 h-1 w-6 rounded-full ${here(p.href) ? "bg-straw" : "bg-transparent"}`} />
                <span>
                  {p.short ?? p.label}
                  {p.href === "/grower/refunds" && <Badge n={refundsWaiting} />}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((m) => !m)}
              className={`flex h-14 w-full flex-col items-center justify-center text-xs font-semibold ${more || moreHere ? "text-ink" : "text-ink-3"}`}
            >
              <span className={`mb-1 h-1 w-6 rounded-full ${moreHere ? "bg-straw" : "bg-transparent"}`} />
              <span>{more ? "Close" : "More"}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
