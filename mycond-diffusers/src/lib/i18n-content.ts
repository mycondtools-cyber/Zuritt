/**
 * Переклади контенту (товари, категорії). Зберігаються в полі `translations` у вигляді
 * { en: {...}, pl: {...} }; чого немає в перекладі — показується українською.
 */
import type { ExtraInput, Limits, OptionGroup } from "./types";

export interface ProductTranslation {
  name?: string;
  summary?: string;
  description?: string;
  /** Опції: { ключ групи: { label, hint, choices: { значення варіанта: підпис } } } */
  options?: Record<string, { label?: string; hint?: string; choices?: Record<string, string> }>;
  /** Додаткові поля: { ключ: { label, hint, unit } } */
  extra?: Record<string, { label?: string; hint?: string; unit?: string }>;
}

export interface CategoryTranslation {
  name?: string;
  description?: string;
}

export type Translations<T> = Partial<Record<string, T>>;

const pick = (tr: string | undefined, base: string) => (tr && tr.trim() ? tr : base);

export function trOf<T>(translations: unknown, locale: string): T | undefined {
  if (!translations || typeof translations !== "object") return undefined;
  return (translations as Record<string, T>)[locale];
}

export function localizeOptions(options: OptionGroup[], tr?: ProductTranslation): OptionGroup[] {
  if (!tr?.options) return options;
  return options.map((g) => {
    const t = tr.options?.[g.key];
    if (!t) return g;
    return {
      ...g,
      label: pick(t.label, g.label),
      hint: pick(t.hint, g.hint),
      choices: g.choices.map((c) => ({ ...c, label: pick(t.choices?.[c.value], c.label) })),
    };
  });
}

export function localizeLimits(limits: Limits, tr?: ProductTranslation): Limits {
  if (!tr?.extra || !limits.extra) return limits;
  return {
    ...limits,
    extra: limits.extra.map((e): ExtraInput => {
      const t = tr.extra?.[e.key];
      return t ? { ...e, label: pick(t.label, e.label), hint: e.hint !== undefined ? pick(t.hint, e.hint) : t.hint, unit: pick(t.unit, e.unit) } : e;
    }),
  };
}

/** Товар з БД з підставленим перекладом (той самий тип — далі працює як звичайно) */
export function localizeProduct<P extends { name: string; summary: string; description: string; options: unknown; limits: unknown; translations?: unknown }>(p: P, locale: string): P {
  const tr = trOf<ProductTranslation>(p.translations, locale);
  if (!tr) return p;
  return {
    ...p,
    name: pick(tr.name, p.name),
    summary: pick(tr.summary, p.summary),
    description: pick(tr.description, p.description),
    options: localizeOptions((p.options as OptionGroup[]) ?? [], tr),
    limits: localizeLimits((p.limits as Limits) ?? {}, tr),
  };
}

export function localizeCategory<C extends { name: string; description: string; translations?: unknown }>(c: C, locale: string): C {
  const tr = trOf<CategoryTranslation>(c.translations, locale);
  if (!tr) return c;
  return { ...c, name: pick(tr.name, c.name), description: pick(tr.description, c.description) };
}

/** Назва кольору RAL мовою сайту: «RAL 9016 глянець» → «RAL 9016 gloss» */
export function ralLabel(name: string, words: { gloss: string; matt: string; chrome: string }): string {
  return name.replace(/ глянець$/, ` ${words.gloss}`).replace(/ мат$/, ` ${words.matt}`).replace(/ хром$/, ` ${words.chrome}`);
}
