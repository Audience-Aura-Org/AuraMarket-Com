"use client";

import { useState, useEffect } from 'react';
import { 
  Building2, CheckCircle2, XCircle, Clock, 
  Search, Filter, Plus, ArrowUpRight, 
  Loader2, MoreVertical, ShieldCheck,
  AlertCircle, Smartphone, ExternalLink,
  Pause, TrendingUp, History
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';

export default function AdminWithdrawalsPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [filter, setFilter] = useState('pending'); // all, pending, completed, rejected
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const fetchWithdrawals = async () => {
    try {
      const res = await api.get(`/wallet/admin/withdrawals?status=${filter}`);
      if (res.data.success) {
        setWithdrawals(res.data.data.withdrawals);
      }
    } catch (err) {
      console.error('Fetch withdrawals error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    fetchWithdrawals();
  }, [filter, mounted, user]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAction = async (id, action) => {
    setProcessingId(id);
    try {
      const res = await api.patch(`/wallet/admin/withdrawals/${id}`, { action });
      if (res.data.success) {
        showToast(`Withdrawal successfully ${action}ed!`);
        // Update local state
        setWithdrawals(prev => prev.map(w => 
            w._id === id ? { ...w, status: action === 'approve' ? 'completed' : action === 'reject' ? 'rejected' : 'pending' } : w
        ));
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Action failed.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => 
    w.user_id?.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.reference?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full p-4 lg:p-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-bold ${
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Withdrawal Requests</h1>
            <p className="text-sm text-[var(--text-secondary)] font-bold opacity-70">Approve or audit platform cash-outs.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> Admin Auth Active
             </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
                { label: 'Pending Requests', value: withdrawals.filter(w => w.status === 'pending').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Volume Today', value: withdrawals.filter(w => w.status === 'completed' && new Date(w.createdAt).toDateString() === new Date().toDateString()).reduce((s, w) => s + w.amount, 0).toLocaleString() + ' XAF', icon: TrendingUp, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
                { label: 'Total Audited', value: withdrawals.filter(w => w.status !== 'pending').length, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            ].map((s, i) => (
                <div key={i} className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.bg} ${s.color}`}>
                        <s.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase opacity-60">{s.label}</p>
                        <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5">{s.value}</p>
                    </div>
                </div>
            ))}
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
             <div className="flex-1 w-full relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-40" />
                <input 
                    type="text" 
                    placeholder="Search by vendor name or reference..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
                />
             </div>
             <div className="flex bg-[var(--bg-primary)]/40 p-1 rounded-2xl border border-[var(--glass-border)]">
                {['all', 'pending', 'completed', 'rejected'].map(s => (
                    <button 
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {s}
                    </button>
                ))}
             </div>
        </div>

        {/* Table/List */}
        <div className="glass-panel border border-[var(--glass-border)] rounded-[2rem] overflow-hidden bg-[var(--bg-primary)]/40">
            {loading ? (
                <div className="py-40 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--accent)] opacity-40" />
                    <p className="mt-4 text-[var(--text-secondary)] font-bold text-xs uppercase tracking-[0.2em]">Querying Ledger...</p>
                </div>
            ) : filteredWithdrawals.length === 0 ? (
                <div className="py-32 flex flex-col items-center text-center">
                    <History className="w-12 h-12 opacity-10 mb-4" />
                    <p className="font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-widest text-[10px]">No withdrawal requests found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[var(--glass-border)] text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">
                                <th className="px-8 py-6">Vendor / Initiator</th>
                                <th className="px-8 py-6">Reference</th>
                                <th className="px-8 py-6">Gateway Path</th>
                                <th className="px-8 py-6">Amount</th>
                                <th className="px-8 py-6">Status</th>
                                <th className="px-8 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {filteredWithdrawals.map(w => (
                                <tr key={w._id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-indigo-600 p-0.5">
                                                <div className="size-full rounded-[9px] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                                                    {w.user_id?.avatar ? (
                                                        <img src={w.user_id.avatar} className="size-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-black">{w.user_id?.name?.[0].toUpperCase()}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-[var(--text-primary)]">{w.user_id?.name || 'Unknown Node'}</p>
                                                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50">{w.user_id?.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <code className="text-[10px] font-black bg-white/5 px-2 py-1 rounded-md text-[var(--text-secondary)]">#{w.reference.slice(-8)}</code>
                                        <p className="mt-1 text-[9px] text-[var(--text-secondary)] opacity-40">{new Date(w.createdAt).toLocaleString()}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
                                                {w.gateway_response?.method === 'bank' ? <Building2 className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-tighter">{w.gateway_response?.method || 'Direct'}</p>
                                                <p className="text-[10px] font-bold text-[var(--accent)] opacity-80">{w.gateway_response?.details?.account_number}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="text-base font-black text-[var(--text-primary)]">{w.amount.toLocaleString()} <span className="text-[10px] opacity-30">XAF</span></p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                            w.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                            w.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                            'bg-red-500/10 text-red-500 border-red-500/20'
                                        }`}>
                                            {w.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {w.status === 'pending' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleAction(w._id, 'approve')}
                                                    disabled={processingId === w._id}
                                                    className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/5 active:scale-95 disabled:opacity-30"
                                                    title="Approve & Send Funds"
                                                >
                                                    {processingId === w._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(w._id, 'hold')}
                                                    disabled={processingId === w._id}
                                                    className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/5 active:scale-95 disabled:opacity-30"
                                                    title="Place on Hold"
                                                >
                                                    <Pause className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(w._id, 'reject')}
                                                    disabled={processingId === w._id}
                                                    className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5 active:scale-95 disabled:opacity-30"
                                                    title="Reject & Refund"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-[var(--text-secondary)] opacity-20 uppercase tracking-widest">Audited</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
}
