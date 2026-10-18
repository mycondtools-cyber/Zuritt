import { db } from "./db";
import { DEFAULT_FX, type FxRates } from "./money";

const NBU_URL = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";
/** Як часто оновлювати курси автоматично (НБУ встановлює курс раз на день) */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Офіційні курси НБУ: гривень за 1 EUR і 1 PLN */
export async function fetchNbuRates(): Promise<Pick<FxRates, "EUR" | "PLN" | "date">> {
  const res = await fetch(NBU_URL, { signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!res.ok) throw new Error(`НБУ: HTTP ${res.status}`);
  const rows = (await res.json()) as { cc: string; rate: number; exchangedate: string }[];
  const get = (cc: string) => rows.find((r) => r.cc === cc);
  const eur = get("EUR");
  const pln = get("PLN");
  if (!eur?.rate || !pln?.rate) throw new Error("НБУ: немає курсу EUR або PLN");
  return { EUR: eur.rate, PLN: pln.rate, date: eur.exchangedate };
}

async function saveFx(fx: FxRates) {
  await db.setting.upsert({ where: { key: "fx" }, update: { value: { ...fx } }, create: { key: "fx", value: { ...fx } } });
}

/**
 * Поточні курси. В автоматичному режимі раз на 6 годин підтягує курс НБУ;
 * якщо НБУ недоступний — працює з останнім збереженим курсом.
 */
export async function getFx(stored?: unknown, force = false): Promise<FxRates> {
  const cur: FxRates = { ...DEFAULT_FX, ...((stored ?? (await db.setting.findUnique({ where: { key: "fx" } }))?.value ?? {}) as Partial<FxRates>) };
  if (!cur.auto && !force) return cur;
  const age = cur.updatedAt ? Date.now() - Date.parse(cur.updatedAt) : Infinity;
  if (!force && age < MAX_AGE_MS) return cur;
  try {
    const next: FxRates = { ...cur, ...(await fetchNbuRates()), updatedAt: new Date().toISOString() };
    await saveFx(next);
    return next;
  } catch (e) {
    if (force) throw e;
    return cur;
  }
}
