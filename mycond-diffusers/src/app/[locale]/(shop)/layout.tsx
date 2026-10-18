import { getLocale } from "next-intl/server";
import { MarketProvider } from "@/components/market";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getMarket, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const market = await getMarket(await getLocale(), s);
  return (
    <MarketProvider market={market}>
      <SiteHeader phone={s.phone} />
      <main className="mx-auto max-w-7xl px-4">{children}</main>
      <SiteFooter phone={s.phone} email={s.email} companyName={s.companyName} />
    </MarketProvider>
  );
}
