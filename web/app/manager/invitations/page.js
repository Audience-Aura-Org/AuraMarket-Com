'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, Send, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/services/api';

const PERMISSION_KEYS = ['products', 'orders', 'messages', 'money', 'profile'];

const STATUS_STYLES = {
  pending:  { color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Pending' },
  declined: { color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Declined' },
  accepted: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Accepted' },
};

export default function ManagerInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/invitations');
      setInvitations(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load invitations:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sendInvitation = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/manager/invitations', {
        email: email.trim(),
        permissions,
      });
      setEmail('');
      setPermissions({});
      fetchInvitations();
    } catch (err) {
      console.error('[Manager] Failed to send invitation:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const respondToInvite = async (id, accept) => {
    setRespondingId(id);
    try {
      await api.post(`/manager/invitations/${id}/respond`, { accept });
      fetchInvitations();
    } catch (err) {
      console.error('[Manager] Failed to respond to invitation:', err.message);
    } finally {
      setRespondingId(null);
    }
  };

  const incoming = invitations.filter((inv) => inv.direction === 'incoming');
  const outgoing = invitations.filter((inv) => inv.direction !== 'incoming');

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Invitations
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage account access invitations
          </p>
        </div>
        <button
          onClick={fetchInvitations}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Send Invitation */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={sendInvitation}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm space-y-4"
      >
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          Send New Invitation
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Permission Checkboxes */}
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-2">Permissions</label>
          <div className="flex flex-wrap gap-3">
            {PERMISSION_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={!!permissions[key]}
                  onChange={() => togglePermission(key)}
                  className="w-4 h-4 rounded border-[var(--glass-border)] accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-secondary)] capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>
      </motion.form>

      {/* Incoming Invitations */}
      {incoming.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Incoming Invitations</h2>
          <div className="space-y-2">
            {incoming.map((inv, i) => {
              const style = STATUS_STYLES[inv.status] || STATUS_STYLES.pending;
              return (
                <motion.div
                  key={inv.id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div>
                    <p className="text-sm text-[var(--text-primary)] font-medium">{inv.email || inv.from || '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.color}`}>
                        {style.label}
                      </span>
                      {inv.permissions && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {Object.keys(inv.permissions).filter((k) => inv.permissions[k]).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  {inv.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => respondToInvite(inv.id, true)}
                        disabled={respondingId === inv.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => respondToInvite(inv.id, false)}
                        disabled={respondingId === inv.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Outgoing / All Invitations */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl overflow-hidden backdrop-blur-sm"
      >
        <div className="px-5 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {incoming.length > 0 ? 'Sent Invitations' : 'All Invitations'}
          </h2>
        </div>

        {loading && (
          <p className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">Loading...</p>
        )}
        {!loading && outgoing.length === 0 && incoming.length === 0 && (
          <p className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">No invitations yet</p>
        )}

        <div className="divide-y divide-[var(--glass-border)]">
          {(incoming.length > 0 ? outgoing : invitations).map((inv, i) => {
            const style = STATUS_STYLES[inv.status] || STATUS_STYLES.pending;
            return (
              <motion.div
                key={inv.id || i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{inv.email || '—'}</p>
                  {inv.permissions && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {Object.keys(inv.permissions).filter((k) => inv.permissions[k]).join(', ') || 'No permissions'}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.color}`}>
                  {style.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
