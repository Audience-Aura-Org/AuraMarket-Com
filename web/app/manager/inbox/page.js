'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import {
  PageHeader, DataTable, FilterTabs, EmptyState, ErrorState, SkeletonRows,
  formatMoney, timeAgo,
} from '@/components/manager/ui';
import AccountPicker from '@/components/manager/AccountPicker';
import { useUrlState } from '@/components/manager/useUrlState';
import { INBOX_TABS, tasksForTab, tabCounts, ageTone, TASK_TYPE_LABEL } from '@/components/manager/inboxTabs';

const TONE = { neutral: 'm-muted', warn: 'm-warn', bad: 'm-bad' };
const humanize = (s) => String(s || '').replace(/_/g, ' ');

const ORDER_STATUSES = ['placed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refund_pending', 'refunded'];
const SHIPMENT_STATUSES = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled'];

const accountCell = (r) => <span className="block truncate max-w-[220px]" title={r.account}>{r.account || '—'}</span>;
const ageCell = (r) => <span className={`m-num ${TONE.neutral}`}>{timeAgo(r.at)}</span>;
const byDate = (r) => new Date(r.at).getTime();

const QUEUE_COLUMNS = [
  {
    key: 'title',
    header: 'Waiting on you',
    mobile: 'primary',
    render: (t) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium">{t.title}</span>
        <span className="block m-fs-12 m-muted md:hidden truncate">{TASK_TYPE_LABEL[t.type]} · {t.account}</span>
      </span>
    ),
  },
  { key: 'type', header: 'Type', mobile: 'hidden', render: (t) => <span className="m-muted">{TASK_TYPE_LABEL[t.type] || t.type}</span> },
  { key: 'account', header: 'Account', mobile: 'hidden', render: accountCell },
  {
    key: 'at',
    header: 'Waiting',
    align: 'right',
    sortable: true,
    sortValue: byDate,
    mobile: 'meta',
    render: (t) => <span className={`m-num ${TONE[ageTone(t.at)]}`}>{timeAgo(t.at)}</span>,
  },
];

const RECENT = {
  orders: {
    path: '/manager/orders',
    statuses: ORDER_STATUSES,
    columns: [
      { key: 'account', header: 'Account', sortable: true, mobile: 'primary', render: accountCell },
      { key: 'status', header: 'Status', sortable: true, mobile: 'secondary', render: (o) => <span className="capitalize m-muted">{humanize(o.status)}</span> },
      { key: 'total', header: 'Total', align: 'right', sortable: true, mobile: 'meta', render: (o) => `${formatMoney(o.total)} XAF` },
      { key: 'at', header: 'Placed', align: 'right', sortable: true, sortValue: byDate, mobile: 'hidden', render: ageCell },
    ],
    empty: 'No orders in this view.',
  },
  deliveries: {
    path: '/manager/shipments',
    statuses: SHIPMENT_STATUSES,
    columns: [
      { key: 'account', header: 'Account', sortable: true, mobile: 'primary', render: accountCell },
      { key: 'status', header: 'Status', sortable: true, mobile: 'secondary', render: (s) => <span className="capitalize m-muted">{humanize(s.status)}</span> },
      { key: 'at', header: 'Created', align: 'right', sortable: true, sortValue: byDate, mobile: 'meta', render: ageCell },
    ],
    empty: 'No deliveries in this view.',
  },
  messages: {
    path: '/manager/messages',
    columns: [
      {
        key: 'preview',
        header: 'Message',
        mobile: 'primary',
        render: (m) => (
          <span className={`block truncate max-w-[420px] ${m.unread ? 'font-medium' : 'm-muted'}`}>{m.preview || '(attachment)'}</span>
        ),
      },
      { key: 'account', header: 'Account', sortable: true, mobile: 'secondary', render: accountCell },
      { key: 'at', header: 'Received', align: 'right', sortable: true, sortValue: byDate, mobile: 'meta', render: ageCell },
    ],
    empty: 'No messages in this view.',
  },
};

function InboxView() {
  const router = useRouter();
  const [url, setUrl] = useUrlState({ tab: 'all', view: 'queue', account: '', status: '', unread: '' });
  const recent = RECENT[url.tab];
  const showRecent = url.view === 'recent' && Boolean(recent);

  const tasks = useManagerQuery('/manager/tasks', url.account ? { account: url.account } : null);
  const recentParams = { account: url.account || undefined, status: url.status || undefined, unread: url.unread || undefined };
  const list = useManagerQuery(recent?.path || '/manager/orders', recentParams, { enabled: showRecent });

  const all = tasks.data || [];
  const counts = tabCounts(all);
  const queue = tasksForTab(all, url.tab);
  const open = (row) => row.href && router.push(row.href);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle={tasks.data ? (all.length ? `${all.length} waiting across your accounts` : 'Nothing waiting on you') : undefined}
        actions={
          <AccountPicker mode="filter" value={url.account || null} onSelect={(id) => setUrl({ account: id })} />
        }
      />

      <section className="m-card overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 py-3 border-b border-[var(--m-border)]">
          <FilterTabs
            label="Inbox"
            value={url.tab}
            onChange={(tab) => setUrl({ tab, status: null, unread: null, view: RECENT[tab] ? url.view : null })}
            tabs={INBOX_TABS.map((t) => ({ value: t.value, label: t.label, count: tasks.data ? counts[t.value] : undefined }))}
          />
          {recent && (
            <div className="flex items-center gap-2">
              {showRecent && recent.statuses && (
                <select
                  value={url.status}
                  onChange={(e) => setUrl({ status: e.target.value })}
                  aria-label="Status"
                  className="m-input capitalize"
                >
                  <option value="">Any status</option>
                  {recent.statuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              )}
              {showRecent && url.tab === 'messages' && (
                <label className="flex items-center gap-2 m-muted h-10 px-2">
                  <input type="checkbox" checked={url.unread === 'true'} onChange={(e) => setUrl({ unread: e.target.checked ? 'true' : null })} />
                  Unread only
                </label>
              )}
              <FilterTabs
                label="View"
                value={url.view}
                onChange={(view) => setUrl({ view, status: null, unread: null })}
                tabs={[{ value: 'queue', label: 'Waiting' }, { value: 'recent', label: 'All recent' }]}
              />
            </div>
          )}
        </div>

        {showRecent ? (
          list.loading ? <SkeletonRows rows={6} />
            : list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.refetch} /></div>
            : (
              <DataTable
                columns={recent.columns}
                rows={list.data || []}
                rowKey={(r) => String(r.id)}
                onRowClick={open}
                empty={<EmptyState title={recent.empty} />}
              />
            )
        ) : tasks.loading ? (
          <SkeletonRows rows={6} />
        ) : tasks.error ? (
          <div className="p-4"><ErrorState message={tasks.error} onRetry={tasks.refetch} /></div>
        ) : (
          <DataTable
            columns={QUEUE_COLUMNS}
            rows={queue}
            rowKey={(t) => `${t.type}-${t.id}`}
            onRowClick={open}
            empty={
              <EmptyState
                title={all.length ? 'Nothing here' : 'Inbox zero'}
                description={all.length ? 'No items of this kind are waiting.' : 'Nothing is waiting across your accounts.'}
              />
            }
          />
        )}
      </section>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <InboxView />
    </Suspense>
  );
}
