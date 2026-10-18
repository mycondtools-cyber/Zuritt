import "./globals.css";

/** Кореневий макет лише передає вміст: <html> задають [locale]/layout (сайт) і admin/layout (адмінка) */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
