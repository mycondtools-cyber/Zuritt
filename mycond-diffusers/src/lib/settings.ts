import { db } from "./db";
import type { ShopSettings } from "./types";

export const DEFAULT_SETTINGS: ShopSettings = {
  eurRate: 48,
  ralSurchargePct: 15,
  ralExtraDays: 3,
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
  return s as unknown as ShopSettings;
}

/** Налаштування, які безпечно віддавати в браузер */
export function publicSettings(s: ShopSettings) {
  const { telegramBotToken: _t, telegramChatId: _c, ...rest } = s;
  return rest;
}
