export const STATUSES: Record<string, { label: string; cls: string }> = {
  new: { label: "Нова", cls: "bg-brand-soft text-brand" },
  processing: { label: "В роботі", cls: "bg-ok-soft text-ok" },
  done: { label: "Виконана", cls: "bg-good-soft text-good" },
  cancelled: { label: "Скасована", cls: "bg-paper text-muted" },
};

export interface OrderItem {
  slug: string;
  code: string;
  name: string;
  spec: string;
  details: { label: string; value: string }[];
  quantity: number;
  unitPrice: number;
  total: number;
  leadDays: number;
  onRequest: boolean;
}
