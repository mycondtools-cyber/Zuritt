"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";

const KEY = "diffusers-cart-v1";

interface CartCtx {
  items: CartItem[];
  ready: boolean;
  add: (item: CartItem) => void;
  setQty: (uid: string, qty: number) => void;
  remove: (uid: string) => void;
  clear: () => void;
  count: number;
  total: number;
}

const Ctx = createContext<CartCtx | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* приватний режим — кошик живе до перезавантаження */
    }
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const same = prev.find((p) => p.spec === item.spec && p.slug === item.slug && JSON.stringify(p.details) === JSON.stringify(item.details));
      if (same) return prev.map((p) => (p === same ? { ...p, quantity: p.quantity + item.quantity } : p));
      return [...prev, item];
    });
  }, []);
  const setQty = useCallback((uid: string, qty: number) => {
    setItems((prev) => prev.map((p) => (p.uid === uid ? { ...p, quantity: Math.max(1, Math.floor(qty) || 1) } : p)));
  }, []);
  const remove = useCallback((uid: string) => setItems((prev) => prev.filter((p) => p.uid !== uid)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      ready,
      add,
      setQty,
      remove,
      clear,
      count: items.reduce((s, i) => s + i.quantity, 0),
      total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    }),
    [items, ready, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

export function CartBadge() {
  const { count } = useCart();
  return (
    <a href="/cart" className="relative inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
      </svg>
      <span className="hidden sm:inline">Заявка</span>
      {count > 0 && <span className="rounded-full bg-white px-1.5 text-xs font-bold text-ink">{count}</span>}
    </a>
  );
}
