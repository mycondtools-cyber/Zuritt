export type Mode = "sizes" | "rect" | "slot" | "box";
export type Shape = "square" | "round" | "slot" | "box";

export interface Choice {
  value: string;
  label: string;
  /** Фіксована доплата за 1 шт., грн */
  priceAdd: number;
  /** Доплата у % від базової ціни */
  pricePct: number;
  /** Щілинні: доплата за кожну щілину, грн */
  pricePerSlot?: number;
  /** Щілинні: доплата за метр довжини, грн */
  pricePerM?: number;
  /** Щілинні: доплата за метр довжини на кожну щілину, грн */
  pricePerSlotM?: number;
  /** Типорозміри: доплата для конкретного розміру (замінює priceAdd). Якщо задано, а розміру в списку немає — варіант недоступний для цього розміру */
  priceBySize?: Record<string, number>;
  /** Доплата за м²: для решіток — площа Ш×В, для боксів — площа поверхні */
  pricePerM2?: number;
  /** Бокси: доплата за кожен патрубок / отвір, грн */
  pricePerConn?: number;
  /** Бокси: доплата за кожен патрубок на 1 мм діаметра, грн */
  pricePerConnMm?: number;
  /** Вплив варіанта на аеродинаміку (кут жалюзі, демпфер тощо) */
  calc?: { zeta?: number; throwK?: number; tempK?: number; areaMul?: number };
}

/** Додаткове числове поле конфігуратора (діаметр патрубка, ширина рамки, габарит боксу…) */
export interface ExtraInput {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  hint?: string;
}

export interface OptionGroup {
  key: string;
  label: string;
  hint: string;
  default: string;
  choices: Choice[];
  /** Показувати групу лише коли в іншій групі обрано одне з значень */
  showIf?: { key: string; values: string[] };
}

export interface CalcParams {
  /** Частка живого перерізу від габаритної площі (якщо в розмірі не задано freeArea) */
  areaCoef: number;
  /** Коефіцієнт місцевого опору ζ: dP = ζ·ρ·v²/2 */
  zeta: number;
  /** Коефіцієнт згасання швидкості струменя K: vx = K·v0·√A0 / x */
  throwK: number;
  /** Коефіцієнт згасання температурної різниці */
  tempK: number;
  /** Ширина щілини за замовчуванням, мм (для щілинних) */
  slotWidthMm?: number;
  /** Тип струменя: компактний (vx ∝ 1/x) або плоский для щілинних (vx ∝ 1/√x) */
  jet?: "compact" | "plane";
  /** Уточнені коефіцієнти для щілинних за ключем «к-сть щілин» або «к-сть x ширина» (напр. "2" або "2x30") */
  byKey?: Record<string, { zeta?: number; throwK?: number; tempK?: number }>;
  /** false — розрахунок для моделі не показується (немає даних виробника) */
  enabled?: boolean;
  /** Бокси AF / FLX: габарити рахуються автоматично з кількості й діаметра отворів */
  boxAuto?: "af";
}

export interface RectPricing {
  /** Фіксована частина, грн */
  fixed?: number;
  perM2: number;
  /** Ставка за метр периметра, грн */
  perM?: number;
  min: number;
  /** Коефіцієнт надбавки за колір RAL (1 — як у еталонного виробу, 0 — колір не впливає) */
  ralFactor?: number;
  /** Лінійна доплата за одиницю додаткового поля: { ключ поля: грн за одиницю } */
  perExtra?: Record<string, number>;
}

export interface SlotPricing {
  /** Фіксована частина, грн */
  fixed?: number;
  /** Ціна погонного метра однощілинного дифузора */
  perMeter: number;
  /** Доплата за кожну додаткову щілину, % від ціни 1 щілини (якщо немає рядка в byKey) */
  perExtraSlotPct: number;
  /** Мінімальна довжина для розрахунку ціни, мм */
  minLengthMm: number;
  /** Ціни за ключем «к-сть щілин» або «к-сть x ширина»: фіксована частина + за метр */
  byKey?: Record<string, { fixed: number; perMeter: number }>;
  ralFactor?: number;
}

export interface SizesPricing {
  ralFactor?: number;
}

/** Бокси (пленуми): фіксована + за м² поверхні + за м ребер; патрубки й опції — через доплати варіантів */
export interface BoxPricing {
  fixed: number;
  perM2: number;
  perM: number;
  /** Лінійна доплата за одиницю додаткового поля: { ключ поля: грн за одиницю } */
  perExtra?: Record<string, number>;
  min?: number;
  ralFactor?: number;
}

export interface Limits {
  wMin?: number;
  wMax?: number;
  hMin?: number;
  hMax?: number;
  wDefault?: number;
  hDefault?: number;
  lMin?: number;
  lMax?: number;
  lDefault?: number;
  step?: number;
  angleMin?: number;
  angleMax?: number;
  angleStep?: number;
  angleDefault?: number;
  /** Додаткові числові поля; для боксів — габарити a, b, h та параметри патрубків connD, connCount */
  extra?: ExtraInput[];
}

export interface SizeRow {
  id?: number;
  label: string;
  w: number | null;
  h: number | null;
  d: number | null;
  freeArea: number | null;
  price: number;
  sort: number;
}

/** Продукт у вигляді, який отримує конфігуратор на клієнті */
export interface ProductData {
  id: number;
  slug: string;
  code: string;
  name: string;
  mode: Mode;
  shape: Shape;
  leadDays: number;
  options: OptionGroup[];
  calc: CalcParams;
  pricing: RectPricing | SlotPricing | SizesPricing | BoxPricing;
  limits: Limits;
  sizes: SizeRow[];
}

export interface RalData {
  id: number;
  code: string;
  name: string;
  hex: string;
  finish: string;
  isStandard: boolean;
  popular: boolean;
  /** Надбавка за колір, % (якщо порожньо — загальна з налаштувань) */
  surchargePct?: number | null;
}

export interface ShopSettings {
  eurRate: number;
  ralSurchargePct: number;
  ralExtraDays: number;
  phone: string;
  email: string;
  companyName: string;
  telegramBotToken: string;
  telegramChatId: string;
}

/** Що обрав користувач у конфігураторі */
export interface Selection {
  sizeLabel?: string;
  width?: number;
  height?: number;
  length?: number;
  angle?: number;
  /** Значення додаткових числових полів */
  extra?: Record<string, number>;
  options: Record<string, string>;
  ralName: string;
  quantity: number;
}

export interface CartItem {
  uid: string;
  slug: string;
  code: string;
  name: string;
  image?: string;
  spec: string;
  details: { label: string; value: string }[];
  unitPrice: number;
  quantity: number;
  leadDays: number;
  selection: Selection;
  /** Вихідні дані розрахунку (щоб сервер міг відтворити рядок «Розрахунок») */
  calc?: { airflow: number; distance: number; deltaT: number | null };
}
