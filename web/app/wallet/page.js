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
  const [withdrawalMethod, setWithdrawalMethod] = useState('');
  const [accountDetails, setAccountDetails] = useState({ account_number: '', holder_name: '' });
  
  // Deposit Workflow State
  const [depositStep, setDepositStep] = useState('amount'); // 'amount' | 'phone' | 'processing' | 'result'
  const [depositPhone, setDepositPhone] = useState(user?.phone || '');
  const [depositNetwork, setDepositNetwork] = useState('CM');
  const [depositRef, setDepositRef] = useState(null);
  const [depositStatus, setDepositStatus] = useState('pending');
  const [depositMessage, setDepositMessage] = useState('');
  const [depositReason, setDepositReason] = useState('');
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
      if (txRes.data.success) setTransactions(txRes.data.data.transactions || []);
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

  const startDeposit = async () => {
    if (!amount || Number(amount) < 100) return showToast('Minimum deposit is 100 XAF.', 'error');
    setDepositStep('phone');
  };

  const handleDepositInit = async () => {
    if (!amount || Number(amount) < 500) return showToast('Minimum deposit is 500 XAF.', 'error');
    if (!depositPhone) return showToast('Phone number is required.', 'error');
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
        setDepositRef(res.data.reference);
        setDepositStep('processing');
        setDepositMessage('Awaiting mobile money confirmation...');
        
        const stopPolling = pollTransactionStatus(
          'eversend',
          res.data.reference,
          {
            onPending: (data) => setDepositMessage(data.message || 'Processing...'),
            onSuccess: (data) => {
              setDepositStatus('success');
              setDepositStep('result');
              setDepositMessage('Payment confirmed! Your wallet has been credited.');
              fetchWallet();
            },
            onFailed: (data) => {
              setDepositStatus('failed');
              setDepositStep('result');
              setDepositReason(data.reason || 'Payment failed.');
            },
            onTimeout: () => {
              setDepositStatus('timeout');
              setDepositStep('result');
              setDepositMessage('Verification timed out. Check your transaction history.');
            }
          }
        );
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Initialization failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (type) => {
    if (type === 'deposit') {
      setDepositStep('amount');
      setModal('deposit');
      return;
    }
    
    if (!amount || Number(amount) <= 0) return showToast('Enter a valid amount.', 'error');
    setSubmitting(true);
    try {
      const endpoint = '/wallet/withdraw';
      const body = { amount: Number(amount), method: withdrawalMethod, details: accountDetails };
      const res = await api.post(endpoint, body);
      if (res.data.success) {
        showToast(`Withdrawal successful!`);
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
                <h1 className="text-lg  font-bold tracking-tight">Wallet control</h1>
                <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">Active liquidity vault</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  <span className="text-[10px] lg:text-[12px]  font-semibold text-emerald-500 tracking-tight">Verified Nexus</span>
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
            <CompactStat title="Available" value={fmt(balance)} sub="Liquid capital" icon={Wallet} color="emerald" />
            <CompactStat title="In escrow" value={fmt(pendingBalance)} sub="Held for delivery" icon={Lock} color="amber" />
            <CompactStat title="Total received" value={fmt(transactions.filter(t => ['deposit','refund','payout'].includes(t.type)).reduce((s,t)=>s+t.amount,0))} sub="Platform in" icon={ArrowDownLeft} color="fuchsia" />
            <CompactStat title="Total sent" value={fmt(transactions.filter(t => ['withdrawal','payment'].includes(t.type)).reduce((s,t)=>s+t.amount,0))} sub="Platform out" icon={ArrowUpRight} color="blue" />
          </div>

          {/* Action Hub */}
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => handleAction('deposit')} className="h-14 rounded-2xl bg-emerald-500 text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all">
                <ArrowDownLeft className="size-5" /> Deposit funds
             </button>
             <button onClick={() => setModal('withdraw')} className="h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--bg-secondary)]/80 active:scale-95 transition-all">
                <ArrowUpRight className="size-5" /> Withdraw funds
             </button>
          </div>

          {/* Activity Ledger */}
          <section className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">Transaction ledger</h3>
                  <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 mt-1 tracking-tight">History synchronized with Aura network</p>
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
                      const isCredit = ['deposit', 'refund', 'payout'].includes(tx.type);
                      return (
                        <div key={tx._id || i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group cursor-pointer">
                          <div className={`size-10 rounded-xl flex items-center justify-center bg-${config.color}-500/10 text-${config.color}-500 border border-${config.color}-500/20`}>
                            <config.Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight truncate capitalize">{tx.description || tx.type}</p>
                            <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
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
                           <h3 className="text-xl  font-bold tracking-tight">Add liquidity</h3>
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
                           <label className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-30 ml-1">Network region</label>
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
                    <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-10 flex flex-col items-center text-center">
                       <div className="relative mb-8">
                          <div className="size-24 rounded-[2.5rem] bg-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center shadow-inner">
                             <Smartphone className="size-10 text-[var(--accent)] animate-bounce" />
                          </div>
                          <span className="absolute -top-2 -right-2 size-8 bg-[var(--accent)] rounded-full flex items-center justify-center shadow-lg animate-pulse border-4 border-[var(--bg-primary)]">
                             <Loader2 className="size-4 text-white animate-spin" />
                          </span>
                       </div>
                       <h4 className="text-xl  font-bold tracking-tight mb-2">Request sent</h4>
                       <p className="text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60 px-6 leading-relaxed mb-8">
                          Charge request initiated to <span className="text-[var(--text-primary)] font-mono">{depositPhone}</span>. Please confirm on your mobile device.
                       </p>
                       
                       <div className="w-full bg-[var(--bg-secondary)] rounded-2xl p-4 border border-[var(--glass-border)] mb-8 flex items-center gap-4">
                          <div className="size-2 rounded-full bg-emerald-500 animate-ping" />
                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--accent)]">{depositMessage}</p>
                       </div>

                       <p className="text-[10px] lg:text-[12px]  font-semibold tracking-tight opacity-20">Do not close this window</p>
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
                       <h4 className={`text-xl  font-bold tracking-tight mb-2 ${depositStatus === 'success' ? 'text-emerald-500' : depositStatus === 'timeout' ? 'text-amber-500' : 'text-rose-500'}`}>
                          {depositStatus === 'success' ? 'Confirmed' : 
                           depositStatus === 'timeout' ? 'Lapsed' : 'Failed'}
                       </h4>
                       <div className="bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl p-4 mb-8 w-full">
                          <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60 leading-relaxed tracking-tight">
                             {depositStatus === 'success' ? depositMessage : depositReason || depositMessage}
                          </p>
                          {depositStatus === 'failed' && (
                             <p className="text-[10px] lg:text-[12px]  font-semibold text-rose-500 mt-2 tracking-tight">Transaction ID: {depositRef || 'unknown'}</p>
                          )}
                       </div>
                       <button 
                         onClick={() => { setModal(null); setDepositStep('amount'); setAmount(''); }} 
                         className={`w-full h-14 rounded-2xl  font-semibold text-[11px] lg:text-[12px] tracking-tight transition-all shadow-lg ${
                            depositStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--glass-border)]'
                         }`}
                       >
                          Return to wallet
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
