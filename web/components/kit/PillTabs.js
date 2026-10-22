'use client';

/** Pill toggles (vendor style). tabs: [{ value, label, count? }] */
export default function PillTabs({ tabs, value, onChange, label = 'Filter', className = '' }) {
  return (
    <div role="tablist" aria-label={label} className={`-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 no-scrollbar ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[11px] lg:text-[12px] font-semibold transition-colors ${
              active
                ? 'border-transparent bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/25'
                : 'border-[var(--glass-border)] bg-[var(--bg-primary)]/70 text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)]'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`min-w-[20px] rounded-full px-1.5 text-center text-[10px] tabular-nums ${active ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
