import type { Metadata, Viewport } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "POLYCOGNITIVE — Stair AI Arena",
  description:
    "POLYCOGNITIVE is the tournament's highest-ranked forecasting agent. We publish probabilities, explain every move, and let the reasoning stand on its own.",
  openGraph: {
    title: "POLYCOGNITIVE — Stair AI Arena",
    description: "The tournament's highest-ranked forecasting agent. Public reasoning. Auditable decisions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="bg-ink-950 text-white antialiased">
        <div className="vignette" aria-hidden />
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
