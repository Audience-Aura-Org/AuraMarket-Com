'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { StickyNote, RefreshCw, Plus, Trash2, CheckSquare, Square, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';

export default function ManagerNotes() {
  const [notes, setNotes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | done | undone
  const [accountFilter, setAccountFilter] = useState('');
  const [body, setBody] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [userId, setUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/notes');
      setNotes(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load notes:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/manager/accounts');
      setAccounts(res.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchNotes(); fetchAccounts(); }, [fetchNotes, fetchAccounts]);

  const createNote = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const payload = { body: body.trim() };
      if (userId) payload.user_id = userId;
      if (remindAt) payload.remind_at = remindAt;
      await api.post('/manager/notes', payload);
      setBody('');
      setRemindAt('');
      setUserId('');
      fetchNotes();
    } catch (err) {
      console.error('[Manager] Failed to create note:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (id, currentDone) => {
    try {
      await api.patch(`/manager/notes/${id}`, { done: !currentDone });
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, done: !currentDone } : n));
    } catch (err) {
      console.error('[Manager] Failed to toggle note:', err.message);
    }
  };

  const deleteNote = async (id) => {
    try {
      await api.delete(`/manager/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('[Manager] Failed to delete note:', err.message);
    }
  };

  let filtered = notes;
  if (filter === 'done') filtered = filtered.filter((n) => n.done);
  if (filter === 'undone') filtered = filtered.filter((n) => !n.done);
  if (accountFilter) filtered = filtered.filter((n) => (n.user_id || n.userId) === accountFilter);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Notes &amp; Reminders
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Personal notes and task reminders
          </p>
        </div>
        <button
          onClick={fetchNotes}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Create Form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={createNote}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-4 backdrop-blur-sm space-y-3"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note..."
          rows={3}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
        />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Account (optional)</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none min-w-[140px]"
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name || a.shop_name || a.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Remind at (optional)</label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </motion.form>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
        {['all', 'undone', 'done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'done' ? 'Done' : 'Undone'}
          </button>
        ))}
        {accounts.length > 0 && (
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name || a.shop_name || a.id}</option>
            ))}
          </select>
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-2">
        {loading && (
          <p className="text-sm text-[var(--text-muted)] text-center py-12">Loading...</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-12">No notes found</p>
        )}
        <AnimatePresence>
          {!loading && filtered.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-4 backdrop-blur-sm flex items-start gap-3 ${
                note.done ? 'opacity-60' : ''
              }`}
            >
              {/* Toggle */}
              <button
                onClick={() => toggleDone(note.id, note.done)}
                className="flex-shrink-0 mt-0.5 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                {note.done
                  ? <CheckSquare className="w-5 h-5 text-emerald-400" />
                  : <Square className="w-5 h-5" />
                }
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm text-[var(--text-primary)] ${note.done ? 'line-through' : ''}`}>
                  {note.body}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {note.remind_at && (
                    <span className="text-xs text-amber-400">
                      Remind: {new Date(note.remind_at).toLocaleString()}
                    </span>
                  )}
                  {(note.account_name || note.accountName) && (
                    <span className="text-xs text-blue-400">{note.account_name || note.accountName}</span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteNote(note.id)}
                className="flex-shrink-0 text-[var(--text-muted)] hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
