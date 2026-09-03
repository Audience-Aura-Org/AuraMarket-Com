"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, ArrowUpRight, ArrowDownLeft,
  Loader2, CheckCircle2, AlertCircle,
  Lock, Building2, RotateCcw, Clock,
  RefreshCw, History, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import DepositModal from '@/components/wallet/DepositModal';
import socketService from '@/services/socket';
import { useLanguage } from '@/context/LanguageContext';

const MIN_WITHDRAW = 500;

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const TX_ICONS = {
  deposit:    { Icon: ArrowDownLeft, color: 'emerald' },
  withdrawal: { Icon: ArrowUpRight,  color: 'red'     },
  payment:    { Icon: ArrowDownLeft, color: 'amber'   },
  refund:     { Icon: ArrowDownLeft, color: 'blue'    },
  payout:     { Icon: Building2,     color: 'purple'  },
};
const TX_ICON_STYLES = {
  amber:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  blue:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  purple:  'bg-purple-500/10 text-purple-500 border-purple-500/20',
  red:     'bg-red-500/10 text-red-500 border-red-500/20',
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

export default function WalletPage() {
  const { user, hasHydrated, authChecked, fetchMe, setWalletBalance } = useAuthStore();
  const { t } = useLanguage();
  const router = useRouter();

  const [mounted,            setMounted]           = useState(false);
  const [balance,            setBalance]           = useState(0);
  const [pendingBalance,     setPendingBalance]    = useState(0);
  const [transactions,       setTransactions]      = useState([]);
  const [withdrawalRequests, setWithdrawalRequests]= useState([]);
  const [loading,            setLoading]           = useState(true);
  const [refreshing,         setRefreshing]        = useState(false);
  const [tab,                setTab]               = useState('history');
  const [selectedTx,         setSelectedTx]        = useState(null);
  const [modal,              setModal]             = useState(null);
  const [toast,              setToast]             = useState(null);
  const [currentPage,        setCurrentPage]       = useState(1);
  const [recheckingTxId,     setRecheckingTxId]    = useState(null);
  const itemsPerPage = 8;

  const loadingRef        = useRef(false);
  const pendingSilentLoad = useRef(false);
  const depositActionHandledRef = useRef(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWallet = useCallback(async (silent = false) => {
    if (loadingRef.current) {
      if (silent) pendingSilentLoad.current = true;
      return;
    }
    loadingRef.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [balRes, txRes, wdRes] = await Promise.allSettled([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
        api.get('/withdrawals/mine'),
      ]);
      if (balRes.status === 'fulfilled' && balRes.value.data.success) {
        const nextBalance = balRes.value.data.data.balance || 0;
        setBalance(nextBalance);
        setWalletBalance(nextBalance);
        setPendingBalance(balRes.value.data.data.pending_escrow || 0);
      }
      if (txRes.status === 'fulfilled' && txRes.value.data.success) {
        const txList = txRes.value.data.data.transactions || [];
        setTransactions(txList);

        // Auto-recheck ALL unsettled gateway transactions (deposits, payments, withdrawals)
        // regardless of age — catches old transactions stuck due to webhook failures.
        const pendingDeposits = txList.filter(
          tx => ['pending', 'failed'].includes(tx.status)
            && ['eversend', 'payunit', 'pawapay'].includes(tx.gateway)
            && ['deposit', 'payment'].includes(tx.type)
            && tx.reference
            && !tx.gateway_transaction_id?.startsWith('SBX-')
        );
        // Auto-recheck pending/approved withdrawal payouts via user-facing endpoint
        const pendingWithdrawals = (wdRes.status === 'fulfilled' && wdRes.value.data.success)
          ? (wdRes.value.data.data.withdrawals || []).filter(
              wd => ['pending', 'approved', 'processing'].includes(wd.status)
                && wd.payout_gateway
                && wd.eversend_transaction_id
            )
          : [];
        if (pendingDeposits.length > 0 || pendingWithdrawals.length > 0) {
          setTimeout(async () => {
            let anyChanged = false;
            for (const tx of pendingDeposits) {
              try {
                const r = await api.get(`/payments/${tx.gateway}/recheck/${tx.reference}`);
                if (r.data?.status === 'SUCCESSFUL' || r.data?.status === 'FAILED') anyChanged = true;
              } catch { /* silent */ }
            }
            for (const wd of pendingWithdrawals) {
              try {
                const r = await api.get(`/withdrawals/mine/${wd._id}/recheck`);
                if (r.data?.status === 'SUCCESSFUL' || r.data?.status === 'FAILED') anyChanged = true;
              } catch { /* silent */ }
            }
            if (anyChanged) fetchWallet(true);
          }, 2000);
        }
      }
      if (wdRes.status === 'fulfilled' && wdRes.value.data.success) {
        setWithdrawalRequests(wdRes.value.data.data.withdrawals || []);
      }
    } catch (err) {
      if (err.response?.status !== 401) console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
      if (pendingSilentLoad.current) {
        pendingSilentLoad.current = false;
        setTimeout(() => fetchWallet(true), 100);
      }
    }
  }, [setWalletBalance]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !hasHydrated) return;
    // On a hard refresh native/browser storage can hydrate before /auth/me
    // restores the user object. Wait for that restore instead of treating a
    // transient empty user as a logged-out wallet session.
    if (!user) {
      if (!authChecked) fetchMe();
      else router.replace('/login?from=wallet');
      return;
    }
    // On hard refresh, Zustand restores the persisted user but the session may
    // be stale. Kick off fetchMe in the background to revalidate — but don't
    // block wallet loading, since fetchWallet's own 401 handling covers expiry.
    if (!authChecked) {
      fetchMe();
    }
    if (user.role === 'admin') { router.replace('/admin/withdrawals'); return; }
    fetchWallet();

    if (!depositActionHandledRef.current) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('action') === 'deposit') {
        depositActionHandledRef.current = true;
        setModal('deposit');
        router.replace('/wallet', { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, hasHydrated, authChecked, user?._id, user?.role, fetchMe, router]);

  useEffect(() => {
    if (!user?._id) return;
    const handleCredited = () => { setCurrentPage(1); fetchWallet(true); };
    const handleWdPaid   = () => fetchWallet(true);
    socketService.on('wallet:credited', handleCredited);
    socketService.on('wallet:debited', handleCredited);
    socketService.on('withdrawal:paid', handleWdPaid);
    return () => {
      socketService.off('wallet:credited', handleCredited);
      socketService.off('wallet:debited', handleCredited);
      socketService.off('withdrawal:paid', handleWdPaid);
    };
  }, [user?._id, fetchWallet]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user) fetchWallet(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchWallet, user]);

  useEffect(() => { setCurrentPage(1); }, [tab]);

  const handleRecheckTx = async (tx) => {
    setRecheckingTxId(tx._id);
    try {
      if (!['eversend', 'payunit', 'pawapay'].includes(tx.gateway)) {
        showToast('This gateway is not supported for recheck.', 'error');
        return;
      }
      const res = await api.get(`/payments/${tx.gateway}/recheck/${tx.reference}`);
      const { status, message, reason } = res.data;
      if (status === 'SUCCESSFUL') {
        showToast('Payment confirmed! Your wallet has been credited.', 'success');
        window.dispatchEvent(new CustomEvent('aura:wallet-updated'));
        fetchWallet(true);
      } else if (status === 'FAILED') {
        showToast(reason || message || 'Payment could not be confirmed.', 'error');
        window.dispatchEvent(new CustomEvent('aura:wallet-updated'));
        fetchWallet(true);
      } else {
        showToast('Still processing — your phone may still have a pending prompt.', 'info');
      }
    } catch {
      showToast('Could not reach server. Try again shortly.', 'error');
    } finally {
      setRecheckingTxId(null);
    }
  };

  if (!mounted || !hasHydrated || !user) return null;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalIn = transactions
    .filter(tx => tx.status === 'completed' &&
      (tx.type === 'refund' || tx.type === 'payout' ||
       (tx.type === 'deposit' && !(tx.order_ids?.length > 0))))
    .reduce((s, tx) => s + (tx.amount || 0), 0);

  const totalOut = transactions
    .filter(tx => tx.status === 'completed' &&
      (tx.type === 'withdrawal' || tx.type === 'payment' ||
       (tx.type === 'deposit' && tx.order_ids?.length > 0)))
    .reduce((s, tx) => s + (tx.amount || 0), 0);

  const totalFunds   = balance + pendingBalance;
  const availRatio   = totalFunds > 0 ? Math.round((balance / totalFunds) * 100) : 0;
  const escrowRatio  = totalFunds > 0 ? Math.round((pendingBalance / totalFunds) * 100) : 0;
  const spentRatio   = totalIn > 0 ? Math.min(Math.round((totalOut / totalIn) * 100), 100) : 0;
  const inRatio      = totalIn > 0 ? Math.min(Math.round((balance / totalIn) * 100), 100) : 0;

  // Displayed list for current tab
  const displayItems = tab === 'withdrawals' ? withdrawalRequests : transactions;
  const currentItems = displayItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <DashboardLayout role={user?.role || 'customer'} hideSidebar={true}>

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

      {/* Receipt modal */}
      <AnimatePresence>
        {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="py-3 flex items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)]/40 bg-[var(--bg-secondary)]/40 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/15 shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
              {t('wallet.myWallet', 'My Wallet')}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`size-1.5 rounded-full ${refreshing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-40 uppercase">
                {refreshing ? 'Syncing…' : t('wallet.secureAccount', 'Secure Account')}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchWallet()}
          disabled={loading || refreshing}
          className="size-9 rounded-xl border border-[var(--glass-border)]/50 bg-transparent text-[var(--text-secondary)] flex items-center justify-center active:scale-95 disabled:opacity-40 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
          <StatCard
            label={t('wallet.available', 'Available')}
            value={fmt(balance)}
            icon="account_balance_wallet"
            color="emerald"
            sub="XAF Ready"
            progress={availRatio}
            footer={`${escrowRatio}% held in escrow`}
            loading={loading}
          />
          <StatCard
            label={t('wallet.inEscrow', 'In Escrow')}
            value={fmt(pendingBalance)}
            icon="lock_clock"
            color="amber"
            sub="Pending Delivery"
            progress={escrowRatio}
            footer="Pending delivery confirmation"
            loading={loading}
          />
          <StatCard
            label="Money In"
            value={fmt(totalIn)}
            icon="trending_up"
            color="fuchsia"
            sub="Total credited"
            progress={inRatio}
            footer={`${fmt(totalIn)} lifetime`}
            loading={loading}
          />
          <StatCard
            label="Money Out"
            value={fmt(totalOut)}
            icon="arrow_outward"
            color="blue"
            sub="Total spent"
            progress={spentRatio}
            footer={`${fmt(Math.max(totalIn - totalOut, 0))} remaining`}
            loading={loading}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => setModal('deposit')}
            className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <ArrowDownLeft className="size-5" /> {t('wallet.depositMoney', 'Deposit Funds')}
          </button>
          <button
            onClick={() => setModal('withdraw')}
            disabled={balance < MIN_WITHDRAW}
            className="flex-1 h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-xs tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all disabled:opacity-30"
          >
            <ArrowUpRight className="size-5" /> {t('wallet.withdrawMoney', 'Withdraw Funds')}
          </button>
        </div>

        {/* Tabs + Ledger */}
        <div className="space-y-6">
          <div className="flex items-center gap-6 border-b border-[var(--glass-border)]">
            <button
              onClick={() => setTab('history')}
              className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'history' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}
            >
              <div className="flex items-center gap-2"><History className="size-4" /> {t('wallet.transactionHistory', 'Transaction History')}</div>
              {tab === 'history' && <motion.div layoutId="wallet-tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
            </button>
            <button
              onClick={() => setTab('withdrawals')}
              className={`pb-4 text-xs font-bold tracking-tight relative ${tab === 'withdrawals' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}
            >
              <div className="flex items-center gap-2"><ArrowUpRight className="size-4" /> {t('wallet.tab.withdrawals', 'Withdrawals')}</div>
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
                  <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">
                    {t('wallet.noRecords', 'No transaction records found')}
                  </div>
                ) : currentItems.map((tx, i) => {
                  const config = TX_ICONS[tx.type] || TX_ICONS.payment;
                  const iconStyle = TX_ICON_STYLES[config.color] || TX_ICON_STYLES.amber;
                  const isCredit = (tx.type === 'deposit' && !(tx.order_ids?.length > 0))
                    || tx.type === 'refund' || tx.type === 'payout';
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
                              ? <><Loader2 className="size-3 animate-spin" /> {t('wallet.checking', 'Checking...')}</>
                              : <><RotateCcw className="size-3" /> {t('wallet.recheckPayment', 'Recheck payment')}</>
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

            {/* Withdrawals */}
            {tab === 'withdrawals' && (
              <div className="space-y-2">
                {withdrawalRequests.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">
                    {t('wallet.noWithdrawals', 'No withdrawal requests found')}
                  </div>
                ) : currentItems.map((wr) => (
                  <div key={wr._id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-4">
                    <div className={`size-11 rounded-xl flex items-center justify-center ${
                      wr.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                      wr.status === 'pending'   ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {wr.status === 'completed' ? <CheckCircle2 className="size-5" /> :
                       wr.status === 'pending'   ? <Clock className="size-5" /> :
                       <AlertCircle className="size-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[var(--text-primary)] capitalize">{wr.withdrawal_method} {t('wallet.withdrawal', 'Withdrawal')}</p>
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
              totalPages={Math.ceil(displayItems.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal
        open={modal === 'deposit'}
        onClose={() => setModal(null)}
        onSuccess={() => { setModal(null); setTimeout(() => window.location.reload(), 600); }}
        userPhone={user?.phone}
      />
      <AnimatePresence>
        {modal === 'withdraw' && (
          <WithdrawModal
            balance={balance}
            onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); setTimeout(() => window.location.reload(), 600); }}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
