import type { Metadata } from "next";
import { Tiro_Devanagari_Hindi, Mukta, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const tiroDevanagari = Tiro_Devanagari_Hindi({
  variable: "--font-tiro",
  weight: "400",
  subsets: ["latin", "devanagari"],
  display: "swap",
});

const mukta = Mukta({
  variable: "--font-mukta",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "devanagari"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shri Fragrance - Sacred South Indian Agarbathi & Pooja Essentials",
  description: "Premium handcrafted agarbathi and traditional pooja essentials inspired by South Indian Hindu temples. Sandalwood, jasmine, nag champa and more.",
  keywords: ["agarbathi", "incense", "pooja", "South Indian", "temple", "sandalwood", "nag champa", "shri fragrance"],
  authors: [{ name: "Shri Fragrance" }],
  icons: {
    icon: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${mukta.variable} ${tiroDevanagari.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
