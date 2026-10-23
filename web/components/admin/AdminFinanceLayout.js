"use client";

import { Search, RefreshCw, Loader2, BarChart3, ShieldCheck, Wallet, Landmark, Scale, Receipt, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AdminFinance.module.css';
import StatCard from '@/components/layout/StatCard';

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
  treasury: {
    pageBg:
      'bg-[var(--bg-secondary)] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.12),transparent)]',
    headerIcon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    headerAccent: 'border-amber-500/20',
    pillActive: 'bg-amber-600 text-white shadow-sm shadow-amber-600/20',
    metricCard: 'border-amber-500/15 bg-amber-500/[0.04]',
    panel: 'border-amber-500/10 shadow-sm shadow-amber-950/5',
    inputFocus: 'focus:border-amber-500/45',
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
  'min-h-11 min-w-0 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[12px] outline-none sm:w-auto sm:min-w-[130px] sm:max-w-[220px] sm:flex-none';

export const adminInputClass =
  'min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] pl-10 pr-3 text-[12px] outline-none';

const FINANCE_PAGES = [
  { href: '/admin/escrow', label: 'Escrow & fees', icon: ShieldCheck },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Wallet },
  { href: '/admin/treasury', label: 'Treasury', icon: Landmark },
  { href: '/admin/vendor-balance', label: 'Vendor balances', icon: Scale },
  { href: '/admin/transactions', label: 'Transactions', icon: Receipt },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/logistics/earnings', label: 'Earnings', icon: Wallet },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export function AdminFinancePage({ theme = 'transactions', children }) {
  return <main className={styles.page} data-finance-theme={theme}>{children}</main>;
}

export function AdminFinanceHeader({ icon: Icon, title, description, badge, onRefresh, loading = false, children, actions, showNavigation = true }) {
  const pathname = usePathname();
  return <>
    <header className={`${styles.header} sticky top-14 lg:top-0 z-30`}>
      <div className={styles.headerInner}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && <span className={styles.headerIcon}><Icon className="size-5" aria-hidden="true" /></span>}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-base font-bold tracking-tight md:text-xl">{title}</h1>{badge != null && <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">{badge}</span>}</div>
              {description && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className={styles.iconButton} aria-label="Refresh"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>}
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </header>
    {showNavigation && <nav aria-label="Financial pages" className={`${styles.navigation} bg-[var(--bg-primary)]/65`}>
      <div className={styles.navInner}>{FINANCE_PAGES.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} className={`${styles.navLink} text-[11px]`} aria-current={pathname === href ? 'page' : undefined}><NavIcon className="size-3.5" aria-hidden="true" />{label}</Link>)}</div>
    </nav>}
  </>;
}

export function AdminFinanceBody({ children, className = '' }) {
  return <div className={`${styles.body} ${className}`}>{children}</div>;
}

export function AdminContentTabs({ value, onChange, items, label = 'Page sections' }) {
  return <div role="group" aria-label={label} className={styles.viewTabs}>
    {items.map(({ id, label: title, icon: Icon }) => <button key={id} type="button" className={`${styles.viewTab} text-[11px]`} aria-pressed={value === id} onClick={() => onChange(id)}>{Icon && <Icon className="size-4" aria-hidden="true" />}{title}</button>)}
  </div>;
}

/** Finance summaries share the dashboard card layout on every screen size. */
export function AdminMetricStrip(props) {
  return <AdminMetricGrid {...props} />;
}

export function AdminMetricGrid({ metrics = [], theme = 'transactions', columns = 4 }) {
  if (!metrics.length) return null;
  const colClass = columns === 2 || metrics.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4';
  const color = theme === 'withdrawals' ? 'emerald' : theme === 'treasury' ? 'amber' : 'indigo';
  return (
    <div className={`grid gap-3 sm:gap-4 ${colClass}`}>
      {metrics.map(({ label, value, hint, icon, ...metric }) => (
        <StatCard key={label} color={color} {...metric} label={label} value={value} footer={hint} icon={icon || BarChart3} />
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
    <div
      className={`grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center ${className}`}
    >
      {children}
    </div>
  );
}

/** Wrap paired selects side-by-side on small phones */
export function AdminFilterRow({ children, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2 sm:contents ${className}`}>{children}</div>
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
        aria-label={placeholder}
        className={`${adminInputClass} ${t.inputFocus}`}
      />
    </div>
  );
}

export function AdminFilterSelect({ value, onChange, children, className = '', theme, label }) {
  const t = theme ? useTheme(theme) : null;
  return (
    <select
      value={value}
      onChange={onChange}
      aria-label={label || 'Filter results'}
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
          : '-mx-1 snap-x snap-mandatory overflow-x-auto px-1 no-scrollbar pb-1'
      } ${className}`}
      role="group"
      aria-label="Filter by status"
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
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`text-left capitalize transition ${
              isVertical
                ? `rounded-xl px-3 py-2 text-[11px] font-medium ${
                    active ? t.pillActive : pillInactive
                  }`
                : `min-h-[40px] shrink-0 snap-start rounded-full px-3.5 py-2 text-[11px] font-medium ${
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
      className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition sm:h-10 sm:w-auto ${variants[variant]} ${className}`}
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
    variant === 'records' ? styles.entryList : variant === 'ledger'
      ? 'divide-y divide-[var(--glass-border)]'
      : variant === 'queue'
        ? 'space-y-1.5 p-2 sm:space-y-2 sm:p-4'
        : 'space-y-2 p-2 sm:p-4';

  return (
    <section
      className={styles.panel}
    >

      <div className={styles.panelHeader}>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {countLabel != null && (
          <span className="max-w-[55%] truncate rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-secondary)] sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[10px]">
            {countLabel}
          </span>
        )}
      </div>

      {filterSlot && (
        <div className={`${styles.filterArea} space-y-3`}>
          {filterSlot}
        </div>
      )}

      {listHeader}

      {loading ? (
        <AdminListLoading message={loadingMessage} theme={theme} />
      ) : isEmpty ? (
        <AdminListEmpty icon={EmptyIcon} message={emptyMessage} action={emptyAction} />
      ) : (
        <div className={(variant === 'ledger' || variant === 'records') ? listBodyClass : `${listBodyClass} p-3 sm:p-4`}>
          {children}
        </div>
      )}

      {footer && !loading && (
        <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/15 px-2 py-2 sm:px-4 sm:py-3">
          {footer}
        </div>
      )}
    </section>
  );
}

export function AdminLedgerTableHeader({ columns = [] }) {
  if (!columns.length) return null;
  return (
    <div className="hidden border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 sm:grid sm:grid-cols-[minmax(0,1fr)_120px_110px_36px] sm:gap-3 sm:px-4 sm:py-2">
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
