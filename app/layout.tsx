import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Antonio, IBM_Plex_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Antonio({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Trek Field Guide",
  description:
    "A touch-first Federation archive of species, worlds, ships, factions, and treaty events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
