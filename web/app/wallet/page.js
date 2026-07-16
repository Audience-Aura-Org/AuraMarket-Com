"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  Loader2, X, CheckCircle2, AlertCircle,
  Lock, ArrowRightLeft, Sparkles, Building2,
  TrendingUp, Activity, ChevronRight, Smartphone,
  Network, AlertTriangle, RotateCcw, XCircle, Clock
} from 'lucide-react';
import { initiateCollection, pollTransactionStatus } from '@/services/paymentProvider';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import socketService from '@/services/socket';
import { useLanguage } from '@/context/LanguageContext';

const MOBILE_MONEY_COLLECTION_FEE_XAF = 50;

const TX_ICONS = {
  deposit:    { Icon: ArrowDownLeft,  color: 'emerald' },
  withdrawal: { Icon: ArrowUpRight,   color: 'red' },
  payment:    { Icon: ArrowDownLeft,  color: 'amber' },
  refund:     { Icon: ArrowDownLeft,  color: 'blue' },
  payout:     { Icon: Building2,      color: 'purple' },
};

const TX_ICON_STYLES = {
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  red: 'bg-red-500/10 text-red-500 border-red-500/20'
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

function ElapsedTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const label = m > 0 ? `${m}m ${s}s` : `${s}s`;
  return (
    <div className="mb-6 flex flex-col items-center">
      <div className="text-4xl font-bold tracking-tight text-[var(--accent)] tabular-nums">{label}</div>
      <p className="text-[10px] font-semibold opacity-30 tracking-tight mt-1">elapsed</p>
    </div>
  );
}

export default function WalletPage() {
  const { user, hasHydrated, setWalletBalance, walletBalance, refreshWalletBalance } = useAuthStore();
  const { t } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  
  // Deposit Workflow State
  const [depositStep, setDepositStep] = useState('amount'); // 'amount' | 'phone' | 'processing' | 'result'
  const phoneInitializedRef = useRef(false);
  // WhatsApp-style guard: synchronous flag set BEFORE any state update to prevent double-tap
  const depositInProgressRef = useRef(false);
  const [depositGateway, setDepositGateway] = useState('payunit');
  const [depositPhone, setDepositPhone] = useState(user?.phone || '');
  const [depositNetwork, setDepositNetwork] = useState('CM');
  const [depositService, setDepositService] = useState('CM_MTNMOMO');
  const [depositRef, setDepositRef] = useState(null);
  const [depositStatus, setDepositStatus] = useState('pending');
  const [depositMessage, setDepositMessage] = useState('');
  const [depositReason, setDepositReason] = useState('');
  const [recheckingDeposit, setRecheckingDeposit] = useState(false);
  const [recheckingTxId, setRecheckingTxId] = useState(null);
  const itemsPerPage = 10;

  // Guard: only open from ?action=deposit ONCE per page load, even if user/router re-render.
  // Root cause of re-open: setWalletBalance() creates a new user object reference which
  // triggers useEffect([..., user]) to re-fire before router.replace() clears the URL.
  const depositActionHandledRef = useRef(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWallet = async () => {
    try {
      const [balRes, txRes, wdRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
        api.get('/withdrawals/mine'),
      ]);
      if (balRes.data.success) {
        const nextBalance = balRes.data.data.balance || 0;
        setBalance(nextBalance);
        setWalletBalance(nextBalance);
        setPendingBalance(balRes.data.data.pending_escrow || 0);
      }
      if (txRes.data.success) {
        const txList = txRes.data.data.transactions || [];
        setTransactions(txList);

        // ── AUTO-RECHECK PENDING EVERSEND DEPOSITS ──────────────────────────
        // Silently re-verify any pending eversend deposit < 30 min old.
        // Runs in background — does not block UI rendering.
        const pending = txList.filter(
          tx => tx.status === 'pending'
            && ['eversend', 'payunit'].includes(tx.gateway)
            && tx.type === 'deposit'
            && !tx.gateway_transaction_id?.startsWith('SBX-') // skip sandbox test transactions
            && (Date.now() - new Date(tx.createdAt).getTime()) < 30 * 60 * 1000
        );
        if (pending.length > 0) {
          setTimeout(async () => {
            let anyChanged = false;
            for (const tx of pending) {
              try {
                const endpoint = `/payments/${tx.gateway}/recheck/${tx.reference}`;
                const r = await api.get(endpoint);
                if (r.data?.status === 'SUCCESSFUL' || r.data?.status === 'FAILED') {
                  anyChanged = true;
                }
              } catch { /* silent — don't disrupt UI */ }
            }
            if (anyChanged) {
              // Refresh silently to show updated statuses
              try {
                const [b2, t2] = await Promise.all([api.get('/wallet'), api.get('/wallet/transactions')]);
                if (b2.data.success) {
                  const nextBalance = b2.data.data.balance || 0;
                  setBalance(nextBalance);
                  setWalletBalance(nextBalance);
                  setPendingBalance(b2.data.data.pending_escrow || 0);
                }
                if (t2.data.success) setTransactions(t2.data.data.transactions || []);
              } catch { /* silent */ }
            }
          }, 2000);
        }
        // ────────────────────────────────────────────────────────────────────
      }
      if (wdRes.data.success) setWithdrawalRequests(wdRes.data.data.withdrawals || []);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletBalance !== null) setBalance(walletBalance);
  }, [walletBalance]);

  useEffect(() => {
    const onWalletUpdated = () => { fetchWallet(); };
    window.addEventListener('aura:wallet-updated', onWalletUpdated);
    return () => window.removeEventListener('aura:wallet-updated', onWalletUpdated);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // Wait for both client mount and Zustand rehydration to prevent login-page flash
    if (!mounted || !hasHydrated) return;
    if (!user) {
      router.replace('/login?from=wallet');
      return;
    }
    if (user.role === 'admin')  { router.replace('/admin/withdrawals'); return; }
    fetchWallet();

    // depositActionHandledRef guards against the modal re-opening when setWalletBalance()
    // creates a new user object reference (triggering this effect) before router.replace()
    // has a chance to clear the URL. Only open once per page load.
    if (!depositActionHandledRef.current) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('action') === 'deposit') {
        depositActionHandledRef.current = true;
        setModal('deposit');
        setDepositStep('amount');
        setDepositGateway('payunit');
        setDepositStatus('pending');
        setDepositReason('');
        setDepositRef(null);
        setDepositMessage('');
        router.replace('/wallet', { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, hasHydrated, user?._id, user?.role]);

  // Initialize phone once — never overwrite after user edits the field
  useEffect(() => {
    if (!phoneInitializedRef.current && user?.phone) {
      setDepositPhone(user.phone);
      phoneInitializedRef.current = true;
    }
  }, [user?.phone]);

  // ── Stable refs so socket handler never needs to re-subscribe ───────────
  const depositStepRef  = useRef(depositStep);
  const depositRefRef   = useRef(depositRef);
  useEffect(() => { depositStepRef.current = depositStep; }, [depositStep]);
  useEffect(() => { depositRefRef.current  = depositRef;  }, [depositRef]);

  // ── Socket: instant wallet credit notification ──────────────────────────
  // Listener is registered ONCE per user session (dep: user._id only).
  // It reads depositStep / depositRef through stable refs to avoid
  // tearing down and re-registering on every step change.
  useEffect(() => {
    if (!user?._id) return;

    const handleWalletCredited = (data) => {
      setCurrentPage(1);
      fetchWallet();
      if (data.type === 'deposit' && (depositStepRef.current === 'processing' || depositRefRef.current)) {
        setDepositStatus('success');
        setDepositStep('result');
        setDepositMessage('Payment confirmed! Your wallet has been credited.');
      }
    };
    const handleWithdrawalPaid = () => fetchWallet();

    socketService.on('wallet:credited', handleWalletCredited);
    socketService.on('withdrawal:paid', handleWithdrawalPaid);
    return () => {
      socketService.off('wallet:credited', handleWalletCredited);
      socketService.off('withdrawal:paid', handleWithdrawalPaid);
    };
  }, [user?._id]); // stable — only re-subscribes when the logged-in user changes
  // ───────────────────────────────────────────────────────────────────────

  if (!mounted || !user) return null;

  const depositNetAmount = Math.max(0, Number(amount || 0));
  const depositCollectionFee = depositNetAmount > 0 ? MOBILE_MONEY_COLLECTION_FEE_XAF : 0;
  const depositApprovalAmount = depositNetAmount + depositCollectionFee;

  const startDeposit = async () => {
    const min = depositGateway === 'eversend' ? 500 : 1;
    if (!amount || Number(amount) < min) return showToast(`Minimum deposit is ${min} XAF.`, 'error');
    setDepositStep('phone');
  };

  const handleDepositInit = async () => {
    // ── WhatsApp-style double-tap guard (synchronous, before any setState) ──
    if (depositInProgressRef.current) return;
    depositInProgressRef.current = true;

    const min = depositGateway === 'eversend' ? 500 : 1;
    if (!amount || Number(amount) < min) {
      depositInProgressRef.current = false;
      return showToast(`Minimum deposit is ${min} XAF.`, 'error');
    }
    if (!depositPhone) {
      depositInProgressRef.current = false;
      return showToast('Phone number is required.', 'error');
    }

    // ── Switch to processing frame BEFORE the API call ──
    setDepositStep('processing');
    setDepositMessage('Sending request to payment gateway...');
    setSubmitting(true);

    // Ensure processing frame is visible for at least 1.5 s (like WhatsApp's send indicator)
    const processingStart = Date.now();
    const holdProcessing = (minMs = 1500) =>
      new Promise(r => setTimeout(r, Math.max(0, minMs - (Date.now() - processingStart))));

    let localRef = null;
    try {
      const payload = {
        amount: Number(amount),
        currency: 'XAF',
        phone: depositPhone,
        country: depositNetwork,
        provider: depositGateway === 'payunit' ? depositService : undefined,
      };

      const res = await initiateCollection(depositGateway, payload);
      await holdProcessing(); // guarantee the user sees the processing screen

      if (res.success) {
        localRef = res.data?.reference;
        setDepositRef(localRef);
        setDepositMessage('Charge request sent. Awaiting approval on your phone...');

        // Poll every 3 s for up to 110 s; socket push handles the instant-credit case
        pollTransactionStatus(
          depositGateway,
          localRef,
          {
            onPending: (data) => setDepositMessage(data.message || 'Awaiting mobile money confirmation...'),
            onSuccess: () => {
              setDepositStatus('success');
              setDepositStep('result');
              setDepositMessage('Payment confirmed! Your wallet has been credited.');
              setCurrentPage(1); // bring user back to page 1 so new transaction is visible
              fetchWallet();
            },
            onFailed: (data) => {
              setDepositStatus('failed');
              setDepositStep('result');
              setDepositReason(data.reason || 'Payment was declined by the gateway.');
            },
            onTimeout: async () => {
              setDepositStatus('timeout');
              setDepositStep('result');
              setDepositMessage('Verification window ended. Checking payment status one more time...');
              try {
                if (localRef) {
                  const r = await api.get(`/payments/${depositGateway}/recheck/${localRef}`);
                  if (r.data?.status === 'SUCCESSFUL') {
                    setDepositStatus('success');
                    setDepositMessage('Payment confirmed! Your wallet has been credited.');
                    setCurrentPage(1);
                    fetchWallet();
                    return;
                  } else if (r.data?.status === 'FAILED') {
                    setDepositStatus('failed');
                    setDepositReason(r.data?.reason || r.data?.message || 'Payment was declined.');
                    return;
                  }
                }
              } catch { /* silent — show timeout screen as fallback */ }
              setDepositMessage('Could not confirm automatically. If you approved the USSD prompt, tap "Recheck Payment" below.');
            },
          },
          3000,
          110000,
        );
      } else {
        setDepositStatus('failed');
        setDepositStep('result');
        setDepositReason(res.message || 'Payment initiation failed. Please try again.');
      }
    } catch (err) {
      await holdProcessing(); // still show processing screen briefly on error
      const errMsg = err?.response?.data?.message;
      setDepositStatus('timeout');
      setDepositStep('result');
      setDepositMessage(
        errMsg
          ? errMsg
          : localRef
            ? 'Request sent but server confirmation was interrupted. Use "Recheck Payment" below.'
            : 'Could not reach the payment gateway. If you received and approved a USSD prompt on your phone, your payment may still be processing — check your transaction history below.',
      );
      if (localRef) setDepositRef(localRef);
    } finally {
      setSubmitting(false);
      // depositInProgressRef stays true until user explicitly goes back to the form
    }
  };

  const handleDepositRecheck = async () => {
    if (!depositRef) return;
    setRecheckingDeposit(true);
    try {
      const endpoint = `/payments/${depositGateway}/recheck/${depositRef}`;
      const res = await api.get(endpoint);
      const { status, data, message, reason } = res.data;
      if (status === 'SUCCESSFUL') {
        setDepositStatus('success');
        setDepositStep('result');
        setDepositMessage(message || 'Payment confirmed! Your wallet has been credited.');
        fetchWallet();
      } else if (status === 'FAILED') {
        setDepositStatus('failed');
        setDepositReason(reason || message || 'Payment was declined.');
      } else {
        showToast('Still processing — please wait a moment and try again.', 'info');
      }
    } catch {
      showToast('Could not reach server. Please try again.', 'error');
    } finally {
      setRecheckingDeposit(false);
    }
  };

  const handleAction = async (type) => {
    if (type === 'deposit') {
      // Reset ONLY if we're not mid-transaction
      if (!['processing'].includes(depositStep)) {
        depositInProgressRef.current = false; // allow a fresh deposit attempt
        setDepositStep('amount');
        setDepositGateway('payunit');
        setDepositStatus('pending');
        setDepositReason('');
        setDepositRef(null);
        setDepositMessage('');
      }
      setModal('deposit');
      return;
    }
  };

  // Recheck a specific pending transaction from the ledger
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
        fetchWallet();
      } else if (status === 'FAILED') {
        showToast(reason || message || 'Payment could not be confirmed.', 'error');
        fetchWallet();
      } else {
        showToast('Still processing — your phone may still have a pending prompt.', 'info');
      }
    } catch {
      showToast('Could not reach server. Try again shortly.', 'error');
    } finally {
      setRecheckingTxId(null);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in') return ['deposit', 'refund', 'payout'].includes(tx.type);
    if (activeTab === 'out') return ['withdrawal', 'payment'].includes(tx.type);
    return true;
  });

  const displayItems = activeTab === 'withdrawals' ? withdrawalRequests : filteredTransactions;
  const currentItems = displayItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <DashboardLayout role={user?.role || 'customer'} hideSidebar={true}>
      {/* Toast notification — must sit above all modals (z-[1001]) */}
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
               <button onClick={fetchWallet} className="p-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                  <RotateCcw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
               </button>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
          
          {/* Micro Stat Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactStat title={t('wallet.available', 'Available')} value={fmt(balance)} sub={t('wallet.availableToSpend', 'Available to spend')} icon={Wallet} color="emerald" />
            <CompactStat title={t('wallet.inEscrow', 'In escrow')} value={fmt(pendingBalance)} sub={t('wallet.heldInEscrow', 'Held in escrow')} icon={Lock} color="amber" />
            <CompactStat
              title="Money In"
              value={`${fmt(transactions.filter(tx =>
                  tx.status === 'completed' &&
                  (tx.type === 'refund' || tx.type === 'payout' ||
                   (tx.type === 'deposit' && !(tx.order_ids?.length > 0))) // exclude legacy checkout deposits
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
                   (tx.type === 'deposit' && tx.order_ids?.length > 0)) // legacy checkout deposits
                ).reduce((s, tx) => s + Number(tx.amount || 0), 0))} XAF`}
              sub={`${transactions.filter(tx => tx.status === 'failed' || tx.status === 'rejected').length} failed transactions`}
              icon={ArrowUpRight}
              color="red"
            />
          </div>

          {/* Action Hub */}
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => handleAction('deposit')} className="h-14 rounded-2xl bg-emerald-500 text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all">
                 <ArrowDownLeft className="size-5" /> {t('wallet.depositMoney', 'Deposit Money')}
             </button>
             <button onClick={() => setModal('withdraw')} className="h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--bg-secondary)]/80 active:scale-95 transition-all">
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
                      <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-lg text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] opacity-40'}`}>
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
                      // type:'payment' = checkout spend; legacy checkout deposits have order_ids
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
                            {/* Inline recheck for stuck pending eversend deposits */}
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

        {/* Action Modals */}
        <AnimatePresence>
          {modal === 'deposit' && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => depositStep !== 'processing' && setModal(null)} />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2rem] p-5 sm:p-6 shadow-2xl overflow-hidden font-poppins">
                
                <AnimatePresence mode="wait">
                  {(depositStep === 'amount' || depositStep === 'phone') && (
                    <motion.div key="init" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <div className="flex items-center justify-between mb-5">
                        <div>
                           <h3 className="text-lg font-semibold tracking-tight">Deposit Money</h3>
                           <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-50 tracking-tight mt-1">Mobile money deposit</p>
                        </div>
                        <button onClick={() => setModal(null)} className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-95"><X className="size-4" /></button>
                      </div>
                      
                        <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Deposit gateway</label>
                           <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'payunit', label: 'PayUnit', sub: 'MTN / Orange', min: 'Primary' },
                                { id: 'eversend', label: 'Eversend', sub: 'Multi-country', min: 'Min 500' },
                              ].map(node => (
                                <button
                                  key={node.id}
                                  onClick={() => setDepositGateway(node.id)}
                                  className={`rounded-xl border p-2.5 text-left transition-all ${depositGateway === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-55 hover:opacity-100'}`}
                                >
                                  <span className="block text-[11px] font-semibold tracking-tight">{node.label}</span>
                                  <span className="block text-[9px] font-medium opacity-70">{node.sub} - {node.min}</span>
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Deposit amount (XAF)</label>
                           <input 
                              type="number" 
                              value={amount} 
                              onChange={e => setAmount(e.target.value)} 
                              placeholder="Min 500"
                              className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-xl font-semibold text-center text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-10 shadow-inner" 
                           />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Account phone</label>
                           <div className="relative">
                              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                              <input 
                                 type="tel" 
                                 value={depositPhone} 
                                 onChange={e => setDepositPhone(e.target.value)} 
                                 placeholder="6XX XXX XXX" 
                                 className="w-full h-11 pl-12 pr-4 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-sm font-medium outline-none focus:border-[var(--accent)] transition-all shadow-inner" 
                              />
                           </div>
                        </div>

                        {depositGateway === 'eversend' ? (
                          <div className="space-y-2">
                             <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Country</label>
                             <div className="grid grid-cols-2 gap-2">
                                {[
                                   { id: 'CM', label: 'Cameroon' },
                                   { id: 'CI', label: 'Ivory Coast' },
                                ].map(node => (
                                  <button 
                                    key={node.id} 
                                    onClick={() => setDepositNetwork(node.id)}
                                    className={`h-10 rounded-xl border font-semibold text-[10px] lg:text-[12px] tracking-tight transition-all ${depositNetwork === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                                  >
                                    {node.label}
                                  </button>
                                ))}
                             </div>
                             <p className="text-[10px] font-semibold text-amber-500/80">Eversend deposits require at least 500 XAF.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                             <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Network</label>
                             <div className="grid grid-cols-3 gap-2">
                                {[
                                   { id: 'CM_MTNMOMO', label: 'MTN' },
                                   { id: 'CM_ORANGE', label: 'Orange' },
                                ].map(node => (
                                  <button 
                                    key={node.id || 'auto'} 
                                    onClick={() => setDepositService(node.id)}
                                    className={`h-10 rounded-xl border font-semibold text-[10px] lg:text-[12px] tracking-tight transition-all ${depositService === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                                  >
                                    {node.label}
                                  </button>
                                ))}
                             </div>
                          </div>
                        )}

                        <button onClick={handleDepositInit} disabled={submitting} className="w-full h-12 bg-emerald-500 text-white rounded-xl font-semibold text-[11px] lg:text-[12px] tracking-tight shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 mt-2">
                           {submitting ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
                           Deposit funds
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {depositStep === 'processing' && (
                    <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center text-center">

                      {/* Elapsed timer */}
                      <ElapsedTimer />

                      {/* Steps */}
                      <div className="w-full space-y-2 mb-6">
                        {[
                          { label: 'Request sent to gateway', done: true, active: false },
                          { label: `Approve prompt on ${depositPhone}`, done: false, active: true },
                          { label: 'Confirming payment', done: false, active: false },
                        ].map((step, i) => (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            step.done ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                            step.active ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]' :
                            'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-30'
                          }`}>
                            <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                              step.done ? 'bg-emerald-500' : step.active ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]'
                            }`}>
                              {step.done
                                ? <CheckCircle2 className="size-3 text-white" />
                                : step.active
                                  ? <Loader2 className="size-3 text-white animate-spin" />
                                  : <span className="text-[8px] font-bold text-white">{i + 1}</span>
                              }
                            </div>
                            <p className="text-[11px] font-semibold tracking-tight text-left">{step.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Live status */}
                      <div className="w-full bg-[var(--bg-secondary)] rounded-xl p-3 border border-[var(--glass-border)] flex items-center gap-3">
                        <div className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <p className="text-[11px] font-semibold tracking-tight text-[var(--accent)] text-left">{depositMessage || 'Waiting for mobile money confirmation...'}</p>
                      </div>

                      <p className="text-[10px] font-semibold tracking-tight opacity-20 mt-4">Do not close this window</p>
                    </motion.div>
                  )}


                  {depositStep === 'result' && (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-6 flex flex-col items-center text-center">
                       <div className={`size-20 rounded-[2rem] mb-6 flex items-center justify-center shadow-lg ${
                          depositStatus === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                          depositStatus === 'timeout' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                       }`}>
                          {depositStatus === 'success' ? <CheckCircle2 className="size-10" /> : 
                           depositStatus === 'timeout' ? <AlertTriangle className="size-10" /> : 
                           <XCircle className="size-10" />}
                       </div>
                       <h4 className={`text-xl font-bold tracking-tight mb-2 ${depositStatus === 'success' ? 'text-emerald-500' : depositStatus === 'timeout' ? 'text-amber-500' : 'text-rose-500'}`}>
                          {depositStatus === 'success' ? 'Confirmed' : 
                           depositStatus === 'timeout' ? 'Timed Out' : 'Failed'}
                       </h4>
                       <div className="bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl p-4 mb-4 w-full">
                          <p className="text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-60 leading-relaxed tracking-tight">
                             {depositStatus === 'success' ? depositMessage : depositReason || depositMessage}
                          </p>
                          {(depositStatus === 'failed' || depositStatus === 'timeout') && depositRef && (
                             <p className="text-[10px] font-mono text-rose-400/60 mt-2 tracking-tight break-all">Ref: {depositRef}</p>
                          )}
                       </div>

                       {/* Recheck — for failed/timeout: the gateway may have already processed */}
                       {(depositStatus === 'failed' || depositStatus === 'timeout') && depositRef && (
                         <button
                           onClick={handleDepositRecheck}
                           disabled={recheckingDeposit}
                           className="w-full h-12 rounded-2xl border border-amber-500/30 text-amber-400 font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:bg-amber-500/5 transition-all mb-3 disabled:opacity-50"
                         >
                           {recheckingDeposit ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                           Recheck payment status
                         </button>
                       )}

                       <button
                         onClick={() => { depositInProgressRef.current = false; setModal(null); setDepositStep('amount'); setAmount(''); setDepositStatus('pending'); setDepositReason(''); }}
                         className={`w-full h-14 rounded-2xl font-semibold text-[11px] lg:text-[12px] tracking-tight transition-all shadow-lg ${
                            depositStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--glass-border)]'
                         }`}
                       >
                         {depositStatus === 'success' ? 'Return to wallet' : 'Try again'}
                       </button>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            </div>
          )}
          {modal === 'withdraw' && (
            <WithdrawModal balance={balance} onClose={() => setModal(null)} onSuccess={() => { fetchWallet(); setModal(null); }} />
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
