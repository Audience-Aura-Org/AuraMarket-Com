'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
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

const TYPES = ['vendor', 'logistics', 'customer'];
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
        <StatusDot status={a.health || 'neutral'} label={HEALTH_LABEL[a.health] || 'Status unknown'} />
        <span className="min-w-0">
          <span className="block truncate font-medium max-w-[280px]" title={a.name}>{a.name}</span>
          <span className="block m-fs-12 m-muted">{TYPE_LABEL[a.role] || a.role}</span>
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
        className="m-muted hover:text-[var(--m-text)] font-medium"
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
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-[16px]" />)
          ) : (
            <>
              <Scorecard
                label="Revenue · 30 days"
                value={formatMoney(totals.revenue30d)}
                unit="XAF"
                delta={formatDelta(totals.revenue30d, previous?.revenue30d)}
                hint="vs prior 30 days"
                series={overview.data.trend?.map((d) => d.revenue)}
              />
              <Scorecard
                label="Orders · 30 days"
                value={formatNumber(totals.orders30d)}
                delta={formatDelta(totals.orders30d, previous?.orders30d)}
                hint="vs prior 30 days"
              />
              <Scorecard
                label="Open tasks"
                value={formatNumber(totals.tasks)}
                hint={urgent ? `${urgent} ${urgent === 1 ? 'account' : 'accounts'} overdue` : 'Nothing overdue'}
              />
              <Scorecard
                label="Total balance"
                value={formatMoney(totals.balance)}
                unit="XAF"
                hint={`across ${totals.accounts} ${totals.accounts === 1 ? 'account' : 'accounts'}`}
              />
            </>
          )}
        </section>
      )}

      <section aria-label="Accounts" className="m-card overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 py-3 border-b border-[var(--m-border)]">
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
