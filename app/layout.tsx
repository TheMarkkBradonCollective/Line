import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Newsreader, Outfit } from "next/font/google";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "LINE",
  description: "A share-first social app. Content reaches a timeline only when a person sends it there.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
