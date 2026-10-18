"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { uah } from "@/lib/format";
import { GROUPS } from "@/lib/products";

export interface CatalogueItem {
  slug: string;
  code: string;
  name: string;
  summary: string;
  image?: string;
  category: string;
  shape: string;
  mounting: string[];
  priceFrom: number;
  sizesCount: number;
  mode: string;
}

const SHAPES: [string, string][] = [
  ["square", "Квадратні / прямокутні"],
  ["round", "Круглі"],
  ["slot", "Щілинні"],
];
const MOUNTS: [string, string][] = [
  ["ceiling", "Стельовий"],
  ["armstrong", "Армстронг"],
  ["stretch", "Натяжна стеля"],
  ["hidden", "Прихований"],
  ["wall", "Стіновий"],
  ["facade", "Фасадний"],
  ["duct", "На повітровід"],
];


export function Catalogue({
  categories,
  items,
  initialGroup = "diffusers",
}: {
  categories: { slug: string; name: string; description: string; group: string }[];
  items: CatalogueItem[];
  initialGroup?: string;
}) {
  const [group, setGroup] = useState(initialGroup);
  const [cat, setCat] = useState("");
  const [shape, setShape] = useState("");
  const [mount, setMount] = useState("");
  const [q, setQ] = useState("");

  const groupCats = categories.filter((c) => c.group === group);
  const inGroup = (i: CatalogueItem) => groupCats.some((c) => c.slug === i.category);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        // пошук працює по всьому каталогу, фільтри — в межах розділу
        (s ? true : groupCats.some((c) => c.slug === i.category)) &&
        (!cat || i.category === cat) &&
        (!shape || i.shape === shape) &&
        (!mount || i.mounting.includes(mount)) &&
        (!s || i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s)),
    );
  }, [items, cat, shape, mount, q, groupCats]);

  const current = categories.find((c) => c.slug === cat);
  const toggle = (v: string, cur: string, set: (x: string) => void) => set(cur === v ? "" : v);

  const switchGroup = (g: string) => {
    setGroup(g);
    setCat("");
    setShape("");
    setMount("");
    try {
      history.replaceState(null, "", g === "diffusers" ? "/" : `/?g=${g}`);
    } catch {
      /* без history — просто перемикаємо */
    }
  };
  const groupShapes = SHAPES.filter(([v]) => items.some((i) => inGroup(i) && i.shape === v));
  const groupMounts = MOUNTS.filter(([v]) => items.some((i) => inGroup(i) && i.mounting.includes(v)));

  return (
    <>
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1" role="tablist">
      {GROUPS.map(([g, l]) => (
        <button
          key={g}
          role="tab"
          aria-selected={group === g}
          onClick={() => switchGroup(g)}
          className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${group === g ? "bg-ink text-white" : "text-ink-2 hover:bg-paper"}`}
        >
          {l} <span className={group === g ? "text-white/60" : "text-muted"}>{items.filter((i) => categories.some((c) => c.group === g && c.slug === i.category)).length}</span>
        </button>
      ))}
    </div>
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <input className="input" placeholder="Пошук: PDK, щілинний…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Пошук" />
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Тип</p>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            <button className="chip text-left" aria-pressed={!cat} onClick={() => setCat("")}>
              Усі <span className="text-muted">· {items.filter(inGroup).length}</span>
            </button>
            {groupCats.map((c) => (
              <button key={c.slug} className="chip text-left" aria-pressed={cat === c.slug} onClick={() => toggle(c.slug, cat, setCat)}>
                {c.name} <span className="text-muted">· {items.filter((i) => i.category === c.slug).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Форма</p>
          <div className="flex flex-wrap gap-2">
            {groupShapes.map(([v, l]) => (
              <button key={v} className="chip" aria-pressed={shape === v} onClick={() => toggle(v, shape, setShape)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Монтаж</p>
          <div className="flex flex-wrap gap-2">
            {groupMounts.map(([v, l]) => (
              <button key={v} className="chip" aria-pressed={mount === v} onClick={() => toggle(v, mount, setMount)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div>
        {current && <p className="mb-4 max-w-3xl text-ink-2">{current.description}</p>}
        {filtered.length === 0 ? (
          <div className="card p-10 text-center text-muted">
            Нічого не знайдено.{" "}
            <button
              className="font-semibold text-brand"
              onClick={() => {
                setCat("");
                setShape("");
                setMount("");
                setQ("");
              }}
            >
              Скинути фільтри
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((i) => (
              <Link key={i.slug} href={`/d/${i.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-white">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt={i.name} loading="lazy" className="h-full w-full object-contain p-4 transition group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">Фото незабаром</div>
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-ink px-2 py-1 text-xs font-bold text-white">{i.code}</span>
                </div>
                <div className="flex flex-1 flex-col border-t border-line p-4">
                  <h3 className="font-bold leading-snug group-hover:text-brand">{i.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{i.summary}</p>
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="text-sm">
                      {i.priceFrom > 0 ? (
                        <>
                          від <b className="text-base">{uah(i.priceFrom)}</b>
                        </>
                      ) : (
                        <span className="text-muted">Ціна за запитом</span>
                      )}
                    </span>
                    <span className="text-xs text-muted">
                      {i.mode === "sizes" ? `${i.sizesCount} розмірів` : i.mode === "slot" ? "довжина до 3 м" : i.mode === "box" ? "під ваші розміри" : "будь-який розмір"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
    </>
  );
}
