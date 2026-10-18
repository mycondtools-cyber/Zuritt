/** 404 поза мовними розділами (напр. /admin/невідома-адреса) */
export default function NotFound() {
  return (
    <html lang="uk">
      <body className="flex min-h-screen items-center justify-center font-sans antialiased">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">404</h1>
          <a href="/" className="btn-primary mt-6">
            На головну
          </a>
        </div>
      </body>
    </html>
  );
}
