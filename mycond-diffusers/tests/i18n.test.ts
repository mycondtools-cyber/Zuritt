/**
 * Мови сайту: однаковий набір ключів у всіх файлах повідомлень і повні переклади стартового каталогу.
 */
import { describe, expect, it } from "vitest";
import seed from "../data/seed.json";
import { CONTENT_LOCALES, routing } from "@/i18n/routing";
import { localizeProduct, ralLabel } from "@/lib/i18n-content";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import uk from "@/messages/uk.json";

const MESSAGES: Record<string, unknown> = { uk, en, pl };

function keys(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`];
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe("файли повідомлень", () => {
  for (const l of routing.locales) {
    it(`${l}: є файл і ті самі ключі, що в uk`, () => {
      expect(MESSAGES[l], `немає src/messages/${l}.json`).toBeTruthy();
      expect(keys(MESSAGES[l]).sort()).toEqual(keys(uk).sort());
    });
  }
  it("в en і pl не лишилось кирилиці", () => {
    for (const l of ["en", "pl"]) expect(JSON.stringify(MESSAGES[l])).not.toMatch(/[а-яіїєґ]{2,}/i);
  });
});

describe("переклад каталогу", () => {
  type P = (typeof seed.products)[number] & { translations: Record<string, Record<string, unknown>> };
  for (const l of CONTENT_LOCALES) {
    it(`${l}: назви, описи, опції й категорії перекладено`, () => {
      for (const c of seed.categories as { slug: string; translations: Record<string, { name?: string }> }[]) expect(c.translations[l]?.name, c.slug).toBeTruthy();
      for (const raw of seed.products as P[]) {
        const p = localizeProduct({ ...raw, summary: "", limits: raw.limits ?? {} }, l);
        expect(p.name, raw.slug).not.toBe(raw.name);
        if (raw.description) expect(p.description, raw.slug).not.toBe(raw.description);
        for (const g of p.options as { label: string; key: string; choices: { label: string }[] }[]) {
          expect(g.label, `${raw.slug} ${g.key}`).not.toMatch(/[а-яіїєґ]{3,}/i);
          for (const c of g.choices) expect(c.label, `${raw.slug} ${g.key}`).not.toMatch(/[а-яіїєґ]{3,}/i);
        }
      }
    });
  }

  it("без перекладу — українською", () => {
    const raw = { name: "Дифузор", summary: "Опис", description: "## Призначення", options: [{ key: "k", label: "Група", hint: "", default: "a", choices: [{ value: "a", label: "А", priceAdd: 0, pricePct: 0 }] }], limits: {}, translations: { en: { name: "Diffuser", options: { k: { choices: { a: "A" } } } } } };
    const p = localizeProduct(raw, "en");
    expect(p.name).toBe("Diffuser");
    expect(p.summary).toBe("Опис");
    expect(p.options[0].label).toBe("Група");
    expect(p.options[0].choices[0].label).toBe("A");
    expect(p.options[0].choices[0].value).toBe("a");
    expect(localizeProduct(raw, "pl").name).toBe("Дифузор");
  });

  it("назви RAL", () => {
    const w = { gloss: "gloss", matt: "matt", chrome: "chrome" };
    expect(ralLabel("RAL 9016 глянець", w)).toBe("RAL 9016 gloss");
    expect(ralLabel("RAL 7016 мат", w)).toBe("RAL 7016 matt");
    expect(ralLabel("G020 хром", w)).toBe("G020 chrome");
  });
});
