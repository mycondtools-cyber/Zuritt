/** Кнопка-підказка: показується при наведенні та при тапі (focus) на мобільних */
export function Hint({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={text}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-white text-[11px] font-bold text-muted hover:border-brand hover:text-brand focus:border-brand focus:text-brand focus:outline-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-60 max-w-[80vw] -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
