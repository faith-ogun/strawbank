import Link from "next/link";
import type { ReactNode } from "react";

/** A page that is laid out but not built yet. Says which flow it belongs to. */
export function Placeholder({ flow, title, children }: { flow: string; title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <p className="text-sm opacity-60">{flow}</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <div className="mt-4 space-y-3 leading-relaxed">{children}</div>
      <p className="mt-8 text-sm opacity-60">
        Not built yet. <Link className="underline" href="/">Back to the start</Link>
      </p>
    </main>
  );
}
