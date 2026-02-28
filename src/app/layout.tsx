import type { Metadata } from "next";
import { Amiri, Tajawal } from "next/font/google";
import "@/styles/globals.css";

// Cinametic serif for headings and display
const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-amiri",
  display: "swap",
});

// Modern sans for body text
const tajawal = Tajawal({
  weight: ["400", "500", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | مذاق السينما",
    default: "مذاق السينما - Taste of Cinema Arabic",
  },
  description: "المنصة العربية الأولى لمقالات السينما العالمية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${amiri.variable} ${tajawal.variable}`}>
        {children}
      </body>
    </html>
  );
}
