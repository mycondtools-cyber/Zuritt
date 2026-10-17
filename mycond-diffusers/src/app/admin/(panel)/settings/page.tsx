import { Hint } from "@/components/hint";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "../../actions";

export const metadata = { title: "Налаштування" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [s, { saved }] = await Promise.all([getSettings(), searchParams]);
  const fields: [keyof typeof s, string, string, string?][] = [
    ["eurRate", "Курс EUR, грн", "Для показу цін у євро в конфігураторі", "number"],
    ["ralSurchargePct", "Доплата за нестандартний RAL, %", "Від базової ціни виробу", "number"],
    ["ralExtraDays", "+ днів для нестандартного RAL", "Додається до терміну виготовлення", "number"],
    ["companyName", "Назва компанії", "Показується в підвалі сайту"],
    ["phone", "Телефон", "У шапці та підвалі сайту"],
    ["email", "Email", "У підвалі сайту"],
    ["telegramBotToken", "Telegram: токен бота", "Щоб отримувати заявки в Telegram. Створіть бота в @BotFather", "password"],
    ["telegramChatId", "Telegram: chat id", "ID чату або групи, куди надсилати заявки"],
  ];
  return (
    <form action={saveSettings} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">Налаштування</h1>
      {saved && <p className="rounded-xl bg-good-soft p-3 text-sm text-good">Збережено</p>}
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
  );
}
