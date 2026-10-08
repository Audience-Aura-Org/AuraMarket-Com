'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/services/api';

export default function ManagerMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const query = unreadOnly ? '?unread=true' : '';
      const res = await api.get(`/manager/messages${query}`);
      setMessages(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load messages:', err.message);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Cross-Account Messages
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Messages across all managed accounts
          </p>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-2">
        {['all', 'unread'].map((mode) => (
          <button
            key={mode}
            onClick={() => setUnreadOnly(mode === 'unread')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (mode === 'unread') === unreadOnly
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {mode === 'all' ? 'All Messages' : 'Unread Only'}
          </button>
        ))}
      </div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl overflow-hidden backdrop-blur-sm"
      >
        {loading && (
          <p className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">Loading...</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">No messages found</p>
        )}
        <div className="divide-y divide-[var(--glass-border)]">
          {!loading && messages.map((item, i) => (
            <motion.div
              key={item.id || i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                href={item.href || '#'}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 w-2.5 h-2.5">
                  {item.unread && (
                    <span className="block w-2.5 h-2.5 rounded-full bg-blue-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${item.unread ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {item.account_name || item.accountName || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    {(item.preview || item.body || '').slice(0, 90)}
                  </p>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
