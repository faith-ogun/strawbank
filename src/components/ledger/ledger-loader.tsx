"use client";

import dynamic from "next/dynamic";

// AG Studio draws only in the browser; the server sends the rows.
export const LedgerLoader = dynamic(() => import("./ledger-studio"), {
  ssr: false,
  loading: () => <p className="p-6 text-ink-3">Opening the ledger…</p>,
});
