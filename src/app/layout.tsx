import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Kalam, Outfit } from "next/font/google";
import "./globals.css";

// Outfit is close to the logo's wordmark; Kalam is the grower's chalk hand on the price card.
const display = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["500", "600", "700", "800"] });
const sans = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const hand = Kalam({ subsets: ["latin"], variable: "--font-kalam", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Strawbank · minds the honesty box while the grower is in the field",
  description:
    "An AI shopkeeper for unstaffed farm stands. The AI counts the basket, code works out the total, PayPal takes the payment, and at dusk the grower learns what sold and what walked.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a1643",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IE"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
