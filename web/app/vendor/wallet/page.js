"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Lock,
  CheckCircle2, AlertCircle, Loader2, ChevronRight,
  RefreshCw, Smartphone, Building2, Clock, TrendingUp,
  Shield, X, ArrowLeft, History, Package, Download,
  ExternalLink, Printer, Fingerprint
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';

const MIN_WITHDRAW = 1000;

const METHODS = [
  {
    id: 'mtn',
    label: 'MTN MoMo',
    sub: 'Mobile Money',
    color: 'from-yellow-400 to-yellow-500',
    text: 'text-yellow-900',
    icon: '📱',
  },
  {
    id: 'orange',
    label: 'Orange Money',
    sub: 'Mobile Money',
    color: 'from-orange-400 to-orange-500',
    text: 'text-white',
    icon: '📲',
  },
];

const TX_COLOR = {
  payout:     'text-emerald-500',
  deposit:    'text-emerald-500',
  refund:     'text-blue-400',
  withdrawal: 'text-red-400',
  payment:    'text-red-400',
};

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

// ── Receipt Modal ────────────────────────────────────────────────────────────
function ReceiptModal({ tx, onClose }) {
  if (!tx) return null;
  const isWithdrawal = tx.type === 'withdrawal';
  const method = tx.gateway_response?.method || 'mtn';
  const details = tx.gateway_response?.details || {};

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
        {/* Aesthetic accents */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500" />
        <div className="absolute -bottom-10 -right-10 size-40 bg-slate-100 rounded-full blur-3xl opacity-50" />
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
             <Wallet className="size-8" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">Aura Market</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Transaction Receipt</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reference</span>
            <span className="text-xs font-black text-slate-800 uppercase">{tx.reference?.slice(0, 12)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date & Time</span>
            <span className="text-xs font-bold text-slate-800">{new Date(tx.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Type</span>
            <span className="text-xs font-black text-slate-800 uppercase">{tx.type}</span>
          </div>
          
          <div className="py-6 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Amount Transacted</p>
            <h4 className="text-4xl font-black text-slate-900 tracking-tighter">
              {fmt(tx.amount)} <span className="text-sm font-bold text-slate-400">XAF</span>
            </h4>
          </div>

          {isWithdrawal && (
            <div className="p-5 rounded-2xl bg-slate-50 space-y-2 border border-slate-100">
               <div className="flex justify-between">
                 <span className="text-[9px] font-black text-slate-400 uppercase">Beneficiary</span>
                 <span className="text-[10px] font-black text-slate-800">{details.holder_name}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-[9px] font-black text-slate-400 uppercase">Network</span>
                 <span className="text-[10px] font-black text-slate-800 uppercase">{method}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-[9px] font-black text-slate-400 uppercase">Account</span>
                 <span className="text-[10px] font-black text-slate-800">{details.account_number}</span>
               </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
           <div className="flex flex-col items-center">
              <div className="size-12 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-200">
                 <Fingerprint className="size-6" />
              </div>
              <p className="text-[8px] font-black text-slate-300 uppercase mt-2">Verified</p>
           </div>
           <div className="w-px h-8 bg-slate-100" />
           <div className="text-left">
              <p className="text-[8px] font-black text-slate-300 uppercase leading-tight">Digital Auth Signature</p>
              <p className="text-[7px] font-mono text-slate-400 break-all w-32">AUR-{tx._id?.slice(-8)}-SIG-{Math.random().toString(36).slice(2,8).toUpperCase()}</p>
           </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex-1 h-12 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
            <Printer className="size-3.5" /> Print
          </button>
          <button onClick={onClose} className="size-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all">
            <X className="size-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ step }) {
  const labels = ['Amount', 'Method', 'Confirm'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i + 1 <= step ? 'opacity-100' : 'opacity-30'}`}>
            <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black ${i + 1 < step ? 'bg-emerald-500 text-white' : i + 1 === step ? 'bg-[var(--accent)] text-white' : 'bg-white/10 text-white'}`}>
              {i + 1 < step ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-white/70">{l}</span>
          </div>
          {i < 2 && <div className={`flex-1 h-px w-8 ${i + 1 < step ? 'bg-emerald-500' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Withdraw panel ────────────────────────────────────────────────────────────
function WithdrawPanel({ balance, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount]   = useState('');
  const [method, setMethod]   = useState(null);
  const [phone, setPhone]     = useState('');
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const amtNum = Number(amount) || 0;
  const remaining = balance - amtNum;

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/wallet/withdraw', {
        amount: amtNum,
        method: method.id,
        details: { account_number: phone, holder_name: name },
      });
      setSuccess(true);
      onSuccess();
    } catch (e) {
      setError(e?.response?.data?.message || 'Withdrawal failed. Please try again.');
      setStep(3);
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
        <motion.div 
          initial={{ y: 100, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 100 }}
          className="relative w-full sm:max-w-md bg-[#0f0f12] border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-10 shadow-2xl text-center"
        >
          <div className="size-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
             <CheckCircle2 className="size-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Request Received</h2>
          <p className="text-sm text-white/40 font-bold mb-8">Your withdrawal of {fmt(amtNum)} XAF has been queued for approval. You will be notified once processed.</p>
          
          <button onClick={onClose} className="w-full h-14 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">
            Dismiss
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        className="relative w-full sm:max-w-md bg-[#0f0f12] border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => { setStep(s => s - 1); setError(''); }} className="size-8 rounded-full bg-white/5 flex items-center justify-center">
                <ArrowLeft className="size-4 text-white" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-black text-white">Withdraw Funds</h2>
              <p className="text-[11px] text-white/40 font-semibold">Available: {fmt(balance)} XAF</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-white/5 flex items-center justify-center">
            <X className="size-4 text-white/60" />
          </button>
        </div>

        <Steps step={step} />

        <AnimatePresence mode="wait">
          {/* Step 1 — Amount */}
          {step === 1 && (
            <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
              <div>
                <div className="relative">
                  <input
                    type="number" min={MIN_WITHDRAW} max={balance}
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-4xl font-black text-white text-center outline-none focus:border-[var(--accent)] transition-all placeholder:text-white/20"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 text-sm font-black">XAF</span>
                </div>
                {amtNum > 0 && (
                  <p className={`text-center text-[11px] font-bold mt-2 ${remaining < 0 ? 'text-red-400' : 'text-white/40'}`}>
                    {remaining >= 0 ? `${fmt(remaining)} XAF remaining` : 'Exceeds available balance'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 25000, 50000].map(q => (
                  <button key={q} onClick={() => setAmount(String(Math.min(q, balance)))}
                    className="py-3 rounded-xl bg-white/5 border border-white/8 text-[10px] font-black text-white/60 hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-all">
                    {q >= 1000 ? `${q/1000}K` : q}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setError(''); setStep(2); }}
                disabled={amtNum < MIN_WITHDRAW || amtNum > balance}
                className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30 hover:brightness-110 transition-all">
                Continue <ChevronRight className="size-4" />
              </button>
              <p className="text-center text-[10px] text-white/20 font-bold">Minimum withdrawal: 1,000 XAF</p>
            </motion.div>
          )}

          {/* Step 2 — Method */}
          {step === 2 && (
            <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {METHODS.map(m => (
                  <button key={m.id} onClick={() => setMethod(m)}
                    className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all ${method?.id === m.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <div className={`size-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-xl shadow-lg`}>{m.icon}</div>
                    <div className="text-center">
                      <p className="text-sm font-black text-white">{m.label}</p>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{m.sub}</p>
                    </div>
                    {method?.id === m.id && <div className="size-5 rounded-full bg-[var(--accent)] flex items-center justify-center"><CheckCircle2 className="size-3.5 text-white" /></div>}
                  </button>
                ))}
              </div>

              {method && (
                <div className="space-y-3 pt-2">
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder={`${method.label} Phone Number`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white placeholder:text-white/30 outline-none focus:border-[var(--accent)] transition-all" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Account Holder Name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white placeholder:text-white/30 outline-none focus:border-[var(--accent)] transition-all" />
                </div>
              )}

              <button onClick={() => { setError(''); setStep(3); }}
                disabled={!method || !phone.trim() || !name.trim()}
                className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30 hover:brightness-110 transition-all">
                Review <ChevronRight className="size-4" />
              </button>
            </motion.div>
          )}

          {/* Step 3 — Confirm */}
          {step === 3 && (
            <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold">
                  <AlertCircle className="size-4 shrink-0" /> {error}
                </div>
              )}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                {[
                  ['Amount', `${fmt(amtNum)} XAF`],
                  ['Method', method?.label],
                  ['Phone', phone],
                  ['Name', name],
                  ['Processing', '1–2 Business Days'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">{k}</span>
                    <span className="text-sm font-black text-white">{v}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Balance After</span>
                  <span className="text-sm font-black text-emerald-400">{fmt(remaining)} XAF</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield className="size-4 text-amber-400 shrink-0" />
                <p className="text-[10px] font-bold text-amber-400">Withdrawal requires admin approval (1–2 business days). Funds are held until approved.</p>
              </div>

              <button onClick={submit} disabled={loading}
                className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 transition-all">
                {loading ? <><Loader2 className="size-4 animate-spin" /> Submitting...</> : <><CheckCircle2 className="size-4" /> Confirm Withdrawal</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorWalletPage() {
  const { user } = useAuthStore();
  const [balance, setBalance]       = useState(0);
  const [escrow, setEscrow]         = useState(0);
  const [transactions, setTxs]      = useState([]);
  const [escrowTxs, setEscrowTxs]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showWithdraw, setWithdraw] = useState(false);
  const [toast, setToast]           = useState(null);
  const [txFilter, setTxFilter]     = useState('all');
  const [tab, setTab]               = useState('history'); // 'history' | 'escrow'
  const [selectedTx, setSelectedTx] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const [balRes, txRes, escrowRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
        api.get('/wallet/escrow'),
      ]);
      if (balRes.data.success) {
        setBalance(balRes.data.data.balance || 0);
        setEscrow(balRes.data.data.pending_escrow || 0);
      }
      if (txRes.data.success) setTxs(txRes.data.data.transactions || []);
      if (escrowRes.data.success) setEscrowTxs(escrowRes.data.data.transactions || []);
    } catch (e) {
      console.error('Wallet Load Error:', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalEarned = transactions.filter(t => ['payout', 'deposit', 'refund'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalOut    = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);

  const filtered = transactions.filter(t => {
    if (txFilter === 'payouts') return t.type === 'payout';
    if (txFilter === 'withdrawals') return t.type === 'withdrawal';
    return true;
  });

  const handleWithdrawSuccess = () => {
    showToast('Withdrawal request submitted! Awaiting admin approval.');
    load();
  };

  return (
    <DashboardLayout role="vendor">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -50, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: -50, opacity: 0, x: '-50%' }}
            className={`fixed top-20 left-1/2 z-[300] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
          >
            {toast.type === 'error' ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWithdraw && (
          <WithdrawPanel
            balance={balance}
            onClose={() => setWithdraw(false)}
            onSuccess={handleWithdrawSuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTx && (
          <ReceiptModal
            tx={selectedTx}
            onClose={() => setSelectedTx(null)}
          />
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-8 max-w-4xl mx-auto space-y-8">

        {/* ── Hero Balance Card ── */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--accent)] via-purple-700 to-indigo-800 p-8 shadow-2xl">
          <div className="absolute -top-16 -right-16 size-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 size-48 rounded-full bg-black/20 blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-white/60 text-[11px] font-black uppercase tracking-[0.25em] mb-1">Available Balance</p>
                <h1 className="text-5xl font-black text-white tracking-tight">
                  {loading ? <span className="opacity-30">—</span> : fmt(balance)}
                </h1>
                <p className="text-white/50 text-sm font-bold mt-1">XAF</p>
              </div>
              <div className="size-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-xl">
                <Wallet className="size-7 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15">
              {[
                { label: 'In Escrow', value: fmt(escrow), icon: Lock, color: 'text-amber-300' },
                { label: 'Total Earned', value: fmt(totalEarned), icon: TrendingUp, color: 'text-emerald-300' },
                { label: 'Withdrawn', value: fmt(totalOut), icon: ArrowUpRight, color: 'text-white/60' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`size-3 ${color}`} />
                    <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">{label}</p>
                  </div>
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-white/30 text-[9px] font-bold">XAF</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setWithdraw(true)}
            disabled={balance < MIN_WITHDRAW}
            className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-[var(--accent)] text-white font-black text-sm uppercase tracking-wider disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[var(--accent)]/20">
            <ArrowUpRight className="size-5" /> Withdraw
          </button>
          <button onClick={load}
            className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-black text-sm uppercase tracking-wider hover:bg-[var(--bg-secondary)]/80 active:scale-[0.98] transition-all">
            <RefreshCw className="size-5" /> Refresh
          </button>
        </div>

        {/* ── Tabs for Transactions vs Escrow ── */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-[var(--glass-border)]">
            <button onClick={() => setTab('history')} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${tab === 'history' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
              <div className="flex items-center gap-2"><History className="size-4" /> History</div>
              {tab === 'history' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full shadow-[0_-4px_12px_var(--accent)]" />}
            </button>
            <button onClick={() => setTab('escrow')} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${tab === 'escrow' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
              <div className="flex items-center gap-2"><Lock className="size-4" /> Escrow {escrowTxs.length > 0 && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}</div>
              {tab === 'escrow' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full shadow-[0_-4px_12px_var(--accent)]" />}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === 'history' ? (
              <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
                  {[['all', 'All'], ['payouts', 'Payouts'], ['withdrawals', 'Withdrawals']].map(([id, label]) => (
                    <button key={id} onClick={() => setTxFilter(id)}
                      className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${txFilter === id ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="py-16 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-[var(--accent)] opacity-40" /></div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
                    <Wallet className="size-10 text-[var(--text-secondary)] opacity-20" />
                    <p className="text-sm font-bold text-[var(--text-secondary)] opacity-40">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((tx, i) => {
                      const isCredit = ['payout', 'deposit', 'refund'].includes(tx.type);
                      const color = TX_COLOR[tx.type] || 'text-white';
                      return (
                        <div 
                          key={tx._id || i} 
                          onClick={() => setSelectedTx(tx)}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 hover:bg-[var(--bg-secondary)]/30 transition-all group cursor-pointer"
                        >
                          <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            {isCredit ? <ArrowDownLeft className={`size-5 ${color}`} /> : <ArrowUpRight className={`size-5 ${color}`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[var(--text-primary)] truncate uppercase tracking-tight">{tx.description || tx.type}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                                {new Date(tx.createdAt).toLocaleDateString()}
                              </p>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${
                                tx.status === 'completed' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' :
                                tx.status === 'pending'   ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' :
                                'border-red-500/20 text-red-400 bg-red-500/5'}`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className={`text-base font-black shrink-0 ${color}`}>
                                {isCredit ? '+' : '-'}{fmt(tx.amount)}
                             </p>
                             <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-20 group-hover:opacity-100 transition-opacity uppercase flex items-center justify-end gap-1">
                                <Printer className="size-2" /> Receipt
                             </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="escrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="size-4 text-amber-400" />
                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-tight">Escrow System</h3>
                  </div>
                  <p className="text-[11px] text-amber-400/60 font-bold leading-relaxed">
                    Funds are held until the buyer confirms delivery. After confirmation, funds move to your available balance automatically (minus commission).
                  </p>
                </div>

                {escrowTxs.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
                    <Package className="size-10 text-[var(--text-secondary)] opacity-20" />
                    <p className="text-sm font-bold text-[var(--text-secondary)] opacity-40">No pending escrow orders</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {escrowTxs.map((tx) => (
                      <div key={tx._id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-amber-500/20 transition-all flex items-center gap-4">
                        <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Clock className="size-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-[var(--text-primary)] truncate">Order #{tx.order_id?._id?.slice(-6).toUpperCase()}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{tx.order_id?.order_status}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-40">•</span>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">Releasing soon</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[var(--text-primary)]">{fmt(tx.amount)}</p>
                          <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] opacity-30">Pending</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
