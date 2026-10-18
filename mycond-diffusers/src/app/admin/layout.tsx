import type { Metadata } from "next";

export const metadata: Metadata = { icons: { icon: "/brand/mycond-icon.png", apple: "/brand/mycond-icon.png" } };

/** Адмінка — завжди українською, без мовного префікса */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
