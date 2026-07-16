"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, AlertCircle, Loader2, Clock,
  RefreshCw, Shield, X, History, Package,
  Printer, Truck
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import socketService from '@/services/socket';
import Pagination from '@/components/common/Pagination';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import DepositModal from '@/components/wallet/DepositModal';
import StatCard from '@/components/layout/StatCard';

const MIN_WITHDRAW = 500;

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

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
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-[var(--accent)] to-purple-500" />
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
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex-1 h-12 bg-slate-900 text-white rounded-2xl font-semibold text-[11px] tracking-tight flex items-center justify-center gap-2">
            <Printer className="size-3.5" /> Print
          </button>
          <button onClick={onClose} className="size-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-200">
            <X className="size-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LogisticsWalletPage() {
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
  const itemsPerPage = 8;
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login?from=logistics-wallet');
    } else if (user.role !== 'logistics') {
      router.replace('/wallet');
    }
  }, [user, router, hasHydrated]);

  if (!hasHydrated || !user || user.role !== 'logistics') return null;

  const load = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [balRes, txRes, escrowRes, wdRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions?limit=50'),
        api.get('/wallet/escrow'),
        api.get('/withdrawals/mine'),
      ]);
      if (balRes.data.success) {
        const nextBalance = balRes.data.data.balance || 0;
        setBalance(nextBalance);
        setWalletBalance(nextBalance);
        setEscrow(balRes.data.data.pending_escrow || 0);
      }
      if (txRes.data.success) setTxs(txRes.data.data.transactions || []);
      if (escrowRes.data.success) setEscrowTxs(escrowRes.data.data.transactions || []);
      if (wdRes.data.success) setWithdrawalRequests(wdRes.data.data.withdrawals || []);
    } catch (e) {
      if (e.response?.status !== 401) console.error('Wallet Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [setWalletBalance]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user?.role === 'logistics') load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, user]);

  // Real-time wallet updates via socket
  useEffect(() => {
    if (!user?._id) return;
    const handleCredited = () => load(true);
    const handleWdPaid   = () => load(true);
    socketService.on('wallet:credited', handleCredited);
    socketService.on('withdrawal:paid', handleWdPaid);
    return () => {
      socketService.off('wallet:credited', handleCredited);
      socketService.off('withdrawal:paid', handleWdPaid);
    };
  }, [user?._id, load]);

  // Keep local balance in sync with auth store (SocketProvider updates storeWalletBalance
  // via refreshWalletBalance() on wallet:credited events, even before load() completes)
  useEffect(() => {
    if (storeWalletBalance !== null && storeWalletBalance !== undefined) {
      setBalance(storeWalletBalance);
    }
  }, [storeWalletBalance]);

  useEffect(() => { setCurrentPage(1); }, [tab]);

  // Total Earned = actual income from deliveries (payout, escrow_release, refund).
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

      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner border border-indigo-500/20 shrink-0">
              <Wallet className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Logistics <span className="text-indigo-500">Wallet</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`size-1.5 rounded-full ${refreshing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                <p className="text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">
                  {refreshing ? 'Syncing…' : 'Secure Account'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => load()}
            disabled={loading || refreshing}
            className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="hidden md:flex items-center gap-3 pr-6 border-r border-[var(--glass-border)]/30">
            <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">Logistics Partner</p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading || refreshing}
            className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-indigo-500/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
          <StatCard label="Available"    value={fmt(balance)}       icon="account_balance_wallet" color="indigo"  sub="XAF Ready"         progress={availRatio}    footer={`${escrowRatioW}% held in escrow`} />
          <StatCard label="In Escrow"    value={fmt(escrow)}        icon="lock_clock"             color="amber"   sub="Pending Release"   progress={escrowRatioW}  footer="Pending delivery confirmation" />
          <StatCard label="Total Earned" value={fmt(totalEarned)}   icon="trending_up"            color="emerald" sub="Lifetime earnings"  progress={Math.min(withdrawRatio + availRatio, 100)} footer={`${fmt(totalEarned)} lifetime`} />
          <StatCard label="Withdrawn"    value={fmt(withdrawnTotal)} icon="arrow_outward"          color="primary" sub="Successful payouts" progress={withdrawRatio} footer={`${fmt(Math.max(totalEarned - withdrawnTotal, 0))} remaining`} />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button onClick={() => setDeposit(true)} className="flex-1 h-14 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-xs tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
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
              {tab === 'history' && <motion.div layoutId="logistics-wallet-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
            </button>
            <button onClick={() => setTab('escrow')} className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'escrow' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
              <div className="flex items-center gap-2">
                <Truck className="size-4" /> Held in Escrow
                {escrowTxs.length > 0 && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}
              </div>
              {tab === 'escrow' && <motion.div layoutId="logistics-wallet-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
            </button>
            <button onClick={() => setTab('withdrawals')} className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'withdrawals' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
              <div className="flex items-center gap-2"><ArrowUpRight className="size-4" /> Withdrawals</div>
              {tab === 'withdrawals' && <motion.div layoutId="logistics-wallet-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
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
                  const isCredit  = tx.type === 'payout' || tx.type === 'escrow_release' || tx.type === 'refund' ||
                    (tx.type === 'deposit' && !(tx.order_ids?.length > 0));
                  const isFailed  = tx.status === 'failed';
                  const isPending = tx.status === 'pending';
                  return (
                    <div key={tx._id || i} onClick={() => setSelectedTx(tx)} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex items-center gap-4 cursor-pointer group">
                      <div className={`size-11 rounded-xl flex items-center justify-center ${
                        isFailed ? 'bg-gray-500/10 text-gray-400' :
                        isCredit ? 'bg-indigo-500/10 text-indigo-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {isCredit ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-[var(--text-primary)] truncate">{tx.description || tx.type}</p>
                          {isPending && <span className="shrink-0 text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md">Pending</span>}
                          {isFailed  && <span className="shrink-0 text-[9px] font-bold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md">Failed</span>}
                        </div>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold ${
                          isFailed ? 'text-gray-400 line-through opacity-50' :
                          isCredit ? 'text-indigo-500' : 'text-red-500'
                        }`}>
                          {isCredit ? '+' : '-'}{fmt(tx.amount)}
                        </p>
                        <p className="text-[10px] font-semibold opacity-20 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                          <Printer className="size-2" /> Receipt
                        </p>
                      </div>
                    </div>
                  );
                })}
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(transactions.length / itemsPerPage)}
                  onPageChange={setCurrentPage}
                />
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
                {escrowTxs.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No escrow transactions</div>
                ) : escrowTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((tx, i) => (
                  <div key={tx._id || i} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-amber-500/20 flex items-center gap-4">
                    <div className="size-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Clock className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[var(--text-primary)] truncate">{tx.description || 'Escrow hold'}</p>
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <p className="text-base font-bold text-amber-500">+{fmt(tx.amount)}</p>
                  </div>
                ))}
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(escrowTxs.length / itemsPerPage)}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}

            {/* Withdrawals */}
            {tab === 'withdrawals' && (
              <div className="space-y-4">
                {withdrawalRequests.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No withdrawal requests yet</div>
                ) : withdrawalRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((wr, i) => {
                  const status = String(wr.status || '').toLowerCase();
                  const isSuccess = ['completed', 'paid', 'successful'].includes(status);
                  const isPending = ['pending', 'processing'].includes(status);
                  return (
                    <div key={wr._id || i} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-4">
                      <div className={`size-11 rounded-xl flex items-center justify-center ${isSuccess ? 'bg-emerald-500/10 text-emerald-500' : isPending ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                        {isSuccess ? <CheckCircle2 className="size-5" /> : isPending ? <Clock className="size-5" /> : <AlertCircle className="size-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[var(--text-primary)]">{fmt(wr.amount)} XAF</p>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{new Date(wr.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${isSuccess ? 'bg-emerald-500/10 text-emerald-600' : isPending ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600'}`}>
                        {status}
                      </span>
                    </div>
                  );
                })}
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(withdrawalRequests.length / itemsPerPage)}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
