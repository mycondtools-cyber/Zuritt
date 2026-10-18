import { Hint } from "@/components/hint";
import { LOCALE_NAMES, routing } from "@/i18n/routing";
import { convert, CURRENCIES, CURRENCY_NAMES, formatMoney, marketFor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { refreshRates, saveCurrencies, saveSettings } from "../../actions";

export const metadata = { title: "Налаштування" };

type Search = { saved?: string; rates?: string; fxError?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [s, { saved, rates, fxError }] = await Promise.all([getSettings(), searchParams]);
  const fields: [keyof typeof s, string, string, string?][] = [
    ["ralSurchargePct", "Доплата за нестандартний RAL, %", "Від базової ціни виробу", "number"],
    ["ralExtraDays", "+ днів для нестандартного RAL", "Додається до терміну виготовлення", "number"],
    ["companyName", "Назва компанії", "Показується в підвалі сайту"],
    ["phone", "Телефон", "У шапці та підвалі сайту"],
    ["email", "Email", "У підвалі сайту"],
    ["telegramBotToken", "Telegram: токен бота", "Щоб отримувати заявки в Telegram. Створіть бота в @BotFather", "password"],
    ["telegramChatId", "Telegram: chat id", "ID чату або групи, куди надсилати заявки"],
  ];
  const fx = s.fx;
  const updated = fx.updatedAt ? new Date(fx.updatedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }) : "ще не оновлювався";
  const EXAMPLE = 1000;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold">Налаштування</h1>
      {saved && <p className="rounded-xl bg-good-soft p-3 text-sm text-good">Збережено</p>}
      {rates && <p className="rounded-xl bg-good-soft p-3 text-sm text-good">Курс НБУ оновлено</p>}
      {fxError && <p className="rounded-xl bg-bad-soft p-3 text-sm text-bad">Не вдалося отримати курс НБУ: {fxError}. Працює останній збережений курс.</p>}

      <form action={saveCurrencies} className="card space-y-5 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            Валюти й маржа
            <Hint text="Ціни в адмінці — у гривнях без маржі. Клієнт бачить: ціна × коефіцієнт маржі ÷ курс валюти. Маржа діє на все: виріб, опції, фарбування." />
          </h2>
          <p className="mt-1 text-sm text-muted">Для кожної мовної версії сайту — своя валюта й націнка.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Версія сайту</th>
                <th className="pb-2 pr-3 font-semibold">Валюта</th>
                <th className="pb-2 pr-3 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Коеф. маржі <Hint text="1 — без націнки, 1,15 — +15 %, 1,3 — +30 %." />
                  </span>
                </th>
                <th className="pb-2 font-semibold">Приклад: {EXAMPLE} грн у прайсі →</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {routing.locales.map((l) => {
                const m = marketFor(l, s.markets, fx);
                return (
                  <tr key={l}>
                    <td className="py-2 pr-3 font-semibold">
                      {LOCALE_NAMES[l]} <span className="text-xs text-muted">{l === routing.defaultLocale ? "/" : `/${l}`}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <select name={`market_${l}_currency`} className="input !w-36 !py-1.5" defaultValue={m.currency}>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {CURRENCY_NAMES[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input name={`market_${l}_margin`} className="input !w-24 !py-1.5" type="number" step="0.01" min="0.5" max="5" defaultValue={m.margin} />
                    </td>
                    <td className="py-2 font-semibold tabular-nums">
                      {formatMoney(convert(EXAMPLE, m), m.currency, "uk")}
                      {m.margin !== 1 && <span className="ml-1 text-xs font-normal text-muted">(+{Math.round((m.margin - 1) * 1000) / 10} %)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl bg-paper p-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="fx_auto" defaultChecked={fx.auto} className="h-4 w-4 accent-[var(--color-brand)]" />
            Курс автоматично з НБУ
            <Hint text="Офіційний курс Національного банку України, оновлюється кожні 6 годин. Якщо НБУ недоступний — працює останній отриманий курс. Вимкніть, щоб задати курс вручну (напр. комерційний)." />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["EUR", "PLN"] as const).map((c) => (
              <label key={c} className="block">
                <span className="label">Курс {c}, грн за 1 {c === "EUR" ? "€" : "zł"}</span>
                <input name={`fx_${c}`} className="input" type="number" step="0.0001" min="0" defaultValue={fx[c]} />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {fx.auto ? "Зараз діє курс НБУ" : "Зараз діє курс, введений вручну"}
            {fx.date ? ` на ${fx.date}` : ""} · оновлено: {updated}. {fx.auto && "Поля курсу змінюються лише в ручному режимі."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary">Зберегти валюти й маржу</button>
          <button formAction={refreshRates} formNoValidate className="btn-ghost">
            Оновити курс НБУ зараз
          </button>
        </div>
      </form>

      <form action={saveSettings} className="space-y-4">
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          {fields.map(([k, l, h, type]) => (
            <label key={k} className="block">
              <span className="label">
                {l} <Hint text={h} />
              </span>
              <input className="input" name={k} type={type === "password" ? "password" : type === "number" ? "number" : "text"} step="any" defaultValue={String(s[k] ?? "")} />
            </label>
          ))}
        </div>
        <button className="btn-primary">Зберегти</button>
      </form>
    </div>
  );
}
