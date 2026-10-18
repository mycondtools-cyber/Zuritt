export type Mode = "sizes" | "rect" | "slot";
export type Shape = "square" | "round" | "slot";

export interface Choice {
  value: string;
  label: string;
  /** Фіксована доплата за 1 шт., грн */
  priceAdd: number;
  /** Доплата у % від базової ціни */
  pricePct: number;
}

export interface OptionGroup {
  key: string;
  label: string;
  hint: string;
  default: string;
  choices: Choice[];
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
}

export interface RectPricing {
  perM2: number;
  min: number;
}

export interface SlotPricing {
  /** Ціна погонного метра однощілинного дифузора */
  perMeter: number;
  /** Доплата за кожну додаткову щілину, % від ціни 1 щілини */
  perExtraSlotPct: number;
  /** Мінімальна довжина для розрахунку ціни, мм */
  minLengthMm: number;
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
  pricing: RectPricing | SlotPricing | Record<string, never>;
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
}
