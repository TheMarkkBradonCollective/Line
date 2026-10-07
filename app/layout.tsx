import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const sans = Nunito({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "600", "700", "800"] });
const display = Fredoka({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "LINE",
  description: "A share-first social app. Content reaches a timeline only when a person sends it there.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#00BF8F",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
