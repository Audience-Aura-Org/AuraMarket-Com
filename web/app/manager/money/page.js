'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, ShieldOff } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/services/api';

function fmtCurrency(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function ManagerMoney() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMoney = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/money');
      setAccounts(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load financial data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMoney(); }, [fetchMoney]);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Financial Overview
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Balances and withdrawals across all accounts
          </p>
        </div>
        <button
          onClick={fetchMoney}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Total Balance */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Balance</span>
        </div>
        <p className="text-3xl font-bold text-[var(--text-primary)]">
          {loading ? '...' : fmtCurrency(totalBalance)} <span className="text-base font-normal text-[var(--text-muted)]">XAF</span>
        </p>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl overflow-hidden backdrop-blur-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Account</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Balance</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Pending Withdrawals</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Pending Amount</th>
                <th className="text-center px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">Loading...</td></tr>
              )}
              {!loading && accounts.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">No financial data available</td></tr>
              )}
              {!loading && accounts.map((item, i) => (
                <motion.tr
                  key={item.id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                    {item.account_name || item.accountName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)] font-mono">
                    {fmtCurrency(item.balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {item.pending_withdrawals ?? item.pendingWithdrawals ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)] font-mono">
                    {fmtCurrency(item.pending_amount ?? item.pendingAmount ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.canManageMoney === false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium">
                        <ShieldOff className="w-3 h-3" /> No access
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                        Active
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
