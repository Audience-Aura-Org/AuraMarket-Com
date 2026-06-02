"use client";

import { Search, RefreshCw, Loader2 } from 'lucide-react';

export const ADMIN_THEMES = {
  withdrawals: {
    pageBg:
      'bg-[var(--bg-secondary)] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]',
    headerIcon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    headerAccent: 'border-emerald-500/20',
    pillActive: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20',
    metricCard: 'border-emerald-500/15 bg-emerald-500/[0.04]',
    panel: 'border-emerald-500/10 shadow-sm shadow-emerald-950/5',
    inputFocus: 'focus:border-emerald-500/45',
  },
  transactions: {
    pageBg:
      'bg-[var(--bg-secondary)] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.14),transparent)]',
    headerIcon: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    headerAccent: 'border-indigo-500/20',
    pillActive: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20',
    metricCard: 'border-indigo-500/15 bg-indigo-500/[0.04]',
    panel: 'border-indigo-500/10 shadow-sm shadow-indigo-950/5',
    inputFocus: 'focus:border-indigo-500/45',
  },
};

const pillInactive =
  'border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 text-[var(--text-secondary)] hover:border-[var(--glass-border)] hover:bg-[var(--bg-primary)]';

function useTheme(theme) {
  return ADMIN_THEMES[theme] || ADMIN_THEMES.transactions;
}

export const adminSelectClass =
  'h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 px-3 text-[12px] outline-none sm:min-w-[130px]';

export const adminInputClass =
  'h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 pl-9 pr-3 text-[12px] outline-none';

export function AdminFinancePage({ theme = 'transactions', children }) {
  const t = useTheme(theme);
  return (
    <main className={`min-h-screen font-[Poppins] text-[var(--text-primary)] ${t.pageBg}`}>
      {children}
    </main>
  );
}

export function AdminFinanceHeader({
  theme = 'transactions',
  icon: Icon,
  title,
  description,
  badge,
  onRefresh,
  loading = false,
  embedRefreshInToolbar = false,
  children,
}) {
  const t = useTheme(theme);
  return (
    <header
      className={`sticky top-0 z-40 border-b bg-[var(--bg-primary)]/90 backdrop-blur-md ${t.headerAccent}`}
    >
      <div className="mx-auto max-w-7xl space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${t.headerIcon}`}
              >
                <Icon className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
                {badge != null && (
                  <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
                    {badge}
                  </span>
                )}
              </div>
              {description && (
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{description}</p>
              )}
            </div>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] sm:hidden"
              aria-label="Refresh"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {children}

        {onRefresh && !embedRefreshInToolbar && (
          <div className="hidden sm:flex sm:justify-end">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function AdminFinanceBody({ children, className = '' }) {
  return (
    <div className={`mx-auto max-w-7xl space-y-4 px-3 py-4 pb-28 sm:px-5 sm:py-5 ${className}`}>
      {children}
    </div>
  );
}

/** Compact single-row strip */
export function AdminMetricStrip({ metrics = [], theme = 'transactions' }) {
  const t = useTheme(theme);
  if (!metrics.length) return null;
  return (
    <div
      className={`flex w-full items-stretch divide-x divide-[var(--glass-border)] overflow-hidden rounded-2xl border bg-[var(--bg-primary)]/95 ${t.panel}`}
    >
      {metrics.map(({ label, value }) => (
        <div
          key={label}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-3 text-center sm:flex-row sm:gap-1.5"
        >
          <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
          <span className="text-[11px] font-semibold tabular-nums sm:text-[12px]">{value}</span>
        </div>
      ))}
    </div>
  );
}

/** Individual metric cards — better for many KPIs */
export function AdminMetricGrid({ metrics = [], theme = 'transactions', columns = 5 }) {
  const t = useTheme(theme);
  if (!metrics.length) return null;
  const colClass =
    columns === 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : columns === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';
  return (
    <div className={`grid gap-2 ${colClass}`}>
      {metrics.map(({ label, value, hint }) => (
        <div
          key={label}
          className={`rounded-2xl border px-3 py-2.5 ${t.metricCard} bg-[var(--bg-primary)]/95`}
        >
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</p>
          <p className="mt-0.5 truncate text-[12px] font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 text-[9px] text-[var(--text-secondary)]/80">{hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function AdminAlertBanner({ theme = 'withdrawals', children, onAction, actionLabel }) {
  const styles =
    theme === 'withdrawals'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100'
      : 'border-indigo-500/30 bg-indigo-500/10';
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${styles}`}>
      <div className="text-[11px] font-medium">{children}</div>
      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-lg bg-[var(--bg-primary)] px-3 py-1.5 text-[10px] font-semibold shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function AdminFilterToolbar({ children, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      {children}
    </div>
  );
}

export function AdminFilterSearch({
  theme = 'transactions',
  value,
  onChange,
  onSubmit,
  placeholder = 'Search…',
  className = 'flex-1 sm:min-w-[200px]',
}) {
  const t = useTheme(theme);
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onSubmit ? (e) => e.key === 'Enter' && onSubmit() : undefined}
        placeholder={placeholder}
        className={`${adminInputClass} ${t.inputFocus}`}
      />
    </div>
  );
}

export function AdminFilterSelect({ value, onChange, children, className = '', theme }) {
  const t = theme ? useTheme(theme) : null;
  return (
    <select
      value={value}
      onChange={onChange}
      className={`${adminSelectClass} ${t ? t.inputFocus : ''} ${className}`}
    >
      {children}
    </select>
  );
}

export function AdminFilterPills({
  items = [],
  value,
  onChange,
  theme = 'transactions',
  className = '',
  layout = 'horizontal',
}) {
  const t = useTheme(theme);
  const isVertical = layout === 'vertical';
  return (
    <div
      className={`flex gap-1.5 ${
        isVertical
          ? 'flex-col'
          : 'overflow-x-auto no-scrollbar pb-0.5'
      } ${className}`}
      role="tablist"
    >
      {items.map((item) => {
        const id = typeof item === 'string' ? item : item.id;
        const label =
          typeof item === 'string'
            ? item
            : item.badge != null && item.badge > 0
              ? `${item.label} (${item.badge})`
              : item.label;
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`text-left capitalize transition ${
              isVertical
                ? `rounded-xl px-3 py-2 text-[11px] font-medium ${
                    active ? t.pillActive : pillInactive
                  }`
                : `shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium ${
                    active ? t.pillActive : pillInactive
                  }`
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminFilterButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  theme = 'transactions',
  className = '',
}) {
  const t = useTheme(theme);
  const variants = {
    primary: `${t.pillActive} disabled:opacity-50`,
    secondary:
      'border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminListPanel({
  theme = 'transactions',
  title,
  countLabel,
  filterSlot,
  loading = false,
  loadingMessage = 'Loading…',
  isEmpty = false,
  emptyIcon: EmptyIcon,
  emptyMessage = 'No results found.',
  emptyAction,
  footer,
  listHeader,
  variant = 'cards',
  children,
}) {
  const t = useTheme(theme);
  const listBodyClass =
    variant === 'ledger'
      ? 'divide-y divide-[var(--glass-border)]'
      : variant === 'queue'
        ? 'space-y-2'
        : 'space-y-2 p-3 sm:p-4';

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-[var(--bg-primary)]/95 ${t.panel}`}
    >
      {filterSlot && (
        <div className="space-y-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 sm:p-4">
          {filterSlot}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2.5 sm:px-4">
        <p className="text-[12px] font-semibold">{title}</p>
        {countLabel != null && (
          <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
            {countLabel}
          </span>
        )}
      </div>

      {listHeader}

      {loading ? (
        <AdminListLoading message={loadingMessage} theme={theme} />
      ) : isEmpty ? (
        <AdminListEmpty icon={EmptyIcon} message={emptyMessage} action={emptyAction} />
      ) : (
        <div className={variant === 'ledger' ? listBodyClass : `${listBodyClass} p-3 sm:p-4`}>
          {children}
        </div>
      )}

      {footer && !loading && (
        <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/15 px-3 py-3 sm:px-4">
          {footer}
        </div>
      )}
    </section>
  );
}

export function AdminLedgerTableHeader({ columns = [] }) {
  if (!columns.length) return null;
  return (
    <div className="hidden border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 sm:grid sm:grid-cols-[minmax(0,1fr)_100px_120px_80px] sm:gap-3 sm:px-4 sm:py-2">
      {columns.map((col) => (
        <span
          key={col}
          className={`text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] ${
            col === 'Amount' || col === 'Status' ? 'text-right' : ''
          }`}
        >
          {col}
        </span>
      ))}
    </div>
  );
}

export function AdminListLoading({ message = 'Loading…', theme = 'transactions' }) {
  const color = theme === 'withdrawals' ? 'text-emerald-600' : 'text-indigo-600';
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Loader2 className={`size-8 animate-spin ${color}`} />
      <p className="text-[11px] text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}

export function AdminListEmpty({ icon: Icon, message, action }) {
  return (
    <div className="px-6 py-20 text-center">
      {Icon && <Icon className="mx-auto mb-3 size-9 text-[var(--text-secondary)]/35" />}
      <p className="text-sm font-medium text-[var(--text-secondary)]">{message}</p>
      {action}
    </div>
  );
}

export function AdminFinanceSplit({ sidebar, children }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(140px,180px)_minmax(0,1fr)] lg:items-start">
      <aside className="hidden lg:block">{sidebar}</aside>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

export function AdminSidebarCard({ title, children, theme = 'withdrawals' }) {
  const t = useTheme(theme);
  return (
    <div className={`rounded-2xl border bg-[var(--bg-primary)]/95 p-3 ${t.panel}`}>
      {title && (
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
