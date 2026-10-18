import { CONTENT_LOCALES, LOCALE_NAMES } from "@/i18n/routing";
import { db } from "@/lib/db";
import type { CategoryTranslation } from "@/lib/i18n-content";
import { GROUPS } from "@/lib/products";
import { deleteCategory, saveCategory } from "../../actions";

export const metadata = { title: "Категорії" };

export default async function CategoriesPage() {
  const cats = await db.category.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { products: true } } } });
  const Row = ({ c }: { c?: (typeof cats)[number] }) => (
    <form action={saveCategory} className="grid gap-2 p-3 sm:grid-cols-[150px_1fr_2fr_240px_auto] sm:items-center">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <input name="slug" className="input font-mono text-xs" defaultValue={c?.slug} placeholder="slug" required />
      <input name="name" className="input font-semibold" defaultValue={c?.name} placeholder="Назва" required />
      <input name="description" className="input" defaultValue={c?.description} placeholder="Опис для сторінки каталогу" />
      <span className="flex gap-2">
        <select name="group" className="input !w-36" defaultValue={c?.group ?? "diffusers"} aria-label="Розділ">
          {GROUPS.map(([g, l]) => (
            <option key={g} value={g}>
              {l}
            </option>
          ))}
        </select>
        <input name="sort" className="input !w-20" type="number" defaultValue={c?.sort ?? 0} aria-label="Порядок" />
      </span>
      <details className="sm:order-last sm:col-span-full">
        <summary className="cursor-pointer text-xs font-semibold text-muted">
          Переклади{" "}
          {CONTENT_LOCALES.map((l) => ((c?.translations as Record<string, CategoryTranslation>)?.[l]?.name ? `✓${l.toUpperCase()} ` : `·${l.toUpperCase()} `))}
        </summary>
        <div className="mt-2 grid gap-2">
          {CONTENT_LOCALES.map((l) => {
            const t = (c?.translations as Record<string, CategoryTranslation> | undefined)?.[l];
            return (
              <div key={l} className="grid gap-2 sm:grid-cols-[100px_1fr_2fr] sm:items-center">
                <span className="text-xs font-semibold">{LOCALE_NAMES[l]}</span>
                <input name={`tr_${l}_name`} className="input" defaultValue={t?.name} placeholder={c?.name ?? "Назва"} />
                <input name={`tr_${l}_description`} className="input" defaultValue={t?.description} placeholder={c?.description ?? "Опис"} />
              </div>
            );
          })}
        </div>
      </details>
      <span className="flex gap-2">
        <button className="btn-primary !py-2">{c ? "Зберегти" : "Додати"}</button>
        {c && c._count.products === 0 && (
          <button formAction={deleteCategory.bind(null, c.id)} className="btn-ghost !py-2 hover:!text-bad">
            ✕
          </button>
        )}
      </span>
    </form>
  );
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-extrabold">Категорії</h1>
      <div className="card divide-y divide-line">
        {cats.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </div>
      <h2 className="font-bold">Нова категорія</h2>
      <div className="card">
        <Row />
      </div>
      <p className="text-xs text-muted">Категорію можна видалити, лише коли в ній немає товарів.</p>
    </div>
  );
}
