'use client';

/** Segmented tabs with optional counts. */
export default function FilterTabs({ tabs, value, onChange, label = 'Filter' }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-[10px] m-fs-13 whitespace-nowrap border transition-colors ${
              active
                ? 'bg-[var(--m-surface-hover)] border-[var(--m-border-strong)] font-medium'
                : 'border-transparent m-muted hover:text-[var(--m-text)]'
            }`}
          >
            {tab.label}
            {tab.count != null && <span className={`m-num m-fs-12 ${active ? '' : 'm-faint'}`}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
