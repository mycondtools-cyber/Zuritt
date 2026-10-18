import { db } from "./db";
import { getFx } from "./fx";
import { DEFAULT_FX, DEFAULT_MARKETS, marketFor, type Market } from "./money";
import type { ShopSettings } from "./types";

export const DEFAULT_SETTINGS: ShopSettings = {
  fx: DEFAULT_FX,
  markets: DEFAULT_MARKETS,
  ralSurchargePct: 12,
  ralExtraDays: 0,
  phone: "",
  email: "",
  companyName: "Mycond",
  telegramBotToken: "",
  telegramChatId: "",
};

export async function getSettings(): Promise<ShopSettings> {
  const rows = await db.setting.findMany();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  s.fx = { ...DEFAULT_FX, ...(s.fx as object) };
  s.markets = { ...DEFAULT_MARKETS, ...(s.markets as object) };
  return s as unknown as ShopSettings;
}

/** Ринок мовної версії зі свіжими курсами (НБУ оновлюється не частіше ніж раз на 6 год) */
export async function getMarket(locale: string, settings?: ShopSettings): Promise<Market> {
  const s = settings ?? (await getSettings());
  const fx = await getFx(s.fx);
  return marketFor(locale, s.markets, fx);
}

/** Налаштування, які безпечно віддавати в браузер */
export function publicSettings(s: ShopSettings) {
  const { telegramBotToken: _t, telegramChatId: _c, fx: _f, markets: _m, ...rest } = s;
  return rest;
}
