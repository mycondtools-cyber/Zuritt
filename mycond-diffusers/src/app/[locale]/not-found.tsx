import { getTranslations } from "next-intl/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold">{t("notFound.title")}</h1>
        <p className="mt-2 text-muted">{t("notFound.text")}</p>
        <Link href="/" className="btn-primary mt-6">
          {t("common.toCatalogue")}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
