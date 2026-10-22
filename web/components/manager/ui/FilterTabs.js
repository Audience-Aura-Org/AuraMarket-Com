'use client';

/** Segmented tabs with optional counts. */
export default function FilterTabs({ tabs, value, onChange, label = 'Filter' }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-full m-fs-12 font-semibold whitespace-nowrap border transition-all ${
              active
                ? 'bg-[var(--accent)] border-transparent text-white shadow-[0_6px_18px_color-mix(in_srgb,var(--accent)_25%,transparent)]'
                : 'bg-[var(--m-surface)] border-[var(--m-border)] m-muted hover:text-[var(--accent)] hover:border-[var(--m-border-strong)]'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`m-num m-fs-11 rounded-full px-1.5 min-w-[20px] text-center ${active ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
