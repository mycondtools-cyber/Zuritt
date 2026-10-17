import Link from "next/link";
import { LIMITS } from "@/lib/calc";

export const metadata = { title: "Як підібрати дифузор" };

const TYPES = [
  ["Стельові квадратні (PDK, NCD)", "Квартири, офіси, магазини зі стелею до 3,5 м. Розподіляють повітря в 1–4 сторони вздовж стелі."],
  ["Ротаційні та панельні (DPF, RD, DCc)", "Підвісні стелі «Армстронг», офіси, open space. Вихровий потік швидко перемішує повітря — менше протягів при великій витраті."],
  ["Щілинні (SD, SDH, SDT)", "Сучасні інтер’єри, натяжні та гіпсокартонні стелі. Лінійний потік вздовж стелі або вікна. SDH — прихований монтаж під шпаклівку."],
  ["Гіпсові (CRL, PCR, SQR)", "Майже невидимі: монтуються в стелю і фарбуються разом з нею. Для невеликих витрат у житлових кімнатах."],
  ["Вихрові та сопла (VDL, DVA, JN)", "Високі приміщення 4–15 м: склади, зали, ТРЦ. Вихрові з термобалоном самі перемикають режим обігрів/охолодження, сопла JN б’ють на 10–30 м."],
];

export default function Guide() {
  return (
    <div className="max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Як підібрати дифузор</h1>
      <ol className="mt-6 space-y-4">
        <li className="card p-5">
          <h2 className="font-bold">1. Визначте витрату повітря</h2>
          <p className="mt-1 text-ink-2">
            Зазвичай вона є в проєкті вентиляції. Якщо ні — площа × висота × кратність. Кратність: житло 1–2, офіс 2–4, кухня та санвузол 5–10. Поділіть
            загальну витрату на кількість дифузорів у приміщенні.
          </p>
        </li>
        <li className="card p-5">
          <h2 className="font-bold">2. Оберіть тип за стелею та інтер’єром</h2>
          <ul className="mt-2 space-y-2">
            {TYPES.map(([t, d]) => (
              <li key={t}>
                <b>{t}</b> — <span className="text-ink-2">{d}</span>
              </li>
            ))}
          </ul>
        </li>
        <li className="card p-5">
          <h2 className="font-bold">3. Перевірте три цифри в конфігураторі</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
            <li>
              Швидкість на виході — до {LIMITS.velocity.good} м/с для тихих приміщень, до {LIMITS.velocity.ok} м/с для комерційних.
            </li>
            <li>Швидкість у робочій зоні — до {LIMITS.velocityAtZone.good} м/с, щоб не було протягів.</li>
            <li>Втрата тиску — бажано до {LIMITS.pressureDrop.good} Па.</li>
          </ul>
          <p className="mt-2 text-ink-2">Конфігуратор підсвічує їх зеленим, жовтим або червоним і сам радить розмір.</p>
        </li>
        <li className="card p-5">
          <h2 className="font-bold">4. Колір і заявка</h2>
          <p className="mt-1 text-ink-2">
            Стандартний колір — білий RAL 9016. Будь-який інший RAL фарбуємо під замовлення. Додайте позиції до заявки — менеджер підтвердить ціну й термін.
          </p>
        </li>
      </ol>
      <Link href="/" className="btn-primary mt-6">
        До каталогу
      </Link>
    </div>
  );
}
