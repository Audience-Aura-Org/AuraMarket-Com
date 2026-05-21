"use client";

import { useState, useEffect } from 'react';
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
  const { user } = useAuthStore();
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
  const [depositPhone, setDepositPhone] = useState(user?.phone || '');
  const [depositNetwork, setDepositNetwork] = useState('CM');
  const [depositRef, setDepositRef] = useState(null);
  const [depositStatus, setDepositStatus] = useState('pending');
  const [depositMessage, setDepositMessage] = useState('');
  const [depositReason, setDepositReason] = useState('');
  const [recheckingDeposit, setRecheckingDeposit] = useState(false);
  const [recheckingTxId, setRecheckingTxId] = useState(null);
  const itemsPerPage = 10;

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
        setBalance(balRes.data.data.balance || 0);
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
            && tx.gateway === 'eversend'
            && tx.type === 'deposit'
            && !tx.gateway_transaction_id?.startsWith('SBX-') // skip sandbox test transactions
            && (Date.now() - new Date(tx.createdAt).getTime()) < 30 * 60 * 1000
        );
        if (pending.length > 0) {
          setTimeout(async () => {
            let anyChanged = false;
            for (const tx of pending) {
              try {
                const r = await api.get(`/payments/eversend/recheck/${tx.reference}`);
                if (r.data?.status === 'SUCCESSFUL' || r.data?.status === 'FAILED') {
                  anyChanged = true;
                }
              } catch { /* silent — don't disrupt UI */ }
            }
            if (anyChanged) {
              // Refresh silently to show updated statuses
              try {
                const [b2, t2] = await Promise.all([api.get('/wallet'), api.get('/wallet/transactions')]);
                if (b2.data.success) { setBalance(b2.data.data.balance || 0); setPendingBalance(b2.data.data.pending_escrow || 0); }
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

  useEffect(() => {
    if (user?.phone && !depositPhone) {
      setDepositPhone(user.phone);
    }
  }, [user]);

  // ── Socket: instant wallet credit notification ──────────────────────────
  // When the Eversend webhook fires on the backend, it emits 'wallet:credited'
  // to the user's socket room. We listen here and immediately show success,
  // bypassing the need to wait for the next poll cycle (saves up to 3s).
  useEffect(() => {
    if (!user?._id) return;
    const callbackId = 'wallet-credited';
    socketService.on('wallet:credited', callbackId, (data) => {
      // Update balance display immediately
      fetchWallet();
      // If the deposit modal is open and processing, snap to success
      if (depositStep === 'processing' && data.type === 'deposit') {
        setDepositStatus('success');
        setDepositStep('result');
        setDepositMessage('Payment confirmed! Your wallet has been credited.');
      }
    });
    socketService.on('withdrawal:paid', 'withdrawal-paid', () => fetchWallet());
    return () => {
      socketService.off('wallet:credited', callbackId);
      socketService.off('withdrawal:paid', 'withdrawal-paid');
    };
  }, [user?._id, depositStep]);
  // ───────────────────────────────────────────────────────────────────────

  if (!mounted || !user) return null;

  const startDeposit = async () => {
    if (!amount || Number(amount) < 100) return showToast('Minimum deposit is 100 XAF.', 'error');
    setDepositStep('phone');
  };

  const handleDepositInit = async () => {
    if (!amount || Number(amount) < 500) return showToast('Minimum deposit is 500 XAF.', 'error');
    if (!depositPhone) return showToast('Phone number is required.', 'error');

    // ── Immediate UI feedback — switch to processing BEFORE the API call ──
    setDepositStep('processing');
    setDepositMessage('Sending request to payment gateway...');
    setSubmitting(true);

    try {
      const payload = {
        amount: Number(amount),
        currency: 'XAF',
        phone: depositPhone,
        country: depositNetwork,
      };
      
      const res = await initiateCollection('eversend', payload);

      if (res.success) {
        const ref = res.data.reference;
        setDepositRef(ref);
        setDepositMessage('Charge request sent. Awaiting approval on your phone...');

        // Poll for up to 110s with 3s intervals (faster fallback; socket push handles the instant case)
        pollTransactionStatus(
          'eversend',
          ref,
          {
            onPending: (data) => setDepositMessage(data.message || 'Awaiting mobile money confirmation...'),
            onSuccess: () => {
              setDepositStatus('success');
              setDepositStep('result');
              setDepositMessage('Payment confirmed! Your wallet has been credited.');
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
              // Auto-recheck once — the gateway may have confirmed after the polling window
              try {
                const ref = depositRef;
                if (ref) {
                  const r = await api.get(`/payments/eversend/recheck/${ref}`);
                  if (r.data?.status === 'SUCCESSFUL') {
                    setDepositStatus('success');
                    setDepositMessage('Payment confirmed! Your wallet has been credited.');
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
            }
          },
          3000,   // poll every 3s (socket push handles instant case; this is fallback)
          110000  // 110 second max window
        );
      } else {
        // Gateway returned a non-success response
        setDepositStatus('failed');
        setDepositStep('result');
        setDepositReason(res.message || 'Payment initiation failed. Please try again.');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message;

      if (depositRef) {
        // We have a ref — initiation succeeded but something crashed after.
        // Stay on result/timeout screen so user can recheck.
        setDepositStatus('timeout');
        setDepositStep('result');
        setDepositMessage('Request sent but server confirmation was interrupted. Use "Recheck Payment" below.');
      } else {
        // We have NO ref — the API call itself failed (timeout, server error).
        // Eversend may or may not have received the request.
        // NEVER go back to 'amount' — user may have already gotten a USSD prompt.
        setDepositStatus('timeout');
        setDepositStep('result');
        setDepositMessage(
          errMsg
            ? errMsg
            : 'Could not reach the payment gateway. If you received and approved a USSD prompt on your phone, your payment may still be processing — check your transaction history below.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositRecheck = async () => {
    if (!depositRef) return;
    setRecheckingDeposit(true);
    try {
      const res = await api.get(`/payments/eversend/recheck/${depositRef}`);
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
        setDepositStep('amount');
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
      const res = await api.get(`/payments/eversend/recheck/${tx.reference}`);
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
                <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">Available Balance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  <span className="text-[10px] lg:text-[12px]  font-semibold text-emerald-500 tracking-tight">Secure Account</span>
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
            <CompactStat title="Available" value={fmt(balance)} sub="Available to spend" icon={Wallet} color="emerald" />
            <CompactStat title="In escrow" value={fmt(pendingBalance)} sub="Held in escrow" icon={Lock} color="amber" />
            <CompactStat title="Successful" value={transactions.filter(t => t.status === 'completed').length} sub={`${fmt(transactions.filter(t=>t.status==='completed').reduce((s,t)=>s+t.amount,0))} XAF`} icon={CheckCircle2} color="emerald" />
            <CompactStat title="Failed" value={transactions.filter(t => t.status === 'failed').length} sub="Payments declined" icon={XCircle} color="fuchsia" />
          </div>

          {/* Action Hub */}
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => handleAction('deposit')} className="h-14 rounded-2xl bg-emerald-500 text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all">
                <ArrowDownLeft className="size-5" /> Deposit Money
             </button>
             <button onClick={() => setModal('withdraw')} className="h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--bg-secondary)]/80 active:scale-95 transition-all">
                <ArrowUpRight className="size-5" /> Withdraw Money
             </button>
          </div>

          {/* Activity Ledger */}
          <section className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">Transaction History</h3>
                  <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 mt-1 tracking-tight">Real-time transaction history</p>
                </div>
                 <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5 overflow-x-auto no-scrollbar">
                   {['all', 'in', 'out', 'withdrawals'].map(t => (
                     <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-lg text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === t ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] opacity-40'}`}>
                       {t}
                     </button>
                   ))}
                 </div>
             </div>

              <div className="space-y-2 min-h-[400px]">
                 {loading ? <LoadingSpinner /> : currentItems.length === 0 ? (
                   <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-20 text-sm">No {activeTab} records found</div>
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
                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate capitalize">{wr.withdrawalMethod} withdrawal</p>
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
                      const isCredit = ['deposit', 'refund', 'payout'].includes(tx.type);
                      return (
                        <div key={tx._id || i} className={`flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border transition-all group cursor-pointer ${
                          tx.status === 'pending' && tx.gateway === 'eversend' && tx.type === 'deposit'
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
                            {['pending', 'failed'].includes(tx.status) && tx.gateway === 'eversend' && tx.type === 'deposit' && (
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
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl overflow-hidden font-poppins">
                
                <AnimatePresence mode="wait">
                  {(depositStep === 'amount' || depositStep === 'phone') && (
                    <motion.div key="init" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <div className="flex items-center justify-between mb-8">
                        <div>
                           <h3 className="text-xl  font-bold tracking-tight">Deposit Money</h3>
                           <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight mt-1">Mobile money deposit</p>
                        </div>
                        <button onClick={() => setModal(null)} className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-95"><X className="size-4" /></button>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Deposit amount (XAF)</label>
                           <input 
                              type="number" 
                              value={amount} 
                              onChange={e => setAmount(e.target.value)} 
                              placeholder="Min 500" 
                              className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-2xl  font-bold text-center text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-10 shadow-inner" 
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
                                 className="w-full h-12 pl-12 pr-4 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-sm  font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner" 
                              />
                           </div>
                        </div>

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
                                  className={`h-12 rounded-xl border  font-semibold text-[11px] lg:text-[12px] tracking-tight transition-all ${depositNetwork === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                                >
                                  {node.label}
                                </button>
                              ))}
                           </div>
                        </div>

                        <button onClick={handleDepositInit} disabled={submitting} className="w-full h-16 bg-emerald-500 text-white rounded-2xl  font-semibold text-[11px] lg:text-[12px] tracking-tight shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 mt-4">
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
                         onClick={() => { setModal(null); setDepositStep('amount'); setAmount(''); setDepositStatus('pending'); setDepositReason(''); }} 
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
