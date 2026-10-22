'use client';

import { Suspense, useMemo, useState } from 'react';
import { Check, Trash2, BellRing } from 'lucide-react';
import api from '@/services/api';
import { useManagerMode } from '@/hooks/useManagerMode';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import {
  PageHeader, DataTable, FilterTabs, EmptyState, ErrorState, SkeletonRows, timeAgo,
} from '@/components/manager/ui';
import AccountPicker from '@/components/manager/AccountPicker';
import { useUrlState } from '@/components/manager/useUrlState';

const MAX_NOTE = 2000;
const CATEGORIES = ['products', 'orders', 'messages', 'money', 'profile', 'other'];
const formatWhen = (d) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function NoteComposer({ defaultAccount, onSaved }) {
  const [body, setBody] = useState('');
  const [account, setAccount] = useState(defaultAccount || null);
  const [remindAt, setRemindAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/manager/notes', {
        body: body.trim(),
        ...(account ? { user_id: account } : {}),
        ...(remindAt ? { remind_at: new Date(remindAt).toISOString() } : {}),
      });
      setBody('');
      setRemindAt('');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="m-card p-5 md:p-6 space-y-3">
      <label className="sr-only" htmlFor="note-body">New note</label>
      <textarea
        id="note-body"
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_NOTE))}
        rows={3}
        placeholder="Write a note or a reminder"
        className="m-input w-full !h-auto !py-2.5 resize-y"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <AccountPicker mode="filter" value={account} onSelect={setAccount} />
          <label className="flex items-center gap-2">
            <span className="sr-only">Remind me at</span>
            <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className="m-input" />
          </label>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <span className="m-num m-fs-12 m-faint">{body.length}/{MAX_NOTE}</span>
          <button type="submit" className="m-btn m-btn-primary" disabled={saving || !body.trim()}>Save note</button>
        </div>
      </div>
      {error && <p role="alert" className="m-bad">{error}</p>}
    </form>
  );
}

function NoteRow({ note, accountName, onToggle, onDelete }) {
  const due = note.remind_at && !note.done && new Date(note.remind_at) <= new Date();
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={note.done ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={note.done}
        className={`mt-0.5 size-5 shrink-0 rounded-md border flex items-center justify-center ${
          note.done ? 'bg-[var(--m-good)] border-transparent text-white' : 'border-[var(--m-border-strong)] hover:border-[var(--m-good)]'
        }`}
      >
        {note.done && <Check size={12} strokeWidth={2} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`whitespace-pre-wrap break-words ${note.done ? 'm-faint line-through' : ''}`}>{note.body}</p>
        <p className="m-fs-12 m-muted mt-1 flex flex-wrap gap-x-2">
          {accountName && <span>{accountName}</span>}
          {note.remind_at && (
            <span className={`inline-flex items-center gap-1 ${due ? 'm-warn' : ''}`}>
              <BellRing size={12} strokeWidth={1.5} aria-hidden="true" />
              {formatWhen(note.remind_at)}
            </span>
          )}
          <span>{timeAgo(note.createdAt)} ago</span>
        </p>
      </div>
      <button type="button" onClick={onDelete} aria-label="Delete note" className="p-2 -m-1 m-faint hover:text-[var(--m-bad)]">
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </li>
  );
}

function NotesTab({ account }) {
  const accounts = useManagerMode((s) => s.accounts);
  const names = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const notes = useManagerQuery('/manager/notes', account ? { account } : null);
  const [overrides, setOverrides] = useState({});
  const [actionError, setActionError] = useState(null);

  const list = (notes.data || []).map((n) => (n._id in overrides ? { ...n, done: overrides[n._id] } : n));
  const now = new Date();
  const groups = [
    ['Due', list.filter((n) => !n.done && n.remind_at && new Date(n.remind_at) <= now)],
    ['Upcoming', list.filter((n) => !n.done && !(n.remind_at && new Date(n.remind_at) <= now))],
    ['Done', list.filter((n) => n.done)],
  ];

  const toggle = async (note) => {
    const done = !note.done;
    setOverrides((o) => ({ ...o, [note._id]: done }));
    setActionError(null);
    try {
      await api.patch(`/manager/notes/${note._id}`, { done });
      await notes.refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update the note.');
    } finally {
      setOverrides(({ [note._id]: _drop, ...rest }) => rest);
    }
  };

  const remove = async (note) => {
    if (!window.confirm('Delete this note?')) return;
    setActionError(null);
    try {
      await api.delete(`/manager/notes/${note._id}`);
      notes.refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not delete the note.');
    }
  };

  return (
    <div className="space-y-6">
      <NoteComposer key={account || 'all'} defaultAccount={account} onSaved={notes.refetch} />
      {actionError && <p role="alert" className="m-bad">{actionError}</p>}
      {notes.loading ? (
        <div className="m-card"><SkeletonRows rows={4} /></div>
      ) : notes.error ? (
        <ErrorState message={notes.error} onRetry={notes.refetch} />
      ) : !list.length ? (
        <div className="m-card"><EmptyState title="No notes yet" description="Notes and reminders you write appear here." /></div>
      ) : (
        groups.filter(([, items]) => items.length).map(([title, items]) => (
          <section key={title} aria-label={title}>
            <h2 className="m-eyebrow mb-2">{title} · {items.length}</h2>
            <ul className="m-card m-divide">
              {items.map((n) => (
                <NoteRow
                  key={n._id}
                  note={n}
                  accountName={n.user_id ? names.get(String(n.user_id)) || 'Former account' : null}
                  onToggle={() => toggle(n)}
                  onDelete={() => remove(n)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

const ACTIVITY_COLUMNS = [
  {
    key: 'at',
    header: 'When',
    sortable: true,
    sortValue: (r) => new Date(r.at).getTime(),
    mobile: 'meta',
    render: (r) => <span className="m-num m-muted whitespace-nowrap">{formatWhen(r.at)}</span>,
  },
  { key: 'account', header: 'Account', sortable: true, mobile: 'primary', render: (r) => <span className="block truncate max-w-[200px]">{r.account || '—'}</span> },
  { key: 'category', header: 'Area', sortable: true, mobile: 'hidden', render: (r) => <span className="capitalize m-muted">{r.category}</span> },
  {
    key: 'action',
    header: 'Action',
    mobile: 'secondary',
    render: (r) => <code className="m-fs-12 break-all">{r.action}</code>,
  },
  { key: 'fields', header: 'Fields changed', mobile: 'hidden', render: (r) => <span className="m-muted">{r.fields || '—'}</span> },
];

function ActivityTab({ account, category, setUrl }) {
  const activity = useManagerQuery('/manager/activity', {
    account: account || undefined,
    category: category || undefined,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => setUrl({ category: e.target.value })} aria-label="Area" className="m-input capitalize">
          <option value="">All areas</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <section className="m-card overflow-hidden" aria-label="Activity log">
        {activity.loading ? <SkeletonRows rows={6} />
          : activity.error ? <div className="p-4"><ErrorState message={activity.error} onRetry={activity.refetch} /></div>
          : (
            <DataTable
              columns={ACTIVITY_COLUMNS}
              rows={activity.data || []}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No activity yet" description="Every change you make while working in an account is logged here." />}
            />
          )}
      </section>
    </div>
  );
}

function JournalView() {
  const [url, setUrl] = useUrlState({ tab: 'notes', account: '', category: '' });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & Activity"
        subtitle="Your reminders, and a record of every change made on your accounts"
        actions={<AccountPicker mode="filter" value={url.account || null} onSelect={(id) => setUrl({ account: id })} />}
      />
      <FilterTabs label="Journal" value={url.tab} onChange={(tab) => setUrl({ tab })}
        tabs={[{ value: 'notes', label: 'Notes' }, { value: 'activity', label: 'Activity' }]} />
      {url.tab === 'activity'
        ? <ActivityTab account={url.account} category={url.category} setUrl={setUrl} />
        : <NotesTab account={url.account} />}
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <JournalView />
    </Suspense>
  );
}
