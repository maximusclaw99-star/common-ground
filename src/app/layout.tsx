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
 * The system has no automatic theme — `data-theme` must be set on <html>. This
 * runs before first paint so the page never flashes the wrong ground, and
 * suppressHydrationWarning covers the attribute the server could not know.
 */
const THEME_SCRIPT = `try{document.documentElement.dataset.theme=` +
  `matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}` +
  `catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning
      className={`${display.variable} ${mono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="tb-root">{children}</body>
    </html>
  );
}
