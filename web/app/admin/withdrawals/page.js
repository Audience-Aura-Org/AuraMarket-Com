"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle2, XCircle, Clock, AlertCircle,
  Loader2, RefreshCw, Search, Filter, User, ChevronRight,
  ShieldCheck, Info, ArrowUpRight, Zap, TrendingUp, Lock,
  ArrowDownLeft, History, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const STATUS_BADGE = {
  pending:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected:  'bg-red-500/10 text-red-500 border-red-500/20',
};

const METHOD_LABEL = { mtn: 'MTN MoMo', orange: 'Orange Money', bank: 'Bank Transfer' };

function KPICard({ title, value, icon: Icon, color, sub }) {
  const colorMap = {
    fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    blue: 'bg-indigo-500/10 text-indigo-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-6 group hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden glass-panel shadow-sm w-full">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${colorMap[color]?.split(' ')[0]}`} />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[var(--text-secondary)] text-[10px] font-black tracking-[0.2em] uppercase opacity-50">{title}</p>
        <h3 className="text-fluid-base lg:text-fluid-xl font-bold text-[var(--text-primary)] mt-1 truncate">{value}</h3>
        {sub && <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-1 opacity-50 uppercase tracking-tighter truncate">{sub}</p>}
      </div>
    </div>
  );
}

function RequestDetails({ request, onClose, onAction, processing, onMessage }) {
  if (!request) return null;
  const details = request.gateway_response?.details || {};
  const method  = request.gateway_response?.method || 'mtn';

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 size-40 bg-[var(--accent)]/10 blur-3xl rounded-full" />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Request Review</h2>
            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-40">{request.reference}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => onMessage(request.user_id._id, request.user_id)}
              className="size-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all shadow-lg shadow-indigo-500/10"
              title="Message Vendor"
            >
              <History className="size-5" />
            </button>
            <button onClick={onClose} className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              <XCircle className="size-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            <div className="size-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden">
               {request.user_id?.avatar ? <img src={request.user_id.avatar} className="size-full object-cover" /> : <User className="size-6 opacity-20" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[var(--text-primary)] truncate">{request.user_id?.name || 'Unknown User'}</p>
              <p className="text-[10px] text-[var(--text-secondary)] font-bold opacity-40 truncate">{request.user_id?.email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-[var(--accent)]">{fmt(request.amount)}</p>
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase opacity-30">XAF</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 opacity-40">Payout Method</p>
              <p className="text-sm font-black text-[var(--text-primary)]">{METHOD_LABEL[method]}</p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-1 opacity-60">{details.account_number}</p>
            </div>
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 opacity-40">Account Name</p>
              <p className="text-sm font-black text-[var(--text-primary)] truncate">{details.holder_name || '—'}</p>
              <p className="text-[10px] font-bold text-emerald-500 mt-1 flex items-center gap-1"><ShieldCheck className="size-3" /> VERIFIED</p>
            </div>
          </div>

          {request.status === 'pending' ? (
            <div className="flex gap-3">
              <button onClick={() => onAction(request._id, 'approve')} disabled={!!processing}
                className="flex-1 h-14 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20">
                {processing?.includes('approve') ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve & Pay
              </button>
              <button onClick={() => onAction(request._id, 'reject')} disabled={!!processing}
                className="flex-1 h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/20 disabled:opacity-50 transition-all">
                {processing?.includes('reject') ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Reject
              </button>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border text-center font-black uppercase text-xs tracking-widest ${STATUS_BADGE[request.status]}`}>
              Status: {request.status}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminWithdrawalsPage() {
  const { user } = useAuthStore();
  const { openChat } = useChat();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ total_platform_revenue: 0, total_escrow_held: 0, total_pending_withdrawals: 0 });
  const [filter, setFilter]     = useState('pending');
  const [search, setSearch]     = useState('');
  const [processing, setProc]   = useState(null);
  const [toast, setToast]       = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) {
      router.replace('/login?from=admin-withdrawals');
    } else if (user.role !== 'admin') {
      router.replace('/wallet');
    }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, sRes] = await Promise.all([
        api.get('/wallet/admin/withdrawals', { params: { status: filter === 'all' ? undefined : filter } }),
        api.get('/wallet/admin/stats')
      ]);
      if (wRes.data.success) setWithdrawals(wRes.data.data.withdrawals || []);
      if (sRes.data.success) setStats(sRes.data.data);
    } catch { showToast('Failed to load withdrawals', 'error'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setProc(id + action);
    try {
      await api.patch(`/wallet/admin/withdrawals/${id}`, { action });
      showToast(`Withdrawal ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'held'} successfully.`);
      setSelected(null);
      load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Action failed.', 'error');
    } finally { setProc(null); }
  };

  const displayed = withdrawals.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (w.user_id?.name || '').toLowerCase().includes(q) ||
           (w.user_id?.email || '').toLowerCase().includes(q) ||
           (w.reference || '').toLowerCase().includes(q);
  });

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -20, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: -20, opacity: 0, x: '-50%' }}
            className={`fixed top-20 left-1/2 z-[1000] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
          >
            {toast.type === 'error' ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <RequestDetails 
            request={selected} 
            onClose={() => setSelected(null)} 
            onAction={act}
            processing={processing}
            onMessage={openChat}
          />
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-8 w-full space-y-8">
        
        {/* Header - Matching Vendor Style */}
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <ShieldCheck className="size-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)]">Payout Queue</h1>
                <p className="text-xs text-[var(--text-secondary)] font-bold opacity-60 uppercase tracking-widest">Financial Oversight</p>
              </div>
           </div>
           <button onClick={load} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
              <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>

        {/* KPI Grid - Matching Vendor Style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Platform Revenue" value={`${fmt(stats.total_platform_revenue)}`} icon={Zap} color="emerald" sub="Gross Commissions" />
          <KPICard title="Escrow Volume" value={`${fmt(stats.total_escrow_held)}`} icon={Lock} color="amber" sub="Market Liquidity" />
          <KPICard title="Pending Payouts" value={`${fmt(stats.total_pending_withdrawals)}`} icon={Wallet} color="fuchsia" sub="XAF Liabilities" />
          <KPICard title="Requests" value={withdrawals.filter(w => w.status === 'pending').length} icon={Clock} color="blue" sub="Open Queue" />
        </div>

        {/* Filters & Search */}
        <div className="space-y-6">
           <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex p-1 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl w-full md:w-auto">
                {['pending', 'completed', 'rejected', 'all'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30" />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)} 
                  placeholder="Search Ref, Name, or Email..."
                  className="w-full h-12 pl-12 pr-6 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl text-xs font-bold text-[var(--text-primary)] placeholder:opacity-20 outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>
           </div>

           {/* Results List - Matching Vendor Transaction Style */}
           <div className="min-h-[400px] space-y-2">
              {loading ? (
                <div className="py-20 flex justify-center opacity-20"><Loader2 className="animate-spin" /></div>
              ) : displayed.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No requests found in queue</div>
              ) : displayed.map((w) => (
                <div key={w._id} onClick={() => setSelected(w)} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex items-center gap-4 cursor-pointer group">
                   <div className={`size-11 rounded-xl flex items-center justify-center ${w.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : w.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {w.status === 'pending' ? <Clock className="size-5" /> : w.status === 'completed' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[var(--text-primary)] truncate uppercase">{w.user_id?.name || 'Unknown Vendor'}</p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">{w.reference} • {new Date(w.createdAt).toLocaleDateString()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-base font-black text-[var(--text-primary)]">{fmt(w.amount)}</p>
                      <p className="text-[8px] font-black uppercase opacity-20 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1"><ChevronRight className="size-2" /> Review Request</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </>
  );
}
