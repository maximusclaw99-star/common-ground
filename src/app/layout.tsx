import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"], weight: ["500", "700"],
  variable: "--font-space-grotesk", display: "swap",
});
const mono = Space_Mono({
  subsets: ["latin"], weight: ["400", "700"],
  variable: "--font-space-mono", display: "swap",
});

export const metadata: Metadata = {
  title: "Common Ground",
  description:
    "Find the people at your target companies who actually have something in common with you, and write to them yourself.",
};

/**
 * Paper, always.
 *
 * The system ships no automatic theme — `data-theme` is ours to set — and
 * Paper is the brand. Pinning it here rather than following the OS means the
 * hero's `mix-blend-mode: multiply` is always on the ground it was drawn for,
 * and nobody sees a different product depending on their system settings.
 * Terminal (dark) stays defined in tokens.css for whenever a toggle is wanted.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${display.variable} ${mono.variable}`}>
      <body className="tb-root">{children}</body>
    </html>
  );
}
