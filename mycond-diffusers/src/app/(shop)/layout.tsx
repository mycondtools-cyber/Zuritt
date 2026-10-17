import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <SiteHeader phone={s.phone} />
      <main className="mx-auto max-w-7xl px-4">{children}</main>
      <SiteFooter phone={s.phone} email={s.email} companyName={s.companyName} />
    </>
  );
}
