import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LIMITS } from "@/lib/calc";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "guide" });
  return { title: t("title") };
}

export default async function Guide({ params }: Props) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  const types = t.raw("guide.types") as [string, string][];
  return (
    <div className="max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("guide.title")}</h1>
      <ol className="mt-6 space-y-4">
        <li className="card p-5">
          <h2 className="font-bold">{t("guide.s1Title")}</h2>
          <p className="mt-1 text-ink-2">{t("guide.s1Text")}</p>
        </li>
        <li className="card p-5">
          <h2 className="font-bold">{t("guide.s2Title")}</h2>
          <ul className="mt-2 space-y-2">
            {types.map(([title, text]) => (
              <li key={title}>
                <b>{title}</b> — <span className="text-ink-2">{text}</span>
              </li>
            ))}
          </ul>
        </li>
        <li className="card p-5">
          <h2 className="font-bold">{t("guide.s3Title")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
            <li>{t("guide.s3Velocity", LIMITS.velocity)}</li>
            <li>{t("guide.s3Zone", LIMITS.velocityAtZone)}</li>
            <li>{t("guide.s3Pressure", LIMITS.pressureDrop)}</li>
          </ul>
          <p className="mt-2 text-ink-2">{t("guide.s3Note")}</p>
        </li>
        <li className="card p-5">
          <h2 className="font-bold">{t("guide.s4Title")}</h2>
          <p className="mt-1 text-ink-2">{t("guide.s4Text")}</p>
        </li>
      </ol>
      <Link href="/" className="btn-primary mt-6">
        {t("common.toCatalogue")}
      </Link>
    </div>
  );
}
