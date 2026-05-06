"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Lock,
  CheckCircle2, AlertCircle, Loader2, ChevronRight,
  RefreshCw, Smartphone, Building2, Clock, TrendingUp,
  Shield, X, ArrowLeft, History, Package, Download,
  ExternalLink, Printer, Fingerprint, Star
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

const MIN_WITHDRAW = 1000;
import WithdrawModal from '@/components/wallet/WithdrawModal';

const TX_COLOR = {
  payout:     'text-emerald-500',
  deposit:    'text-emerald-500',
  refund:     'text-blue-400',
  withdrawal: 'text-red-400',
  payment:    'text-red-400',
};

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

// ── Components ──

function KPICard({ title, value, icon: Icon, color, sub }) {
  const colorMap = {
    fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    blue: 'bg-indigo-500/10 text-indigo-500',
    emerald: 'bg-emerald-500/10 text-emerald-600',
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
        <p className="text-[var(--text-secondary)] text-[11px] lg:text-[12px] font-quicksand font-bold tracking-[0.2em]  opacity-50">{title}</p>
        <h3 className="text-fluid-base lg:text-fluid-xl font-quicksand font-bold text-[var(--text-primary)] mt-1 truncate">{value}</h3>
        {sub && <p className="text-[11px] lg:text-[12px] text-[var(--text-secondary)] font-quicksand font-bold mt-1 opacity-50  tracking-tighter truncate">{sub}</p>}
      </div>
    </div>
  );
}

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
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500" />
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
             <Wallet className="size-8" />
          </div>
          <h3 className="text-xl font-quicksand font-bold tracking-tight">Aura Market</h3>
          <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-slate-400 tracking-tight">Official Transaction Receipt</p>
        </div>

        <div className="space-y-4 mb-8 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400 font-quicksand font-bold  text-[10px] lg:text-[12px]">Reference</span>
            <span className="font-quicksand font-bold text-slate-800">{tx.reference?.slice(0, 12)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400 font-quicksand font-bold  text-[10px] lg:text-[12px]">Date</span>
            <span className="font-quicksand font-bold text-slate-800">{new Date(tx.createdAt).toLocaleString()}</span>
          </div>
          <div className="py-4 text-center">
            <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-slate-400 tracking-tight mb-1">Amount</p>
            <h4 className="text-3xl font-quicksand font-bold text-slate-900">{fmt(tx.amount)} XAF</h4>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex-1 h-12 bg-slate-900 text-white rounded-2xl font-quicksand font-bold text-[10px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2">
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

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2">
          <div className={`size-6 rounded-full flex items-center justify-center text-[11px] lg:text-[12px] font-quicksand font-bold ${i <= step ? 'bg-[var(--accent)] text-white' : 'bg-white/10 text-white/30'}`}>
            {i < step ? <CheckCircle2 className="size-3.5" /> : i}
          </div>
          {i < 3 && <div className={`w-8 h-px ${i < step ? 'bg-[var(--accent)]' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );

  if (success) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
        <div className="w-full max-w-sm bg-[#0f0f12] border border-white/10 rounded-[2.5rem] p-10 text-center">
          <CheckCircle2 className="size-16 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-quicksand font-bold text-white  mb-2">Success</h2>
          <p className="text-sm text-white/40 mb-8">Withdrawal request for {fmt(amtNum)} XAF submitted.</p>
          <button onClick={onClose} className="w-full h-14 bg-white/5 border border-white/10 text-white rounded-2xl font-quicksand font-bold text-xs tracking-tight">Dismiss</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-[#0f0f12] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-quicksand font-bold text-white">Withdraw Funds</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-white/40"><X className="size-5" /></button>
        </div>
        <StepIndicator />
        
        {step === 1 && (
          <div className="space-y-6">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 text-4xl font-quicksand font-bold text-white text-center outline-none focus:border-[var(--accent)]" />
            <button onClick={() => setStep(2)} disabled={amtNum < MIN_WITHDRAW || amtNum > balance} className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-quicksand font-bold text-sm tracking-tight disabled:opacity-30">Next Step</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setMethod(m)} className={`p-4 rounded-2xl border transition-all ${method?.id === m.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="text-2xl mb-2">{m.icon}</div>
                  <p className="text-xs font-quicksand font-bold text-white">{m.label}</p>
                </button>
              ))}
            </div>
            {method && (
              <div className="space-y-3">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm font-quicksand font-bold outline-none" />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Account Name" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm font-quicksand font-bold outline-none" />
              </div>
            )}
            <button onClick={() => setStep(3)} disabled={!method || !phone || !name} className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-quicksand font-bold text-sm tracking-tight disabled:opacity-30">Review</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-4 space-y-2">
               <div className="flex justify-between text-xs"><span className="text-white/40  font-quicksand font-bold">Amount</span><span className="text-white font-quicksand font-bold">{fmt(amtNum)} XAF</span></div>
               <div className="flex justify-between text-xs"><span className="text-white/40  font-quicksand font-bold">Method</span><span className="text-white font-quicksand font-bold">{method?.label}</span></div>
            </div>
            {error && <p className="text-red-400 text-xs font-quicksand font-bold text-center">{error}</p>}
            <button onClick={submit} disabled={loading} className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-quicksand font-bold text-sm tracking-tight disabled:opacity-30">
              {loading ? 'Processing...' : 'Confirm Withdrawal'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Page ──

export default function VendorWalletPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance]       = useState(0);
  const [escrow, setEscrow]         = useState(0);
  const [transactions, setTxs]      = useState([]);
  const [escrowTxs, setEscrowTxs]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showWithdraw, setWithdraw] = useState(false);
  const [toast, setToast]           = useState(null);
  const [tab, setTab]               = useState('history');
  const [selectedTx, setSelectedTx] = useState(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);

  useEffect(() => {
    if (!user) {
      router.replace('/login?from=vendor-wallet');
    } else if (user.role !== 'vendor') {
      router.replace('/wallet');
    }
  }, [user, router]);

  if (!user || user.role !== 'vendor') return null;

  const load = useCallback(async () => {
    try {
      const [balRes, txRes, escrowRes, wdRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
        api.get('/wallet/escrow'),
        api.get('/withdrawals/mine'),
      ]);
      if (balRes.data.success) {
        setBalance(balRes.data.data.balance || 0);
        setEscrow(balRes.data.data.pending_escrow || 0);
      }
      if (txRes.data.success) setTxs(txRes.data.data.transactions || []);
      if (escrowRes.data.success) setEscrowTxs(escrowRes.data.data.transactions || []);
      if (wdRes.data.success) setWithdrawalRequests(wdRes.data.data.withdrawals || []);
    } catch (e) {
      console.error('Wallet Load Error:', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalEarned = transactions
    .filter(t => ['payout', 'deposit', 'refund'].includes(t.type) && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <AnimatePresence>
        {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
        {showWithdraw && <WithdrawModal balance={balance} onClose={() => setWithdraw(false)} onSuccess={() => { load(); setWithdraw(false); }} />}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-8 w-full space-y-8">
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Wallet className="size-6 text-emerald-500" /></div>
              <div>
                <h1 className="text-2xl font-quicksand font-bold text-[var(--text-primary)]">Vendor Wallet</h1>
                <p className="text-xs text-[var(--text-secondary)] font-quicksand font-bold opacity-60 tracking-tight">Financial Nexus</p>
              </div>
           </div>
           <button onClick={load} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
              <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>

        {/* Clean KPI Grid - Reverting to the "Last Design" style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Available" value={`${fmt(balance)}`} icon={Wallet} color="emerald" sub="XAF Ready" />
          <KPICard title="In Escrow" value={`${fmt(escrow)}`} icon={Lock} color="amber" sub="Holding for delivery" />
          <KPICard title="Total Earned" value={`${fmt(totalEarned)}`} icon={TrendingUp} color="fuchsia" sub="Gross Revenue" />
          <KPICard title="Withdrawn" value={`${fmt(totalOut)}`} icon={ArrowUpRight} color="blue" sub="Total Outflow" />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
           <button onClick={() => setWithdraw(true)} disabled={balance < MIN_WITHDRAW} className="flex-1 h-14 bg-[var(--accent)] text-white rounded-2xl font-quicksand font-bold text-xs tracking-tight flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all disabled:opacity-30">
              <ArrowUpRight className="size-5" /> Initiate Withdrawal
           </button>
        </div>

        {/* Tabs */}
        <div className="space-y-6">
           <div className="flex items-center gap-6 border-b border-[var(--glass-border)]">
              <button onClick={() => setTab('history')} className={`pb-4 text-xs font-quicksand font-bold tracking-tight relative ${tab === 'history' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                 <div className="flex items-center gap-2"><History className="size-4" /> Settlement History</div>
                 {tab === 'history' && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
              </button>
              <button onClick={() => setTab('escrow')} className={`pb-4 text-xs font-quicksand font-bold tracking-tight relative ${tab === 'escrow' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                 <div className="flex items-center gap-2"><Lock className="size-4" /> Escrow Pipeline {escrowTxs.length > 0 && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}</div>
                 {tab === 'escrow' && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
              </button>
              <button onClick={() => setTab('withdrawals')} className={`pb-4 text-xs font-quicksand font-bold tracking-tight relative ${tab === 'withdrawals' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                 <div className="flex items-center gap-2"><ArrowUpRight className="size-4" /> Withdrawals</div>
                 {tab === 'withdrawals' && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-full" />}
              </button>
           </div>

           <div className="min-h-[400px]">
              {tab === 'history' && (
                <div className="space-y-2">
                   {loading ? <div className="py-20 flex justify-center opacity-20"><Loader2 className="animate-spin" /></div> : transactions.length === 0 ? (
                     <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No transaction data available</div>
                   ) : transactions.map((tx, i) => (
                     <div key={tx._id || i} onClick={() => setSelectedTx(tx)} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex items-center gap-4 cursor-pointer group">
                        <div className={`size-11 rounded-xl flex items-center justify-center ${['payout', 'deposit'].includes(tx.type) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                           {['payout', 'deposit'].includes(tx.type) ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="font-quicksand font-bold text-sm text-[var(--text-primary)] truncate ">{tx.description || tx.type}</p>
                           <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-40">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                           <p className={`text-base font-quicksand font-bold ${['payout', 'deposit'].includes(tx.type) ? 'text-emerald-500' : 'text-red-500'}`}>{['payout', 'deposit'].includes(tx.type) ? '+' : '-'}{fmt(tx.amount)}</p>
                           <p className="text-[11px] lg:text-[12px] font-quicksand font-bold  opacity-20 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1"><Printer className="size-2" /> Receipt</p>
                        </div>
                     </div>
                   ))}
                </div>
              )}

              {tab === 'escrow' && (
                 <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-4">
                       <Shield className="size-5 text-amber-500" />
                       <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-amber-600/70  leading-relaxed tracking-tight">Funds are held in escrow until order delivery is confirmed by the buyer.</p>
                    </div>
                    {escrowTxs.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No funds currently in pipeline</div>
                    ) : escrowTxs.map(tx => (
                      <div key={tx._id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-4">
                         <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Clock className="size-5" /></div>
                         <div className="flex-1 min-w-0">
                            <p className="font-quicksand font-bold text-sm text-[var(--text-primary)]">Order #{tx.order_id?._id?.slice(-6).toUpperCase()}</p>
                            <p className="text-[11px] lg:text-[12px] font-quicksand font-bold  text-amber-500 tracking-tight">{tx.order_id?.order_status}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-quicksand font-bold text-[var(--text-primary)]">{fmt(tx.amount)} XAF</p>
                            <p className="text-[11px] lg:text-[12px] font-quicksand font-bold  opacity-30">Escrowed</p>
                         </div>
                      </div>
                    ))}
                 </div>
              )}

              {tab === 'withdrawals' && (
                 <div className="space-y-2">
                    {withdrawalRequests.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">No withdrawal requests found</div>
                    ) : withdrawalRequests.map((wr) => (
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
                            <p className="font-quicksand font-bold text-sm text-[var(--text-primary)] capitalize">{wr.withdrawalMethod} Withdrawal</p>
                            <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-40">{new Date(wr.createdAt).toLocaleDateString()} • {wr.status}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-base font-quicksand font-bold text-[var(--text-primary)]">{fmt(wr.amount)}</p>
                            <p className="text-[10px] lg:text-[12px] font-quicksand font-bold opacity-30 capitalize">{wr.currency}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              )}
           </div>
        </div>
      </div>
    </>
  );
}
