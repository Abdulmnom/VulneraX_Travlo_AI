import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// next/font downloads and self-hosts fonts at build time — works offline in Docker
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Travlo | دليلك السياحي في عُمان",
  description:
    "Travlo – Your AI-powered local tourism guide for the Sultanate of Oman. Ask in Arabic or English for the best places, food, and attractions.",
  keywords: ["Oman", "tourism", "travel", "سياحة", "عمان", "AI", "guide"],
  robots: "noindex, nofollow", // Privacy-first: don't index local instance
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Default LTR; LanguageToggle component updates dir dynamically
    <html lang="en" dir="ltr" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
