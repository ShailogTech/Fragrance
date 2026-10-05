import type { Metadata } from "next";
import { Tiro_Devanagari_Hindi, Mukta } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Shri Fragrance - Sacred South Indian Agarbathi & Pooja Essentials",
  description:
    "Premium handcrafted agarbatti and traditional pooja essentials inspired by South Indian Hindu temples. Sandalwood, jasmine, nag champa and more.",
  keywords: [
    "agarbathi",
    "incense",
    "pooja",
    "South Indian",
    "temple",
    "sandalwood",
    "nag champa",
    "shri fragrance",
  ],
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
        className={`${mukta.variable} ${tiroDevanagari.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
