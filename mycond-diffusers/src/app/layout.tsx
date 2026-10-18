import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart";

export const metadata: Metadata = {
  title: { default: "Дифузори, решітки, пленуми — підбір і розрахунок онлайн", template: "%s · Mycond" },
  icons: { icon: "/brand/mycond-logo.png" },
  description: "Каталог дифузорів, вентиляційних решіток, анемостатів і пленумів з онлайн-конфігуратором: розмір, колір RAL, розрахунок швидкості та втрат тиску, ціна.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen font-sans antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
