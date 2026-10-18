"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ralLabel } from "@/lib/i18n-content";
import type { RalData } from "@/lib/types";
import { useMoney } from "./market";

export function RalPicker({ colors, value, onChange, surchargeUah }: { colors: RalData[]; value: string; onChange: (name: string) => void; surchargeUah: number }) {
  const t = useTranslations("ral");
  const money = useMoney();
  const label = (name: string) => ralLabel(name, { gloss: t("suffixGloss"), matt: t("suffixMatt"), chrome: t("chrome") });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [finish, setFinish] = useState("");
  const popular = colors.filter((c) => c.popular || c.isStandard || c.name === value);
  const current = colors.find((c) => c.name === value);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^ral\s*/, "");
    return colors.filter((c) => (!finish || c.finish === finish) && (!s || c.name.toLowerCase().includes(s) || label(c.name).toLowerCase().includes(s)));
  }, [colors, q, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const Swatch = ({ c }: { c: RalData }) => (
    <button
      type="button"
      onClick={() => {
        onChange(c.name);
        setOpen(false);
      }}
      aria-pressed={c.name === value}
      title={label(c.name)}
      className="chip flex items-center gap-2 !px-2 !py-1.5 text-left"
    >
      <span className="h-6 w-6 shrink-0 rounded-md border border-black/10" style={{ background: c.hex }} />
      <span className="text-xs leading-tight">
        {label(c.name)}
        {c.isStandard && <span className="block text-[10px] text-good">{t("standard")}</span>}
      </span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {popular.map((c) => (
          <Swatch key={c.id} c={c} />
        ))}
        <button type="button" className="chip text-xs" onClick={() => setOpen(true)}>
          {t("allColors", { count: colors.length })}
        </button>
      </div>
      {current && !current.isStandard && surchargeUah > 0 && (
        <p className="mt-2 text-xs text-ok">{t("surcharge", { name: label(current.name), value: money.fmt(surchargeUah) })}</p>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4" role="dialog" aria-label={t("palette")} onClick={() => setOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
              <input autoFocus className="input max-w-xs" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
              {[
                ["", t("all")],
                ["gloss", t("gloss")],
                ["matt", t("matt")],
                ["special", t("special")],
              ].map(([v, l]) => (
                <button key={v} type="button" className="chip text-xs" aria-pressed={finish === v} onClick={() => setFinish(v)}>
                  {l}
                </button>
              ))}
              <button type="button" className="btn-ghost ml-auto !py-2" onClick={() => setOpen(false)}>
                {t("close")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-4">
              {list.map((c) => (
                <Swatch key={c.id} c={c} />
              ))}
              {list.length === 0 && <p className="col-span-full text-center text-sm text-muted">{t("notFound")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
