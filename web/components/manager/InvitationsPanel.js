'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/services/api';
import { useManagerMode } from '@/hooks/useManagerMode';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import { EmptyState, ErrorState, SkeletonRows, timeAgo } from '@/components/manager/ui';
import { TYPE_LABEL } from '@/components/manager/shell/nav';

const PERMISSIONS = [
  ['products', 'Products'],
  ['orders', 'Orders'],
  ['messages', 'Messages'],
  ['money', 'Money'],
  ['profile', 'Profile'],
];
const DEFAULT_PERMS = { products: true, orders: true, messages: true, money: false, profile: true };
const STATUS_LABEL = { pending: 'Pending', declined: 'Declined', active: 'Active' };

const granted = (p = {}) => PERMISSIONS.filter(([k]) => p[k]).map(([, l]) => l).join(', ') || 'View only';

/** Incoming requests, sent invitations, and the invite form. */
export default function InvitationsPanel() {
  const invitations = useManagerQuery('/manager/invitations');
  const loadAccounts = useManagerMode((s) => s.loadAccounts);
  const ref = useRef(null);
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState(null);
  const [respondingId, setRespondingId] = useState(null);
  const [respondError, setRespondError] = useState(null);

  // Arriving via /manager/settings#invitations: scroll once content exists.
  useEffect(() => {
    if (invitations.data && typeof window !== 'undefined' && window.location.hash === '#invitations') {
      ref.current?.scrollIntoView({ block: 'start' });
    }
  }, [invitations.data]);

  const rows = invitations.data || [];
  const incoming = rows.filter((r) => r.direction === 'incoming' && r.status === 'pending');
  const sent = rows.filter((r) => r.direction !== 'incoming' || r.status !== 'pending');

  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setFormMsg(null);
    try {
      await api.post('/manager/invitations', { email: email.trim(), permissions: perms });
      setEmail('');
      setPerms(DEFAULT_PERMS);
      setFormMsg({ tone: 'good', text: 'Invitation sent. The account owner needs to accept it.' });
      invitations.refetch();
    } catch (err) {
      setFormMsg({ tone: 'bad', text: err.response?.data?.message || 'Could not send the invitation.' });
    } finally {
      setSending(false);
    }
  };

  const respond = async (id, accept) => {
    setRespondingId(id);
    setRespondError(null);
    try {
      await api.post(`/manager/invitations/${id}/respond`, { accept });
      await invitations.refetch();
      if (accept) loadAccounts({ force: true });
    } catch (err) {
      setRespondError(err.response?.data?.message || 'Could not respond to the invitation.');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <section id="invitations" ref={ref} aria-labelledby="invitations-title" className="scroll-mt-20 space-y-4">
      <div>
        <h2 id="invitations-title" className="m-headline m-fs-15">Invitations</h2>
        <p className="m-muted mt-1">Ask an account owner to let you manage their account, or accept their request.</p>
      </div>

      {invitations.loading ? (
        <div className="m-card"><SkeletonRows rows={3} /></div>
      ) : invitations.error ? (
        <ErrorState message={invitations.error} onRetry={invitations.refetch} />
      ) : (
        <>
          {incoming.length > 0 && (
            <div className="m-card">
              <h3 className="m-eyebrow px-4 pt-4">Waiting for you · {incoming.length}</h3>
              <ul className="m-divide mt-2">
                {incoming.map((inv) => (
                  <li key={inv.id} className="flex flex-col gap-3 sm:flex-row sm:items-center px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{inv.from || inv.email}</p>
                      <p className="m-fs-12 m-muted truncate">
                        {[inv.email, TYPE_LABEL[inv.role], granted(inv.permissions)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" className="m-btn" disabled={respondingId === inv.id} onClick={() => respond(inv.id, false)}>Decline</button>
                      <button type="button" className="m-btn m-btn-primary" disabled={respondingId === inv.id} onClick={() => respond(inv.id, true)}>Accept</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {respondError && <p role="alert" className="m-bad">{respondError}</p>}

          <div className="m-card">
            <h3 className="m-eyebrow px-4 pt-4">Sent</h3>
            {sent.length ? (
              <ul className="m-divide mt-2">
                {sent.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{inv.email || inv.from}</p>
                      <p className="m-fs-12 m-muted truncate">{granted(inv.permissions)}</p>
                    </div>
                    <span className={`m-fs-12 shrink-0 ${inv.status === 'declined' ? 'm-bad' : 'm-muted'}`}>
                      {STATUS_LABEL[inv.status] || inv.status} · {timeAgo(inv.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No invitations sent" />
            )}
          </div>
        </>
      )}

      <form onSubmit={send} className="m-card p-4 space-y-4" aria-label="Invite an account">
        <h3 className="m-eyebrow">Invite an account</h3>
        <label className="block">
          <span className="block m-fs-12 m-muted mb-1.5">Account owner's email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            className="m-input w-full"
          />
        </label>
        <fieldset>
          <legend className="m-fs-12 m-muted mb-2">What you're asking to manage</legend>
          <div className="flex flex-wrap gap-2">
            {PERMISSIONS.map(([key, label]) => (
              <label key={key} className={`m-btn cursor-pointer ${perms[key] ? '!border-[var(--m-border-strong)] !bg-[var(--m-surface-hover)]' : 'm-muted'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={perms[key]}
                  onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="m-fs-12 m-faint mt-2">Money access lets you withdraw and move funds; the owner is notified of every money action.</p>
        </fieldset>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {formMsg ? <p role="status" className={formMsg.tone === 'good' ? 'm-good' : 'm-bad'}>{formMsg.text}</p> : <span />}
          <button type="submit" className="m-btn m-btn-primary" disabled={sending || !email.trim()}>Send invitation</button>
        </div>
      </form>
    </section>
  );
}
