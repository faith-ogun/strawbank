import Link from "next/link";

const surfaces = [
  { href: "/s/demo", label: "Stand page", note: "what a customer sees after scanning the QR code (F2)" },
  { href: "/grower/morning", label: "Morning set-up", note: "price card and shelf photos (F1)" },
  { href: "/grower/dusk", label: "Dusk count", note: "what sold and what walked (F3)" },
  { href: "/grower/refunds", label: "Refund requests", note: "the ones waiting for the grower (F4)" },
  { href: "/ledger", label: "Ledger", note: "the grower's dashboard (F6)" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Strawbank</h1>
      <p className="mt-2 leading-relaxed">
        An AI shopkeeper for unstaffed farm stands. It counts the basket, takes payment through PayPal, and tells the
        grower at dusk what sold and what walked. PayPal sandbox only.
      </p>
      <ul className="mt-6 space-y-3">
        {surfaces.map((s) => (
          <li key={s.href}>
            <Link className="font-medium underline" href={s.href}>
              {s.label}
            </Link>
            <span className="opacity-70">: {s.note}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
