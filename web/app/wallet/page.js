"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Loader2, CheckCircle2, AlertCircle,
  Lock, Building2,
  RotateCcw, Clock
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import DepositModal from '@/components/wallet/DepositModal';
import socketService from '@/services/socket';
import { useLanguage } from '@/context/LanguageContext';

const TX_ICONS = {
  deposit:    { Icon: ArrowDownLeft,  color: 'emerald' },
  withdrawal: { Icon: ArrowUpRight,   color: 'red' },
  payment:    { Icon: ArrowDownLeft,  color: 'amber' },
  refund:     { Icon: ArrowDownLeft,  color: 'blue' },
  payout:     { Icon: Building2,      color: 'purple' },
};

const TX_ICON_STYLES = {
  amber:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  blue:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  purple:  'bg-purple-500/10 text-purple-500 border-purple-500/20',
  red:     'bg-red-500/10 text-red-500 border-red-500/20'
};

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

function CompactStat({ title, value, sub, icon: Icon, color }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-4 hover:border-[var(--accent)]/30 transition-all group font-poppins">
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-8 rounded-lg flex items-center justify-center border ${colors[color] || colors.blue}`}>
          <Icon className="size-4" />
        </div>
        <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight opacity-50">{title}</p>
      </div>
      <h3 className="text-xl  font-bold text-[var(--text-primary)] tracking-tighter">{value}</h3>
      {sub && <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 mt-1 tracking-tight">{sub}</p>}
    </div>
  );
}

export default function WalletPage() {
  const { user, hasHydrated, setWalletBalance, walletBalance } = useAuthStore();
  const { t } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [recheckingTxId, setRecheckingTxId] = useState(null);
  const itemsPerPage = 10;

  // Concurrent load guard: prevent double-fetching and ensure credits aren't dropped.
  const loadingRef        = useRef(false);
  const pendingSilentLoad = useRef(false);

  // Guard: only open from ?action=deposit ONCE per page load.
  const depositActionHandledRef = useRef(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWallet = useCallback(async (silent = false) => {
    // Prevent concurrent loads; queue any missed silent loads so credits aren't dropped.
    if (loadingRef.current) {
      if (silent) pendingSilentLoad.current = true;
      return;
    }
    loadingRef.current = true;
    if (!silent) setLoading(true);
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

        // ── AUTO-RECHECK PENDING DEPOSITS ───────────────────────────────────
        // Silently re-verify any pending gateway deposit < 30 min old.
        const pending = txList.filter(
          tx => tx.status === 'pending'
            && ['eversend', 'payunit'].includes(tx.gateway)
            && tx.type === 'deposit'
            && !tx.gateway_transaction_id?.startsWith('SBX-')
            && (Date.now() - new Date(tx.createdAt).getTime()) < 30 * 60 * 1000
        );
        if (pending.length > 0) {
          setTimeout(async () => {
            let anyChanged = false;
            for (const tx of pending) {
              try {
                const r = await api.get(`/payments/${tx.gateway}/recheck/${tx.reference}`);
                if (r.data?.status === 'SUCCESSFUL' || r.data?.status === 'FAILED') {
                  anyChanged = true;
                }
              } catch { /* silent */ }
            }
            if (anyChanged) {
              fetchWallet(true);
            }
          }, 2000);
        }
        // ────────────────────────────────────────────────────────────────────
      }
      if (wdRes.status === 'fulfilled' && wdRes.value.data.success) {
        setWithdrawalRequests(wdRes.value.data.data.withdrawals || []);
      }
    } catch (err) {
      if (err.response?.status !== 401) console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      if (pendingSilentLoad.current) {
        pendingSilentLoad.current = false;
        setTimeout(() => fetchWallet(true), 100);
      }
    }
  }, [setWalletBalance]);

  // Keep local balance in sync with Zustand store (updated on login / top-nav hook).
  useEffect(() => {
    if (walletBalance !== null) setBalance(walletBalance);
  }, [walletBalance]);

  // Refresh when wallet:updated event fires (e.g. from useWalletBalance hook).
  useEffect(() => {
    const onWalletUpdated = () => fetchWallet(true);
    window.addEventListener('aura:wallet-updated', onWalletUpdated);
    return () => window.removeEventListener('aura:wallet-updated', onWalletUpdated);
  }, [fetchWallet]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !hasHydrated) return;
    if (!user) {
      router.replace('/login?from=wallet');
      return;
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
  }, [mounted, hasHydrated, user?._id, user?.role]);

  // Real-time balance updates via socket.
  useEffect(() => {
    if (!user?._id) return;
    const handleWalletCredited = () => {
      setCurrentPage(1);
      fetchWallet(true);
    };
    const handleWithdrawalPaid = () => fetchWallet(true);

    socketService.on('wallet:credited', handleWalletCredited);
    socketService.on('withdrawal:paid', handleWithdrawalPaid);
    return () => {
      socketService.off('wallet:credited', handleWalletCredited);
      socketService.off('withdrawal:paid', handleWithdrawalPaid);
    };
  }, [user?._id, fetchWallet]);

  // Visibility-based silent refresh.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user) fetchWallet(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchWallet, user]);

  // Recheck a specific pending transaction from the ledger.
  const handleRecheckTx = async (tx) => {
    setRecheckingTxId(tx._id);
    try {
      if (!['eversend', 'payunit'].includes(tx.gateway)) {
        showToast('This gateway is not supported for recheck.', 'error');
        return;
      }
      const endpoint = `/payments/${tx.gateway}/recheck/${tx.reference}`;
      const res = await api.get(endpoint);
      const { status, message, reason } = res.data;
      if (status === 'SUCCESSFUL') {
        showToast('Payment confirmed! Your wallet has been credited.', 'success');
        fetchWallet(true);
      } else if (status === 'FAILED') {
        showToast(reason || message || 'Payment could not be confirmed.', 'error');
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

  if (!mounted || !user) return null;

  const filteredTransactions = transactions.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in') return tx.type === 'refund' || tx.type === 'payout' ||
      (tx.type === 'deposit' && !(tx.order_ids?.length > 0));
    if (activeTab === 'out') return tx.type === 'withdrawal' || tx.type === 'payment' ||
      (tx.type === 'deposit' && tx.order_ids?.length > 0);
    return true;
  });

  const displayItems  = activeTab === 'withdrawals' ? withdrawalRequests : filteredTransactions;
  const currentItems  = displayItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <DashboardLayout role={user?.role || 'customer'} hideSidebar={true}>
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-[1001] px-5 py-3 rounded-2xl shadow-2xl font-poppins font-semibold text-sm tracking-tight flex items-center gap-2 border ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400'
              : toast.type === 'error'   ? 'bg-rose-500 text-white border-rose-400'
              : 'bg-[var(--accent)] text-white border-[var(--accent)]'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="size-4 shrink-0" />}
            {toast.type === 'error'   && <AlertCircle  className="size-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-poppins">

        {/* Header */}
        <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <Wallet className="size-5" />
              </div>
              <div>
                <h1 className="text-lg  font-bold tracking-tight">My Wallet</h1>
                <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">{t('wallet.availableBalance', 'Available Balance')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                <ShieldCheck className="size-3 text-emerald-500" />
                <span className="text-[10px] lg:text-[12px]  font-semibold text-emerald-500 tracking-tight">{t('wallet.secureAccount', 'Secure Account')}</span>
              </div>
              <button onClick={() => fetchWallet()} className="p-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                <RotateCcw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">

          {/* Stat Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactStat title={t('wallet.available', 'Available')} value={fmt(balance)} sub={t('wallet.availableToSpend', 'Available to spend')} icon={Wallet} color="emerald" />
            <CompactStat title={t('wallet.inEscrow', 'In escrow')} value={fmt(pendingBalance)} sub={t('wallet.heldInEscrow', 'Held in escrow')} icon={Lock} color="amber" />
            <CompactStat
              title="Money In"
              value={`${fmt(transactions.filter(tx =>
                  tx.status === 'completed' &&
                  (tx.type === 'refund' || tx.type === 'payout' ||
                   (tx.type === 'deposit' && !(tx.order_ids?.length > 0)))
                ).reduce((s, tx) => s + Number(tx.amount || 0), 0))} XAF`}
              sub={`${transactions.filter(tx =>
                  tx.status === 'completed' &&
                  (tx.type === 'refund' || tx.type === 'payout' ||
                   (tx.type === 'deposit' && !(tx.order_ids?.length > 0)))
                ).length} credit transactions`}
              icon={ArrowDownLeft}
              color="emerald"
            />
            <CompactStat
              title="Money Out"
              value={`${fmt(transactions.filter(tx =>
                  tx.status === 'completed' &&
                  (tx.type === 'withdrawal' || tx.type === 'payment' ||
                   (tx.type === 'deposit' && tx.order_ids?.length > 0))
                ).reduce((s, tx) => s + Number(tx.amount || 0), 0))} XAF`}
              sub={`${transactions.filter(tx => tx.status === 'failed' || tx.status === 'rejected').length} failed transactions`}
              icon={ArrowUpRight}
              color="red"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setModal('deposit')}
              className="h-14 rounded-2xl bg-emerald-500 text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <ArrowDownLeft className="size-5" /> {t('wallet.depositMoney', 'Deposit Money')}
            </button>
            <button
              onClick={() => setModal('withdraw')}
              className="h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--bg-secondary)]/80 active:scale-95 transition-all"
            >
              <ArrowUpRight className="size-5" /> {t('wallet.withdrawMoney', 'Withdraw Money')}
            </button>
          </div>

          {/* Activity Ledger */}
          <section className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">{t('wallet.transactionHistory', 'Transaction History')}</h3>
                <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 mt-1 tracking-tight">{t('wallet.realTimeHistory', 'Real-time transaction history')}</p>
              </div>
              <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5 overflow-x-auto no-scrollbar">
                {['all', 'in', 'out', 'withdrawals'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                    className={`px-4 py-1.5 rounded-lg text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] opacity-40'}`}
                  >
                    {t(`wallet.tab.${tab}`, tab)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 min-h-[400px]">
              {loading ? <LoadingSpinner /> : currentItems.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-20 text-sm">{t('wallet.noRecords', 'No {type} records found', { type: t(`wallet.tab.${activeTab}`, activeTab) })}</div>
              ) : activeTab === 'withdrawals' ? (
                currentItems.map((wr, i) => (
                  <div key={wr._id || i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${
                      wr.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      wr.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {wr.status === 'completed' ? <CheckCircle2 className="size-4" /> :
                       wr.status === 'pending' ? <Clock className="size-4" /> :
                       <AlertCircle className="size-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate capitalize">{wr.withdrawalMethod} {t('wallet.withdrawal', 'withdrawal')}</p>
                      <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight capitalize">{new Date(wr.createdAt).toLocaleDateString()} • {wr.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base  font-bold tracking-tight">{fmt(wr.amount)}</p>
                      <p className="text-[10px] lg:text-[12px]  font-semibold opacity-20">{wr.currency}</p>
                    </div>
                  </div>
                ))
              ) : (
                currentItems.map((tx, i) => {
                  const config = TX_ICONS[tx.type] || TX_ICONS.payment;
                  const iconStyle = TX_ICON_STYLES[config.color] || TX_ICON_STYLES.amber;
                  const isCredit = (tx.type === 'deposit' && !(tx.order_ids?.length > 0))
                    || tx.type === 'refund'
                    || tx.type === 'payout';
                  return (
                    <div key={tx._id || i} className={`flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border transition-all group cursor-pointer ${
                      tx.status === 'pending' && ['eversend', 'payunit'].includes(tx.gateway) && tx.type === 'deposit'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-[var(--glass-border)] hover:border-[var(--accent)]/30'
                    }`}>
                      <div className={`size-10 rounded-xl flex items-center justify-center border ${iconStyle}`}>
                        <config.Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate capitalize">{tx.description || tx.type}</p>
                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        {['pending', 'failed'].includes(tx.status) && ['eversend', 'payunit'].includes(tx.gateway) && tx.type === 'deposit' && (
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
                        <p className={`text-base  font-bold tracking-tight ${
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
                          <p className={`text-[10px] lg:text-[12px]  font-semibold tracking-tight ${
                            tx.status === 'completed' ? 'text-emerald-500/50' :
                            tx.status === 'failed' ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {tx.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="pt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(displayItems.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      <DepositModal
        open={modal === 'deposit'}
        onClose={() => setModal(null)}
        onSuccess={() => { fetchWallet(true); setModal(null); }}
        userPhone={user?.phone}
      />
      <AnimatePresence>
        {modal === 'withdraw' && (
          <WithdrawModal
            balance={balance}
            onClose={() => setModal(null)}
            onSuccess={() => { fetchWallet(true); setModal(null); }}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
