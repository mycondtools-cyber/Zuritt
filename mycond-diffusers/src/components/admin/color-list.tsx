"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteColor, updateColor } from "@/app/admin/actions";

type C = { id: number; name: string; hex: string; isStandard: boolean; popular: boolean; surchargePct: number | null };

export function ColorList({ colors }: { colors: C[] }) {
  const [list, setList] = useState(colors);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(false);
  const [, start] = useTransition();
  const shown = useMemo(() => list.filter((c) => (!only || c.isStandard || c.popular) && c.name.toLowerCase().includes(q.toLowerCase())), [list, q, only]);

  const patch = (id: number, data: Partial<C>) => {
    setList((l) => l.map((c) => (c.id === id ? { ...c, ...data } : c)));
    start(() => updateColor(id, data));
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Пошук, напр. 9005" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> лише стандартні та популярні
        </label>
        <span className="ml-auto self-center text-sm text-muted">{shown.length} з {list.length}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.slice(0, 300).map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm">
            <input type="color" value={c.hex} onChange={(e) => patch(c.id, { hex: e.target.value })} className="h-8 w-8 shrink-0 cursor-pointer rounded-md" aria-label={`Колір ${c.name}`} />
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <label className="flex items-center gap-0.5 text-xs text-muted" title="Надбавка за колір, %. Порожньо — загальна з налаштувань">
              +
              <input
                className="w-12 rounded-md border border-line px-1 py-0.5 text-right text-xs text-ink"
                inputMode="decimal"
                defaultValue={c.surchargePct ?? ""}
                disabled={c.isStandard}
                aria-label={`Надбавка ${c.name}, %`}
                onBlur={(e) => {
                  const v = e.target.value.trim() === "" ? null : parseFloat(e.target.value.replace(",", "."));
                  if (v !== c.surchargePct && (v === null || Number.isFinite(v))) patch(c.id, { surchargePct: v });
                }}
              />
              %
            </label>
            <button type="button" className={`rounded-md px-1.5 py-0.5 text-xs ${c.isStandard ? "bg-good text-white" : "bg-paper text-muted"}`} onClick={() => patch(c.id, { isStandard: !c.isStandard })}>
              стандарт
            </button>
            <button type="button" className={`rounded-md px-1.5 py-0.5 text-xs ${c.popular ? "bg-brand text-white" : "bg-paper text-muted"}`} onClick={() => patch(c.id, { popular: !c.popular })}>
              ★
            </button>
            <button
              type="button"
              className="text-xs text-muted hover:text-bad"
              aria-label="Видалити"
              onClick={() => {
                if (!confirm(`Видалити ${c.name}?`)) return;
                setList((l) => l.filter((x) => x.id !== c.id));
                start(() => deleteColor(c.id));
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {shown.length > 300 && <p className="mt-2 text-xs text-muted">Показано перші 300 — уточніть пошук.</p>}
    </div>
  );
}
