'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import {
  PageHeader, DataTable, FilterTabs, Scorecard, EmptyState, ErrorState, Skeleton, SkeletonRows,
  formatMoney, formatNumber,
} from '@/components/manager/ui';
import AccountPicker from '@/components/manager/AccountPicker';
import { TrendPanel } from '@/components/manager/RevenueTrend';
import { CreditCard, ShoppingBag, PackageCheck } from 'lucide-react';
import { useUrlState } from '@/components/manager/useUrlState';

const RANGES = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  { value: 'custom', label: 'Custom' },
];

const isoDay = (d) => d.toISOString().slice(0, 10);
const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/** Resolve the range control into API dates, or an inline validation message. */
function resolveRange({ range, from, to }) {
  if (range !== 'custom') {
    const days = RANGES.find((r) => r.value === range)?.days || 30;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 864e5);
    return { from: isoDay(start), to: isoDay(end) };
  }
  if (!from || !to) return { invalid: 'Choose a start and end date.' };
  if (from > to) return { invalid: 'The start date must be before the end date.' };
  return { from, to };
}

const COMPARISON = [
  {
    key: 'account',
    header: 'Account',
    sortable: true,
    mobile: 'primary',
    render: (r) => (
      <span className="flex items-center gap-3 min-w-0">
        <span className="m-avatar !size-8 m-fs-12" aria-hidden="true">{(r.account || '?').trim().charAt(0).toUpperCase()}</span>
        <span className="block truncate max-w-[220px] font-semibold" title={r.account}>{r.account || '—'}</span>
      </span>
    ),
  },
  { key: 'orders', header: 'Orders', align: 'right', sortable: true, mobile: 'secondary', render: (r) => `${formatNumber(r.orders)} orders` },
  { key: 'revenue', header: 'Revenue', align: 'right', sortable: true, mobile: 'meta', render: (r) => `${formatMoney(r.revenue)} XAF` },
  { key: 'deliveredRate', header: 'Delivered', align: 'right', sortable: true, mobile: 'hidden', render: (r) => pct(r.deliveredRate) },
  {
    key: 'cancelledRate',
    header: 'Cancelled',
    align: 'right',
    sortable: true,
    mobile: 'hidden',
    render: (r) => <span className={r.cancelledRate > 0.15 ? 'm-bad' : ''}>{pct(r.cancelledRate)}</span>,
  },
];

const MONEY = [
  { key: 'account', header: 'Account', sortable: true, mobile: 'primary', render: (r) => <span className="block truncate max-w-[220px] font-medium" title={r.account}>{r.account || '—'}</span> },
  { key: 'balance', header: 'Balance', align: 'right', sortable: true, mobile: 'meta', render: (r) => `${formatMoney(r.balance)} XAF` },
  {
    key: 'pendingWithdrawals',
    header: 'Pending withdrawals',
    align: 'right',
    sortable: true,
    mobile: 'secondary',
    render: (r) => (r.pendingWithdrawals
      ? <span className="m-warn">{r.pendingWithdrawals} · {formatMoney(r.pendingAmount)} XAF</span>
      : <span className="m-faint">None</span>),
  },
  {
    key: 'canManageMoney',
    header: 'Money access',
    mobile: 'hidden',
    render: (r) => <span className={r.canManageMoney ? '' : 'm-muted'}>{r.canManageMoney ? 'Granted' : 'Not granted'}</span>,
  },
  {
    key: 'open',
    header: '',
    align: 'right',
    mobile: 'hidden',
    render: (r) => (r.canManageMoney
      ? <Link href={r.href} onClick={(e) => e.stopPropagation()} className="m-muted hover:text-[var(--m-text)] font-medium">Open wallet</Link>
      : null),
  },
];

function OverviewTab({ url, setUrl }) {
  const range = resolveRange(url);
  const params = range.invalid ? null : { from: range.from, to: range.to, account: url.account || undefined };
  const enabled = !range.invalid;
  const rows = useManagerQuery('/manager/reports', params, { enabled });
  const series = useManagerQuery('/manager/reports/series', params, { enabled });

  const totals = useMemo(() => (rows.data || []).reduce(
    (t, r) => ({
      revenue: t.revenue + r.revenue,
      orders: t.orders + r.orders,
      delivered: t.delivered + r.delivered,
      cancelled: t.cancelled + Math.round((r.cancelledRate || 0) * r.orders),
      top: r.revenue > (t.top?.revenue || 0) ? r : t.top,
    }),
    { revenue: 0, orders: 0, delivered: 0, cancelled: 0, top: null }
  ), [rows.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterTabs label="Date range" value={url.range} onChange={(r) => setUrl({ range: r })}
          tabs={RANGES.map(({ value, label }) => ({ value, label }))} />
        <div className="flex flex-wrap items-center gap-2">
          {url.range === 'custom' && (
            <>
              <input type="date" aria-label="From" value={url.from} onChange={(e) => setUrl({ from: e.target.value })} className="m-input" />
              <span className="m-muted">to</span>
              <input type="date" aria-label="To" value={url.to} onChange={(e) => setUrl({ to: e.target.value })} className="m-input" />
            </>
          )}
          <AccountPicker mode="filter" value={url.account || null} onSelect={(id) => setUrl({ account: id })} />
        </div>
      </div>

      {range.invalid ? (
        <p role="alert" className="m-warn">{range.invalid}</p>
      ) : rows.error || series.error ? (
        <ErrorState message={rows.error || series.error} onRetry={() => { rows.refetch(); series.refetch(); }} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {rows.loading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[178px] rounded-[2rem] last:col-span-2 lg:last:col-span-1" />) : (
              <>
                <Scorecard
                  icon={CreditCard} tone="good" tag="Revenue" label="Revenue"
                  value={formatMoney(totals.revenue)} unit="XAF"
                  progress={totals.revenue && totals.top ? totals.top.revenue / totals.revenue : 0}
                  hint={totals.top ? `Top: ${totals.top.account} · ${pct(totals.top.revenue / totals.revenue)}` : 'No revenue yet'}
                />
                <Scorecard
                  icon={ShoppingBag} tone="accent" tag="Orders" label="Orders"
                  value={formatNumber(totals.orders)}
                  progress={totals.orders ? 1 - totals.cancelled / totals.orders : 0}
                  hint={`${formatNumber(totals.cancelled)} cancelled`}
                />
                <div className="col-span-2 lg:col-span-1 min-w-0 grid">
                  <Scorecard
                    icon={PackageCheck} tone="indigo" tag="Fulfilment" label="Delivered"
                    value={totals.orders ? pct(totals.delivered / totals.orders) : '—'}
                    progress={totals.orders ? totals.delivered / totals.orders : 0}
                    hint={`${formatNumber(totals.delivered)} of ${formatNumber(totals.orders)} delivered`}
                  />
                </div>
              </>
            )}
          </div>

          {series.loading
            ? <Skeleton className="h-[340px] rounded-[2rem]" />
            : <TrendPanel title="Daily revenue" subtitle="Paid revenue per day in the selected range" series={series.data || []} />}

          <section className="m-card overflow-hidden" aria-label="Accounts compared">
            <h2 className="m-headline m-fs-15 px-6 pt-5 pb-2">By account</h2>
            {rows.loading ? <SkeletonRows rows={5} /> : (
              <div className="m-scroll-x">
                <DataTable
                  columns={COMPARISON}
                  rows={rows.data || []}
                  rowKey={(r) => r.userId}
                  initialSort={{ key: 'revenue', dir: 'desc' }}
                  empty={<EmptyState title="No orders in this period" description="Vendor accounts' orders appear here." />}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MoneyTab() {
  const money = useManagerQuery('/manager/money');
  return (
    <section className="m-card overflow-hidden" aria-label="Balances">
      {money.loading ? <SkeletonRows rows={5} />
        : money.error ? <div className="p-4"><ErrorState message={money.error} onRetry={money.refetch} /></div>
        : (
          <DataTable
            columns={MONEY}
            rows={money.data || []}
            rowKey={(r) => r.userId}
            initialSort={{ key: 'balance', dir: 'desc' }}
            empty={<EmptyState title="No balances yet" />}
          />
        )}
    </section>
  );
}

function PerformanceView() {
  const [url, setUrl] = useUrlState({ tab: 'overview', range: '30d', from: '', to: '', account: '' });
  return (
    <div className="space-y-6">
      <PageHeader title="Performance" subtitle="Revenue and money across the accounts you manage" />
      <FilterTabs label="Performance" value={url.tab} onChange={(tab) => setUrl({ tab })}
        tabs={[{ value: 'overview', label: 'Overview' }, { value: 'money', label: 'Money' }]} />
      {url.tab === 'money' ? <MoneyTab /> : <OverviewTab url={url} setUrl={setUrl} />}
    </div>
  );
}

export default function PerformancePage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <PerformanceView />
    </Suspense>
  );
}
