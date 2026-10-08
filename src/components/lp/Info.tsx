export function Info({ tip }: { tip: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        aria-label={tip}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-primary/50 text-[10px] font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
      >
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs font-normal normal-case leading-snug text-popover-foreground opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100">
        {tip}
      </span>
    </span>
  );
}

export function Label({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="mb-1.5 flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      <Info tip={tip} />
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border bg-input/40 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/30";

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50";
