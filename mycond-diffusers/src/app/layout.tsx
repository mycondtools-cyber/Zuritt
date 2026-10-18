import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Дифузори, решітки, пленуми — підбір і розрахунок онлайн", template: "%s · Mycond" },
  description: "Каталог дифузорів, вентиляційних решіток, анемостатів і пленумів з онлайн-конфігуратором: розмір, колір RAL, розрахунок швидкості та втрат тиску, ціна.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={manrope.variable}>
      <body className="min-h-screen font-sans antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
