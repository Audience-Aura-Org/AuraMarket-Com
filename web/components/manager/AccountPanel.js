'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import api from '@/services/api';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import {
  SidePanel, StatusDot, HEALTH_LABEL, ErrorState, SkeletonRows,
  formatMoney, formatNumber, timeAgo,
} from '@/components/manager/ui';
import { TYPE_LABEL, describePermissions } from '@/components/manager/shell/nav';

function Section({ title, children }) {
  return (
    <section className="pt-5">
      <h3 className="m-eyebrow mb-2">{title}</h3>
      {children}
    </section>
  );
}

/** Account detail: metrics, open tasks, access, notes, and the way in. */
export default function AccountPanel({ account, open, onClose }) {
  const id = account?.id;
  const enabled = open && Boolean(id);
  const tasks = useManagerQuery('/manager/tasks', id ? { account: id } : null, { enabled });
  const notes = useManagerQuery('/manager/notes', id ? { account: id } : null, { enabled });
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState(null);

  const addNote = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    setNoteError(null);
    try {
      await api.post('/manager/notes', { body: draft.trim(), user_id: id });
      setDraft('');
      notes.refetch();
    } catch (err) {
      setNoteError(err.response?.data?.message || 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={account?.name || 'Account'}
      footer={
        account && (
          <Link href={`/manager/as/${account.id}/dashboard`} className="m-btn m-btn-primary w-full !min-h-11">
            Open workspace <ArrowUpRight size={16} strokeWidth={1.5} />
          </Link>
        )
      }
    >
      {account && (
        <>
          <div className="flex items-center gap-2 m-muted">
            <StatusDot status={account.health || 'neutral'} label={HEALTH_LABEL[account.health] || 'Status unknown'} />
            <span>{HEALTH_LABEL[account.health] || 'On track'}</span>
            <span aria-hidden="true">·</span>
            <span>{TYPE_LABEL[account.role] || account.role}</span>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['Revenue 30d', formatMoney(account.revenue30d)],
              ['Orders 30d', formatNumber(account.orders30d)],
              ['Balance', formatMoney(account.balance)],
            ].map(([label, value]) => (
              <div key={label} className="m-card px-3 py-2.5">
                <dt className="m-fs-11 m-muted">{label}</dt>
                <dd className="m-num font-medium m-fs-15 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>

          <Section title={`Open tasks${account.tasks ? ` · ${account.tasks}` : ''}`}>
            {tasks.loading ? (
              <SkeletonRows rows={3} />
            ) : tasks.error ? (
              <ErrorState message={tasks.error} onRetry={tasks.refetch} />
            ) : !tasks.data?.length ? (
              <p className="m-muted">Nothing waiting on this account.</p>
            ) : (
              <ul className="m-divide">
                {tasks.data.slice(0, 8).map((t) => (
                  <li key={`${t.type}-${t.id}`}>
                    <Link href={t.href} className="flex items-center justify-between gap-3 py-2.5 hover:text-[var(--m-text)]">
                      <span className="truncate">{t.title}</span>
                      <span className="m-num m-fs-12 m-muted shrink-0">{timeAgo(t.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Access">
            <p>{describePermissions(account.permissions)}</p>
            <p className="m-muted mt-1">
              {account.expires_at ? `Expires ${new Date(account.expires_at).toLocaleDateString()}` : 'No expiry'}
              {account.last_activity ? ` · last action ${timeAgo(account.last_activity)} ago` : ''}
            </p>
          </Section>

          <Section title="Notes">
            <form onSubmit={addNote} className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                placeholder="Add a note about this account"
                aria-label="New note"
                className="m-input flex-1 min-w-0"
              />
              <button type="submit" className="m-btn" disabled={saving || !draft.trim()}>Add</button>
            </form>
            {noteError && <p className="m-bad mt-2">{noteError}</p>}
            {notes.data?.length > 0 && (
              <ul className="mt-3 m-divide">
                {notes.data.slice(0, 5).map((n) => (
                  <li key={n._id} className={`py-2.5 ${n.done ? 'm-faint line-through' : ''}`}>
                    <p className="whitespace-pre-wrap break-words">{n.body}</p>
                    <p className="m-fs-11 m-muted mt-0.5">{timeAgo(n.createdAt)} ago</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/manager/journal?account=${account.id}`} className="inline-block mt-3 m-muted hover:text-[var(--m-text)]">
              All notes for this account
            </Link>
          </Section>
        </>
      )}
    </SidePanel>
  );
}
