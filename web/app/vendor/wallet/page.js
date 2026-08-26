"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Lock,
  CheckCircle2, AlertCircle, Loader2, Clock,
  RefreshCw, Shield, X, History, Package,
  Bot, User2, RotateCcw, Building2
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import DepositModal from '@/components/wallet/DepositModal';
import StatCard from '@/components/layout/StatCard';
import socketService from '@/services/socket';

const MIN_WITHDRAW = 500;

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const TX_ICONS = {
  payout:         { Icon: ArrowDownLeft, color: 'emerald' },
  deposit:        { Icon: ArrowDownLeft, color: 'emerald' },
  escrow_release: { Icon: ArrowDownLeft, color: 'emerald' },
  refund:         { Icon: ArrowDownLeft, color: 'blue'    },
  withdrawal:     { Icon: ArrowUpRight,  color: 'red'     },
  payment:        { Icon: ArrowUpRight,  color: 'amber'   },
};
const TX_ICON_STYLES = {
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  blue:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
  red:     'bg-red-500/10 text-red-500 border-red-500/20',
  amber:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

function ReceiptModal({ tx, onClose }) {
  if (!tx) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm bg-white text-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500" />
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
             <Wallet className="size-8" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Aura Dime</h3>
          <p className="text-[11px] font-semibold text-slate-400 tracking-tight">Official Transaction Receipt</p>
        </div>

        <div className="space-y-4 mb-8 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400 font-semibold text-[10px]">Reference</span>
            <span className="font-bold text-slate-800">{tx.reference?.slice(0, 12)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400 font-semibold text-[10px]">Date</span>
            <span className="font-bold text-slate-800">{new Date(tx.createdAt).toLocaleString()}</span>
          </div>
          <div className="py-4 text-center">
            <p className="text-[11px] font-semibold text-slate-400 tracking-tight mb-1">Amount</p>
            <h4 className="text-3xl font-bold text-slate-900">{fmt(tx.amount)} XAF</h4>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="size-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-200">
            <X className="size-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function VendorWalletPage() {
  const { user, hasHydrated, setWalletBalance, walletBalance: storeWalletBalance } = useAuthStore();
  const router = useRouter();

  const [balance, setBalance]         = useState(0);
  const [escrow, setEscrow]           = useState(0);
  const [transactions, setTxs]        = useState([]);
  const [escrowTxs, setEscrowTxs]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showWithdraw, setWithdraw]   = useState(false);
  const [showDeposit, setDeposit]     = useState(false);
  const [tab, setTab]                 = useState('history');
  const [selectedTx, setSelectedTx]  = useState(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [recheckingTxId, setRecheckingTxId] = useState(null);
  const [toast, setToast] = useState(null);
  const itemsPerPage = 8;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  const loadingRef          = useRef(false);
  const pendingSilentLoad   = useRef(false);

  // ── Auth guard: wait for Zustand to rehydrate before redirecting ──
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login?from=vendor-wallet');
    } else if (user.role !== 'vendor') {
      router.replace('/wallet');
    }
  }, [user, router, hasHydrated]);

  // Return null until hydrated — prevents login-page flash
  if (!hasHydrated || !user || user.role !== 'vendor') return null;

  const load = useCallback(async (silent = false) => {
    // Prevent concurrent loads; queue missed silent reloads so credits aren't dropped
    if (loadingRef.current) {
      if (silent) pendingSilentLoad.current = true;
      return;
    }
    loadingRef.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [balRes, txRes, escrowRes, wdRes] = await Promise.allSettled([
        api.get('/wallet'),
        api.get('/wallet/transactions?limit=50'),
        api.get('/wallet/escrow'),
        api.get('/withdrawals/mine'),
      ]);
      if (balRes.status === 'fulfilled' && balRes.value.data.success) {
        const nextBalance = balRes.value.data.data.balance || 0;
        setBalance(nextBalance);
        setWalletBalance(nextBalance);
        setEscrow(balRes.value.data.data.pending_escrow || 0);
      }
      if (txRes.status === 'fulfilled' && txRes.value.data.success) setTxs(txRes.value.data.data.transactions || []);
      if (escrowRes.status === 'fulfilled' && escrowRes.value.data.success) setEscrowTxs(escrowRes.value.data.data.transactions || []);
      if (wdRes.status === 'fulfilled' && wdRes.value.data.success) setWithdrawalRequests(wdRes.value.data.data.withdrawals || []);
    } catch (e) {
      if (e.response?.status !== 401) {
        console.error('Wallet Load Error:', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
      if (pendingSilentLoad.current) {
        pendingSilentLoad.current = false;
        setTimeout(() => load(true), 100);
      }
    }
  }, [setWalletBalance]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Visibility-based refresh (silent — no loading spinner)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user && user.role === 'vendor') {
        load(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, user]);

  // Real-time balance and transaction updates via socket
  useEffect(() => {
    if (!user?._id) return;
    const handleCredited  = () => load(true);
    const handleWdPaid    = () => load(true);
    socketService.on('wallet:credited',  handleCredited);
    socketService.on('wallet:debited',   handleCredited);
    socketService.on('withdrawal:paid',  handleWdPaid);
    return () => {
      socketService.off('wallet:credited',  handleCredited);
      socketService.off('wallet:debited',   handleCredited);
      socketService.off('withdrawal:paid',  handleWdPaid);
    };
  }, [user?._id, load]);

  // Store sync intentionally removed — load() fetches the authoritative API value and
  // calls setWalletBalance() to update the store. pendingSilentLoad replays any
  // socket-triggered credits after the current fetch, making the sync redundant.
  // Keeping it caused the stat card to show stale store data instead of the API value.

  // Reset pagination on tab change
  useEffect(() => { setCurrentPage(1); }, [tab]);

  const handleRecheckTx = async (tx) => {
    setRecheckingTxId(tx._id);
    try {
      if (!['eversend', 'payunit', 'pawapay'].includes(tx.gateway)) {
        showToast('This gateway is not supported for recheck.', 'error');
        return;
      }
      const endpoint = `/payments/${tx.gateway}/recheck/${tx.reference}`;
      const res = await api.get(endpoint);
      const { status, message, reason } = res.data;
      if (status === 'SUCCESSFUL') {
        showToast('Payment confirmed! Your wallet has been credited.', 'success');
        load(true);
      } else if (status === 'FAILED') {
        showToast(reason || message || 'Payment could not be confirmed.', 'error');
        load(true);
      } else {
        showToast('Still processing — your phone may still have a pending prompt.', 'info');
      }
    } catch {
      showToast('Could not reach server. Try again shortly.', 'error');
    } finally {
      setRecheckingTxId(null);
    }
  };

  // Total Earned = actual income from orders (payout, escrow_release, refund).
  // Deposits are self-funded wallet top-ups, NOT earnings — excluded intentionally.
  const totalEarned = transactions
    .filter(t =>
      t.status === 'completed' &&
      (t.type === 'payout' || t.type === 'refund' || t.type === 'escrow_release')
    )
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);
  const completedWithdrawn = withdrawalRequests
    .filter((wr) => ['completed', 'paid', 'successful'].includes(String(wr.status || '').toLowerCase()))
    .reduce((sum, wr) => sum + Number(wr.amount || 0), 0);
  const withdrawnTotal = completedWithdrawn || totalOut;

  const totalFunds    = balance + escrow;
  const availRatio    = totalFunds > 0 ? Math.round((balance / totalFunds) * 100) : 0;
  const escrowRatioW  = totalFunds > 0 ? Math.round((escrow / totalFunds) * 100) : 0;
  const withdrawRatio = totalEarned > 0 ? Math.min(Math.round((withdrawnTotal / totalEarned) * 100), 100) : 0;

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 rounded-2xl text-xs font-bold shadow-xl ${
              toast.type === 'success' ? 'bg-emerald-500 text-white' :
              toast.type === 'error'   ? 'bg-red-500 text-white' :
              'bg-amber-500 text-white'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
        {showWithdraw && (
          <WithdrawModal
            balance={balance}
            onClose={() => setWithdraw(false)}
            onSuccess={() => { load(); setWithdraw(false); }}
          />
        )}
      </AnimatePresence>
      <DepositModal
        open={showDeposit}
        onClose={() => setDeposit(false)}
        onSuccess={() => { load(true); setDeposit(false); }}
        userPhone={user?.phone || ''}
      />

      {/* Header — fixed sticky with proper desktop top override */}
      <header className="py-3 flex items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)]/40 bg-[var(--bg-secondary)]/40 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/15 shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Vendor Wallet</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`size-1.5 rounded-full ${refreshing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-40 uppercase">
                {refreshing ? 'Syncing…' : 'Secure Account'}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => load()}
          disabled={loading || refreshing}
          className="size-9 rounded-xl border border-[var(--glass-border)]/50 bg-transparent text-[var(--text-secondary)] flex items-center justify-center active:scale-95 disabled:opacity-40 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
          <StatCard label="Available"    value={fmt(balance)}        icon="account_balance_wallet" color="emerald" sub="XAF Ready"         progress={availRatio}    footer={`${escrowRatioW}% held in escrow`} loading={loading} />
          <StatCard label="In Escrow"   value={fmt(escrow)}          icon="lock_clock"             color="amber"   sub="Pending Delivery"  progress={escrowRatioW}  footer="Pending delivery confirmation" loading={loading} />
          <StatCard label="Total Earned" value={fmt(totalEarned)}    icon="trending_up"            color="fuchsia" sub="Total earned"       progress={Math.min(withdrawRatio + availRatio, 100)} footer={`${fmt(totalEarned)} lifetime`} loading={loading} />
          <StatCard label="Withdrawn"   value={fmt(withdrawnTotal)}  icon="arrow_outward"          color="blue"    sub="Successful payouts" progress={withdrawRatio} footer={`${fmt(Math.max(totalEarned - withdrawnTotal, 0))} remaining`} loading={loading} />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
           <button onClick={() => setDeposit(true)} className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
              <ArrowDownLeft className="size-5" /> Deposit Funds
           </button>
           <button onClick={() => setWithdraw(true)} disabled={balance < MIN_WITHDRAW} className="flex-1 h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-xs tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all disabled:opacity-30">
              <ArrowUpRight className="size-5" /> Initiate Withdrawal
           </button>
        </div>

        {/* Tabs */}
        <div className="space-y-6">
           <div className="flex items-center gap-6 border-b border-[var(--glass-border)]">
              <button onClick={() => setTab('history')} className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'history' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                 <div className="flex items-center gap-2"><History className="size-4" /> Transaction History</div>
                 {tab === 'history' && <motion.div layoutId="wallet-tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
              </button>
              <button onClick={() => setTab('escrow')} className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'escrow' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                 <div className="flex items-center gap-2">
                   <Lock className="size-4" /> Held in Escrow
                   {escrowTxs.length > 0 && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}
                 </div>
                 {tab === 'escrow' && <motion.div layoutId="wallet-tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
              </button>
              <button onClick={() => setTab('withdrawals')} className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'withdrawals' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                 <div className="flex items-center gap-2"><ArrowUpRight className="size-4" /> Withdrawals</div>
                 {tab === 'withdrawals' && <motion.div layoutId="wallet-tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
              </button>
           </div>

           <div className="min-h-[400px]">
              {/* Transaction History */}
              {tab === 'history' && (
                <div className="space-y-4">
                   {loading ? (
                     <div className="py-20 flex justify-center opacity-20"><Loader2 className="animate-spin" /></div>
                   ) : transactions.length === 0 ? (
                     <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No transaction data available</div>
                   ) : transactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((tx, i) => {
                     const config = TX_ICONS[tx.type] || TX_ICONS.payment;
                     const iconStyle = TX_ICON_STYLES[config.color] || TX_ICON_STYLES.amber;
                     const isCredit = tx.type === 'payout' || tx.type === 'escrow_release' || tx.type === 'refund' ||
                       (tx.type === 'deposit' && !(tx.order_ids?.length > 0));
                     return (
                       <div
                         key={tx._id || i}
                         onClick={() => setSelectedTx(tx)}
                         className={`flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border transition-all group cursor-pointer ${
                           tx.status === 'pending' && ['eversend', 'payunit', 'pawapay'].includes(tx.gateway) && tx.type === 'deposit'
                             ? 'border-amber-500/30 bg-amber-500/5'
                             : 'border-[var(--glass-border)] hover:border-[var(--accent)]/30'
                         }`}
                       >
                         <div className={`size-10 rounded-xl flex items-center justify-center border ${iconStyle}`}>
                           <config.Icon className="size-4" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-[11px] font-semibold tracking-tight truncate capitalize">{tx.description || tx.type}</p>
                           <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">{new Date(tx.createdAt).toLocaleDateString()}</p>
                           {['pending', 'failed'].includes(tx.status) && ['eversend', 'payunit', 'pawapay'].includes(tx.gateway) && tx.type === 'deposit' && (
                             <button
                               onClick={(e) => { e.stopPropagation(); handleRecheckTx(tx); }}
                               disabled={recheckingTxId === tx._id}
                               className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                             >
                               {recheckingTxId === tx._id
                                 ? <><Loader2 className="size-3 animate-spin" /> Checking...</>
                                 : <><RotateCcw className="size-3" /> Recheck payment</>
                               }
                             </button>
                           )}
                         </div>
                         <div className="text-right shrink-0">
                           <p className={`text-base font-bold tracking-tight ${
                             tx.status === 'completed'
                               ? (isCredit ? 'text-emerald-500' : 'text-red-500')
                               : tx.status === 'failed'
                                 ? 'text-red-500/50 line-through'
                                 : 'text-[var(--text-secondary)] opacity-40'
                           }`}>
                             {tx.status === 'completed' ? (isCredit ? '+' : '-') : ''}{fmt(tx.amount)}
                           </p>
                           <div className="flex items-center justify-end gap-1 mt-0.5">
                             {tx.status === 'pending' && <Clock className="size-2 text-amber-500 animate-pulse" />}
                             <p className={`text-[10px] font-semibold tracking-tight ${
                               tx.status === 'completed' ? 'text-emerald-500/50' :
                               tx.status === 'failed' ? 'text-red-500' : 'text-amber-500'
                             }`}>
                               {tx.status}
                             </p>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                </div>
              )}

              {/* Held in Escrow */}
              {tab === 'escrow' && (
                 <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-4">
                       <Shield className="size-5 text-amber-500 shrink-0" />
                       <p className="text-[11px] font-semibold text-amber-600/70 leading-relaxed tracking-tight">
                         Funds are securely held until the customer confirms receipt, or 6 hours after delivery for auto-release.
                       </p>
                    </div>
                    {loading ? (
                      <div className="py-20 flex justify-center opacity-20"><Loader2 className="animate-spin" /></div>
                    ) : escrowTxs.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No funds currently held in reserve</div>
                    ) : escrowTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(tx => {
                      const escrowRecord = tx.escrow_record;
                      const customerConfirmed = escrowRecord?.customer_confirmed;
                      const autoReleased = escrowRecord?.auto_released;
                      const vendorConfirmed = escrowRecord?.vendor_confirmed;
                      const isReleased = escrowRecord?.status === 'released';

                      return (
                        <div key={tx._id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-start gap-4">
                           <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                             <Clock className="size-5" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-[var(--text-primary)]">Order #{tx.order_id?._id?.slice(-6).toUpperCase() || tx.order_id?.toString()?.slice(-6).toUpperCase()}</p>
                              <p className="text-[11px] font-semibold text-amber-500 tracking-tight capitalize">{tx.order_id?.order_status || 'processing'}</p>
                              {/* Confirmation indicators */}
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className={`text-[9px] font-bold flex items-center gap-1 ${vendorConfirmed ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-40'}`}>
                                  <Package className="size-2.5" />
                                  {vendorConfirmed ? 'Delivered ✓' : 'Delivery pending'}
                                </span>
                                <span className={`text-[9px] font-bold flex items-center gap-1 ${
                                  autoReleased ? 'text-amber-500' : customerConfirmed ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-40'
                                }`}>
                                  {autoReleased ? <Bot className="size-2.5" /> : <User2 className="size-2.5" />}
                                  {autoReleased ? 'Auto-released' : customerConfirmed ? 'Confirmed ✓' : 'Awaiting customer'}
                                </span>
                              </div>
                           </div>
                           <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-[var(--text-primary)]">{fmt(tx.amount)} XAF</p>
                              <p className={`text-[9px] font-bold mt-0.5 ${isReleased ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {isReleased ? 'Released' : 'Escrowed'}
                              </p>
                           </div>
                        </div>
                      );
                    })}
                 </div>
              )}

              {/* Withdrawals */}
              {tab === 'withdrawals' && (
                 <div className="space-y-2">
                    {withdrawalRequests.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No withdrawal requests found</div>
                    ) : withdrawalRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((wr) => (
                      <div key={wr._id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-4">
                         <div className={`size-11 rounded-xl flex items-center justify-center ${
                           wr.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                           wr.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                           'bg-red-500/10 text-red-500'
                         }`}>
                            {wr.status === 'completed' ? <CheckCircle2 className="size-5" /> :
                             wr.status === 'pending' ? <Clock className="size-5" /> :
                             <AlertCircle className="size-5" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[var(--text-primary)] capitalize">{wr.withdrawal_method} Withdrawal</p>
                            <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{new Date(wr.createdAt).toLocaleDateString()} · {wr.status}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-base font-bold text-[var(--text-primary)]">{fmt(wr.amount)}</p>
                            <p className="text-[10px] font-semibold opacity-30 capitalize">{wr.currency}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              )}
           </div>

           <div className="pt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(
                  (tab === 'history' ? transactions.length : tab === 'escrow' ? escrowTxs.length : withdrawalRequests.length) / itemsPerPage
                )}
                onPageChange={setCurrentPage}
              />
           </div>
        </div>
      </div>
    </>
  );
}
