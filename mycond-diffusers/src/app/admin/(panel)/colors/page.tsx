import { ColorList } from "@/components/admin/color-list";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addColor } from "../../actions";

export const metadata = { title: "Кольори RAL" };

export default async function ColorsPage() {
  const [colors, s] = await Promise.all([db.ralColor.findMany({ orderBy: [{ sort: "asc" }] }), getSettings()]);
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-extrabold">Кольори RAL</h1>
      <p className="text-sm text-ink-2">
        <b>Стандарт</b> — без доплати. Інші кольори: +{s.ralSurchargePct}% і +{s.ralExtraDays} днів (змінюється в налаштуваннях). <b>Популярні</b> показуються одразу в
        конфігураторі, решта — у повній палітрі.
      </p>
      <form action={addColor} className="card flex flex-wrap items-end gap-3 p-4">
        <label>
          <span className="label">Назва</span>
          <input name="name" className="input" placeholder="RAL 7021 мат" required />
        </label>
        <label>
          <span className="label">Колір</span>
          <input name="hex" type="color" className="h-[42px] w-16 rounded-xl border border-line" defaultValue="#cccccc" />
        </label>
        <button className="btn-primary">Додати</button>
      </form>
      <ColorList colors={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, isStandard: c.isStandard, popular: c.popular }))} />
    </div>
  );
}
