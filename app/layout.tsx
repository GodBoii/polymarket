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
  title: "ORACLE — The world's forecasting engine",
  description:
    "ORACLE is the real-time intelligence marketplace where the world trades probabilities on football, global tournaments, and world events.",
  openGraph: {
    title: "ORACLE — The world's forecasting engine",
    description: "Real-time collective intelligence. Trade probabilities on the future.",
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
