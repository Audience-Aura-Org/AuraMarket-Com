"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  Loader2, X, CheckCircle2, AlertCircle,
  Lock, ArrowRightLeft, Sparkles, Building2,
  TrendingUp, Activity, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';

const TX_ICONS = {
  deposit:    { Icon: ArrowDownLeft,  color: 'emerald' },
  withdrawal: { Icon: ArrowUpRight,   color: 'red' },
  payment:    { Icon: ArrowDownLeft,  color: 'amber' },
  refund:     { Icon: ArrowDownLeft,  color: 'blue' },
  payout:     { Icon: Building2,      color: 'purple' },
};

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

function CompactStat({ title, value, sub, icon: Icon, color }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-4 hover:border-[var(--accent)]/30 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-8 rounded-lg flex items-center justify-center border ${colors[color] || colors.blue}`}>
          <Icon className="size-4" />
        </div>
        <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50">{title}</p>
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tighter">{value}</h3>
      {sub && <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 tracking-tight">{sub}</p>}
    </div>
  );
}

export default function WalletPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [withdrawalMethod, setWithdrawalMethod] = useState('');
  const [accountDetails, setAccountDetails] = useState({ account_number: '', holder_name: '' });
  const itemsPerPage = 10;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWallet = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
      ]);
      if (balRes.data.success) {
        setBalance(balRes.data.data.balance || 0);
        setPendingBalance(balRes.data.data.pending_escrow || 0);
      }
      if (txRes.data.success) setTransactions(txRes.data.data.transactions || []);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.replace('/login?from=wallet');
      return;
    }
    if (user.role === 'vendor') { router.replace('/vendor/wallet'); return; }
    if (user.role === 'admin')  { router.replace('/admin/withdrawals'); return; }
    fetchWallet();
  }, [mounted, user, router]);

  const handleAction = async (type) => {
    if (!amount || Number(amount) <= 0) return showToast('Enter a valid amount.', 'error');
    setSubmitting(true);
    try {
      const endpoint = type === 'deposit' ? '/wallet/deposit' : '/wallet/withdraw';
      const body = type === 'deposit' ? { amount: Number(amount) } : { amount: Number(amount), method: withdrawalMethod, details: accountDetails };
      const res = await api.post(endpoint, body);
      if (res.data.success) {
        showToast(`${type} successful!`);
        setModal(null);
        setAmount('');
        fetchWallet();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Transaction failed.', 'error');
    } finally { setSubmitting(false); }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in') return ['deposit', 'refund', 'payout'].includes(tx.type);
    if (activeTab === 'out') return ['withdrawal', 'payment'].includes(tx.type);
    return true;
  });

  const currentTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <DashboardLayout role={user?.role || 'customer'} hideSidebar={true}>
      <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
        
        {/* Surgical Header */}
        <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <Wallet className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold  tracking-tighter">Financial Nexus</h1>
                <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight">Liquid Capital Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-500 tracking-tight">Secured</span>
               </div>
               <button onClick={fetchWallet} className="p-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                  <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
               </button>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
          
          {/* Micro Stat Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactStat title="Available" value={fmt(balance)} sub="Liquid Capital" icon={Wallet} color="emerald" />
            <CompactStat title="In Escrow" value={fmt(pendingBalance)} sub="Held for Delivery" icon={Lock} color="amber" />
            <CompactStat title="Platform In" value={fmt(transactions.filter(t => ['deposit','refund','payout'].includes(t.type)).reduce((s,t)=>s+t.amount,0))} sub="Total Received" icon={ArrowDownLeft} color="fuchsia" />
            <CompactStat title="Platform Out" value={fmt(transactions.filter(t => ['withdrawal','payment'].includes(t.type)).reduce((s,t)=>s+t.amount,0))} sub="Total Sent" icon={ArrowUpRight} color="blue" />
          </div>

          {/* Action Hub */}
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => setModal('deposit')} className="h-14 rounded-2xl bg-emerald-500 text-white font-bold text-[9px] tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all">
                <ArrowDownLeft className="size-5" /> Deposit Funds
             </button>
             <button onClick={() => setModal('withdraw')} className="h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-bold text-[9px] tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--bg-secondary)]/80 active:scale-95 transition-all">
                <ArrowUpRight className="size-5" /> Withdraw
             </button>
          </div>

          {/* Activity Matrix */}
          <section className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[11px] font-bold  tracking-[0.3em] opacity-40">Transaction Matrix</h3>
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-30 mt-1 tracking-tight">Structural Ledger History</p>
                </div>
                <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5">
                  {['all', 'in', 'out'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-[11px] font-bold tracking-tight transition-all ${activeTab === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] opacity-40'}`}>
                      {t}
                    </button>
                  ))}
                </div>
             </div>

             <div className="space-y-2 min-h-[400px]">
                {loading ? <LoadingSpinner /> : currentTransactions.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-20 text-sm">No activity records found</div>
                ) : currentTransactions.map((tx, i) => {
                  const config = TX_ICONS[tx.type] || TX_ICONS.payment;
                  const isCredit = ['deposit', 'refund', 'payout'].includes(tx.type);
                  return (
                    <div key={tx._id || i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group cursor-pointer">
                      <div className={`size-10 rounded-xl flex items-center justify-center bg-${config.color}-500/10 text-${config.color}-500 border border-${config.color}-500/20`}>
                        <config.Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold  tracking-tighter truncate">{tx.description || tx.type}</p>
                        <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold tracking-tighter ${isCredit ? 'text-emerald-500' : 'text-red-500'}`}>{isCredit ? '+' : '-'}{fmt(tx.amount)}</p>
                        <p className="text-[11px] font-bold  opacity-20 group-hover:opacity-100 transition-opacity tracking-tight flex items-center justify-end gap-1"><ChevronRight className="size-2" /> Record Details</p>
                      </div>
                    </div>
                  );
                })}
             </div>
          </section>
        </div>

        {/* Action Modals - Abstracted for surgical look */}
        <AnimatePresence>
          {modal && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setModal(null)} />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold  tracking-tighter">{modal === 'deposit' ? 'Add Liquidity' : 'Initiate Outflow'}</h3>
                  <button onClick={() => setModal(null)} className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-all"><X className="size-4 opacity-40" /></button>
                </div>
                <div className="space-y-6">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl text-4xl font-bold text-center text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-10" />
                  <button onClick={() => handleAction(modal)} disabled={submitting} className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-[9px] tracking-tight shadow-lg shadow-[var(--accent)]/20">
                    {submitting ? 'Calibrating...' : 'Confirm Transaction'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function RefreshCw({ className }) {
  return <Activity className={className} />;
}
