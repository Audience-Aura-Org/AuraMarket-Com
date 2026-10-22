'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, CreditCard, ShoppingBag, ListChecks, Wallet } from 'lucide-react';
import { useManagerMode } from '@/hooks/useManagerMode';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import {
  PageHeader, Scorecard, DataTable, FilterTabs, StatusDot, HEALTH_LABEL,
  EmptyState, ErrorState, Skeleton, SkeletonRows,
  formatMoney, formatNumber, formatDelta, timeAgo,
} from '@/components/manager/ui';
import AccountPanel from '@/components/manager/AccountPanel';
import { briefingHeadline, sortAccounts } from '@/components/manager/briefing';
import { TYPE_LABEL } from '@/components/manager/shell/nav';
import { TrendPanel } from '@/components/manager/RevenueTrend';

const TYPES = ['vendor', 'logistics', 'customer'];
/** This period against the larger of the two: a full bar = matched or beat last period. */
const periodRatio = (current, previous) => {
  const top = Math.max(Number(current) || 0, Number(previous) || 0);
  return top ? (Number(current) || 0) / top : 0;
};

const today = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const COLUMNS = [
  {
    key: 'name',
    header: 'Account',
    sortable: true,
    mobile: 'primary',
    render: (a) => (
      <span className="flex items-center gap-3 min-w-0">
        <span className="m-avatar m-fs-13" aria-hidden="true">{(a.name || '?').trim().charAt(0).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium max-w-[280px]" title={a.name}>{a.name}</span>
          <span className="flex items-center gap-1.5 m-fs-12 m-muted">
            <StatusDot status={a.health || 'neutral'} label={HEALTH_LABEL[a.health] || 'Status unknown'} />
            {TYPE_LABEL[a.role] || a.role}
          </span>
        </span>
      </span>
    ),
  },
  { key: 'revenue30d', header: 'Revenue 30d', align: 'right', sortable: true, mobile: 'hidden', render: (a) => formatMoney(a.revenue30d) },
  { key: 'orders30d', header: 'Orders 30d', align: 'right', sortable: true, mobile: 'hidden', render: (a) => formatNumber(a.orders30d) },
  { key: 'balance', header: 'Balance', align: 'right', sortable: true, mobile: 'hidden', render: (a) => formatMoney(a.balance) },
  {
    key: 'tasks',
    header: 'Open tasks',
    align: 'right',
    sortable: true,
    mobile: 'meta',
    render: (a) => (
      <span className={a.health === 'urgent' ? 'm-bad font-medium' : a.tasks ? 'm-warn' : 'm-faint'}>
        {a.tasks || 0}
      </span>
    ),
  },
  {
    key: 'last_activity',
    header: 'Last action',
    align: 'right',
    sortable: true,
    mobile: 'hidden',
    sortValue: (a) => (a.last_activity ? new Date(a.last_activity).getTime() : null),
    render: (a) => <span className="m-muted">{a.last_activity ? timeAgo(a.last_activity) : '—'}</span>,
  },
  {
    key: 'open',
    header: '',
    align: 'right',
    mobile: 'hidden',
    render: (a) => (
      <Link
        href={`/manager/as/${a.id}/dashboard`}
        onClick={(e) => e.stopPropagation()}
        className="m-link"
      >
        Open
      </Link>
    ),
  },
];

export default function ManagerAccountsHome() {
  const accounts = useManagerMode((s) => s.accounts);
  const accountsLoaded = useManagerMode((s) => s.loaded);
  const accountsError = useManagerMode((s) => s.error);
  const loadAccounts = useManagerMode((s) => s.loadAccounts);
  const overview = useManagerQuery('/manager/overview');

  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const sorted = useMemo(() => sortAccounts(accounts), [accounts]);
  const counts = useMemo(
    () => Object.fromEntries(TYPES.map((t) => [t, accounts.filter((a) => a.role === t).length])),
    [accounts]
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter(
      (a) =>
        (type === 'all' || a.role === type) &&
        (!q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q))
    );
  }, [sorted, query, type]);

  const totals = overview.data?.totals;
  const previous = overview.data?.previous;
  const urgent = accounts.filter((a) => a.health === 'urgent').length;
  const funded = accounts.filter((a) => Number(a.balance) > 0).length;
  const selected = accounts.find((a) => a.id === selectedId) || null;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        eyebrow={today()}
        title={accountsLoaded ? briefingHeadline(accounts) : 'Accounts'}
        subtitle={accounts.length ? `${accounts.length} managed ${accounts.length === 1 ? 'account' : 'accounts'}` : undefined}
        actions={<Link href="/manager/settings#invitations" className="m-btn">Invite account</Link>}
      />

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={overview.refetch} />
      ) : (
        <section aria-label="Totals" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {overview.loading || !totals ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-[2rem]" />)
          ) : (
            <>
              <Scorecard
                icon={CreditCard}
                tone="good"
                tag="Revenue"
                label="Revenue · 30 days"
                value={formatMoney(totals.revenue30d)}
                unit="XAF"
                progress={periodRatio(totals.revenue30d, previous?.revenue30d)}
                delta={formatDelta(totals.revenue30d, previous?.revenue30d)}
                hint="vs prior 30 days"
              />
              <Scorecard
                icon={ShoppingBag}
                tone="accent"
                tag="Live"
                label="Orders · 30 days"
                value={formatNumber(totals.orders30d)}
                progress={periodRatio(totals.orders30d, previous?.orders30d)}
                delta={formatDelta(totals.orders30d, previous?.orders30d)}
                hint="vs prior 30 days"
              />
              <Scorecard
                icon={ListChecks}
                tone={urgent ? 'bad' : 'indigo'}
                tag={urgent ? `${urgent} overdue` : 'On track'}
                label="Open tasks"
                value={formatNumber(totals.tasks)}
                progress={accounts.length ? urgent / accounts.length : 0}
                hint={urgent ? `${urgent} ${urgent === 1 ? 'account' : 'accounts'} overdue` : 'Nothing overdue'}
              />
              <Scorecard
                icon={Wallet}
                tone="accent"
                tag="Balance"
                label="Total balance"
                value={formatMoney(totals.balance)}
                unit="XAF"
                progress={accounts.length ? funded / accounts.length : 0}
                hint={`across ${totals.accounts} ${totals.accounts === 1 ? 'account' : 'accounts'}`}
              />
            </>
          )}
        </section>
      )}

      {!overview.error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {overview.loading || !totals ? (
            <>
              <Skeleton className="lg:col-span-2 h-[320px] rounded-[2rem]" />
              <Skeleton className="h-[320px] rounded-[2rem]" />
            </>
          ) : (
            <>
              <TrendPanel
                className="lg:col-span-2"
                title="Revenue growth"
                subtitle="Daily revenue across your accounts · 30 days"
                series={overview.data.trend}
                delta={formatDelta(totals.revenue30d, previous?.revenue30d)}
                deltaLabel="vs prior 30 days"
              />
              <section className="m-card p-5 md:p-6 flex flex-col" aria-label="Needs attention">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="m-headline m-fs-15">Needs attention</h2>
                  <Link href="/manager/inbox" className="m-link m-fs-12">View all</Link>
                </div>
                {overview.data.attention?.length ? (
                  <ul className="space-y-1 flex-1">
                    {overview.data.attention.map((a) => (
                      <li key={a.id}>
                        <Link href={`/manager/as/${a.id}/dashboard`} className="m-row m-row-interactive flex items-center gap-3 px-2 py-2.5">
                          <span className="m-avatar m-fs-13" aria-hidden="true">{(a.name || '?').trim().charAt(0).toUpperCase()}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold m-fs-13">{a.name}</span>
                            <span className="block m-fs-11 m-muted">{TYPE_LABEL[a.role] || a.role}</span>
                          </span>
                          <span className="m-num font-bold m-fs-13 shrink-0">{a.tasks} <span className="font-medium m-muted m-fs-11">{a.tasks === 1 ? 'task' : 'tasks'}</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--m-border)] p-6 text-center">
                    <p className="m-fs-12 m-muted">All clear — no account has open tasks.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      <section aria-label="Accounts" className="m-card overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 md:px-6 py-4 border-b border-[var(--m-border)]">
          <FilterTabs
            label="Account type"
            value={type}
            onChange={setType}
            tabs={[
              { value: 'all', label: 'All', count: accounts.length },
              ...TYPES.filter((t) => counts[t]).map((t) => ({ value: t, label: TYPE_LABEL[t], count: counts[t] })),
            ]}
          />
          <label className="relative block lg:w-[280px]">
            <span className="sr-only">Search accounts</span>
            <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 m-faint" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="m-input w-full !pl-9"
            />
          </label>
        </div>

        {!accountsLoaded ? (
          <SkeletonRows rows={6} />
        ) : accountsError ? (
          <div className="p-4"><ErrorState message={accountsError} onRetry={() => loadAccounts({ force: true })} /></div>
        ) : !accounts.length ? (
          <EmptyState
            title="No accounts yet"
            description="Accounts appear here once an admin assigns them or an owner accepts your invitation."
            action={<Link href="/manager/settings#invitations" className="m-btn m-btn-primary">Invite an account</Link>}
          />
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(a) => a.id}
            onRowClick={(a) => setSelectedId(a.id)}
            empty={<EmptyState title="No accounts match" description="Try another name or type." />}
          />
        )}
      </section>

      <AccountPanel account={selected} open={Boolean(selected)} onClose={() => setSelectedId(null)} />
    </div>
  );
}
