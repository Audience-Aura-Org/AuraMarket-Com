"use client";

import { useState, useEffect } from 'react';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  History, Plus, TrendingUp, Loader2, X, CheckCircle2,
  AlertCircle, ArrowDownRight, CreditCard, Building2
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';

export const dynamic = 'force-dynamic';

const TX_ICONS = {
  deposit:    { Icon: ArrowDownLeft,  color: 'text-emerald-500', bg: 'bg-emerald-500/10', sign: '+' },
  withdrawal: { Icon: ArrowUpRight,   color: 'text-red-500',     bg: 'bg-red-500/10',     sign: '-' },
  payment:    { Icon: ArrowDownRight, color: 'text-amber-500',   bg: 'bg-amber-500/10',   sign: '-' },
  refund:     { Icon: ArrowDownLeft,  color: 'text-blue-500',    bg: 'bg-blue-500/10',    sign: '+' },
  payout:     { Icon: Building2,      color: 'text-purple-500',  bg: 'bg-purple-500/10',  sign: '+' },
};

export default function VendorWalletPage() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

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

  useEffect(() => {
    fetchWallet();
    const timer = setInterval(fetchWallet, 15000);
    const onFocus = () => fetchWallet();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) return showToast('Enter a valid amount.', 'error');
    setSubmitting(true);
    try {
      const res = await api.post('/wallet/deposit', { amount: Number(amount) });
      if (res.data.success) {
        setBalance(res.data.data.new_balance);
        setTransactions(prev => [res.data.data.transaction, ...prev]);
        showToast('Deposit successful!');
        setModal(null);
        setAmount('');
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Deposit failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [withdrawalMethod, setWithdrawalMethod] = useState(''); // 'mtn' | 'orange' | 'bank'
  const [accountDetails, setAccountDetails] = useState({ account_number: '', holder_name: '', bank_name: '' });

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) return showToast('Enter a valid amount.', 'error');
    if (Number(amount) > balance) return showToast('Insufficient balance.', 'error');
    if (!withdrawalMethod) return showToast('Select a withdrawal method.', 'error');
    
    setSubmitting(true);
    try {
      const res = await api.post('/wallet/withdraw', { 
        amount: Number(amount),
        method: withdrawalMethod,
        details: accountDetails
      });
      if (res.data.success) {
        setBalance(res.data.data.remaining_balance);
        setTransactions(prev => [res.data.data.transaction[0] || res.data.data.transaction, ...prev]);
        showToast('Withdrawal request submitted! Awaiting admin approval.');
        setModal(null);
        setAmount('');
        setWithdrawalMethod('');
        setAccountDetails({ account_number: '', holder_name: '', bank_name: '' });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Withdrawal failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalIn = transactions.filter(t => ['deposit', 'refund', 'payout'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => ['withdrawal', 'payment'].includes(t.type)).reduce((s, t) => s + t.amount, 0);

  return (
    <DashboardLayout role={user?.role || 'customer'}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-bold ${
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel bg-[var(--bg-primary)]/95 border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button onClick={() => { setModal(null); setAmount(''); setWithdrawalMethod(''); }} className="absolute top-5 right-5 p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]">
              <X className="w-5 h-5" />
            </button>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${modal === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {modal === 'deposit' ? <ArrowDownLeft className="w-7 h-7" /> : <ArrowUpRight className="w-7 h-7" />}
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] mb-1">{modal === 'deposit' ? 'Add Funds' : 'Withdraw Funds'}</h2>
            <p className="text-sm text-[var(--text-secondary)] font-bold mb-6 opacity-70">
              {modal === 'deposit' 
                ? 'Funds are instantly added to your wallet (simulated).' 
                : 'Withdrawal requests require admin approval (1-2 business days).'}
            </p>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-[var(--text-secondary)] tracking-widest uppercase mb-2 block opacity-50">Amount (XAF)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-black text-3xl"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--text-secondary)]">XAF</div>
                </div>
                {modal === 'withdraw' && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)] font-bold opacity-70 flex justify-between">
                    <span>Available: {balance.toLocaleString()} XAF</span>
                    {amount && <span className="text-[var(--accent)]">Fee: {(Number(amount) * 0.01).toLocaleString()} XAF</span>}
                  </p>
                )}
              </div>

              {modal === 'withdraw' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <label className="text-xs font-black text-[var(--text-secondary)] tracking-widest uppercase block opacity-50">Transfer Via</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'mtn', label: 'MTN MoMo', logo: 'size-6 rounded-lg bg-yellow-400' },
                      { id: 'orange', label: 'Orange Money', logo: 'size-6 rounded-lg bg-orange-500' },
                      { id: 'bank', label: 'Bank Transfer', logo: 'size-6 rounded-lg bg-blue-600' }
                    ].map(m => (
                      <button 
                        key={m.id}
                        onClick={() => setWithdrawalMethod(m.id)}
                        className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group ${withdrawalMethod === m.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] hover:border-[var(--accent)]/40'}`}
                      >
                         <div className={`${m.logo} flex items-center justify-center overflow-hidden`}>
                            {m.id === 'bank' && <Building2 className="w-4 h-4 text-white" />}
                            {m.id === 'mtn' && <span className="text-[8px] font-black text-black">MTN</span>}
                            {m.id === 'orange' && <span className="text-[8px] font-black text-white">OM</span>}
                         </div>
                         <span className={`text-[9px] font-black uppercase tracking-tighter ${withdrawalMethod === m.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {withdrawalMethod && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                       <div>
                          <input 
                            type="text" 
                            placeholder={withdrawalMethod === 'bank' ? 'Account Number / IBAN' : 'Phone Number (6xx xxx xxx)'}
                            value={accountDetails.account_number}
                            onChange={e => setAccountDetails({...accountDetails, account_number: e.target.value})}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          />
                       </div>
                       <div>
                          <input 
                            type="text" 
                            placeholder="Account Holder Name"
                            value={accountDetails.holder_name}
                            onChange={e => setAccountDetails({...accountDetails, holder_name: e.target.value})}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          />
                       </div>
                       {withdrawalMethod === 'bank' && (
                          <input 
                            type="text" 
                            placeholder="Bank Name (UBA, Afribank...)"
                            value={accountDetails.bank_name}
                            onChange={e => setAccountDetails({...accountDetails, bank_name: e.target.value})}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          />
                       )}
                    </div>
                  )}
                </div>
              )}

              {modal === 'deposit' && (
                <div className="flex gap-2 mb-2">
                  {[5000, 10000, 25000, 50000].map(qa => (
                    <button key={qa} onClick={() => setAmount(String(qa))} className="flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest border border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all text-[var(--text-secondary)] hover:text-[var(--accent)]">
                      {(qa / 1000).toFixed(0)}K
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={modal === 'deposit' ? handleDeposit : handleWithdraw}
                disabled={submitting || !amount || (modal === 'withdraw' && (!withdrawalMethod || !accountDetails.account_number || !accountDetails.holder_name))}
                className={`w-full h-16 flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl transition-all active:scale-95 disabled:opacity-30 shadow-2xl ${
                  modal === 'deposit' 
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50' 
                    : 'bg-[var(--accent)] text-white shadow-[var(--accent)]/30 hover:shadow-[var(--accent)]/50'
                }`}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {submitting ? 'Processing' : modal === 'deposit' ? 'Secure Deposit' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="flex-1 flex flex-col min-h-0 relative z-10 w-full">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-10 glass-panel border-b border-[var(--glass-border)] relative z-10 bg-[var(--bg-primary)]/50">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-[var(--accent)]" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">My Wallet</h1>
              <p className="text-xs text-[var(--text-secondary)] font-bold mt-0.5">Earnings & history</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Secure
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full no-scrollbar">
          <div className="p-8 space-y-8 w-full pb-20">
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="w-14 h-14 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
                <p className="mt-4 text-[var(--text-secondary)] font-bold text-sm">Loading wallet...</p>
              </div>
            ) : (
              <>
                {/* Balance Hero Card */}
                <div className="relative overflow-hidden rounded-[2.5rem] p-8 border border-[var(--glass-border)] shadow-2xl"
                  style={{ background: 'linear-gradient(135deg, var(--bg-primary) 0%, color-mix(in srgb, var(--accent) 8%, var(--bg-secondary)) 100%)' }}
                >
                  <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--accent)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6">
                      <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                      <span className="text-[10px] font-black tracking-[0.2em] text-[var(--text-secondary)] uppercase">Available Balance</span>
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                      <div>
                        <p className="text-5xl font-black tracking-tighter text-[var(--text-primary)]">
                          {balance.toLocaleString()}
                          <span className="text-2xl text-[var(--text-secondary)] font-bold ml-2">XAF</span>
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] font-bold mt-3 opacity-70">
                          Vendor Earnings Wallet · Updated just now
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setModal('deposit')}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--accent)] text-white font-black text-[11px] tracking-[0.15em] uppercase shadow-xl shadow-[var(--accent)]/30 hover:opacity-90 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Add Funds
                        </button>
                        <button
                          onClick={() => setModal('withdraw')}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 text-[var(--text-primary)] font-black text-[11px] tracking-[0.15em] uppercase hover:bg-[var(--bg-secondary)] transition-all active:scale-95"
                        >
                          <ArrowUpRight className="w-4 h-4" /> Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Received', value: totalIn.toLocaleString(), unit: 'XAF', Icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Total Spent', value: totalOut.toLocaleString(), unit: 'XAF', Icon: ArrowUpRight, color: 'text-red-500', bg: 'bg-red-500/10' },
                    { label: 'Pending Income', value: pendingBalance.toLocaleString(), unit: 'XAF', Icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Transactions', value: transactions.length, unit: 'total', Icon: History, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
                  ].map(s => (
                    <div key={s.label} className="p-6 rounded-3xl glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.bg} ${s.color}`}>
                        <s.Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase">{s.label}</p>
                        <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value} <span className="text-xs opacity-60">{s.unit}</span></p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Transaction History */}
                <div className="glass-panel bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[2rem] overflow-hidden">
                  <div className="px-8 py-5 border-b border-[var(--glass-border)] flex items-center gap-3">
                    <History className="w-5 h-5 text-[var(--accent)]" />
                    <h2 className="font-black text-[var(--text-primary)] text-base">Transaction History</h2>
                    <span className="ml-auto text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase">{transactions.length} records</span>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="py-20 flex flex-col items-center text-center">
                      <CreditCard className="w-12 h-12 opacity-20 mb-4 text-[var(--text-secondary)]" />
                      <p className="font-bold text-[var(--text-secondary)]">No transactions yet.</p>
                      <p className="text-xs text-[var(--text-secondary)] opacity-60 mt-1">Add funds to get started.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--glass-border)]">
                      {transactions.map((tx, i) => {
                        const config = TX_ICONS[tx.type] || TX_ICONS.payment;
                        const TxIcon = config.Icon;
                        const isCredit = ['+'].includes(config.sign) || ['deposit','refund','payout'].includes(tx.type);
                        return (
                          <div key={tx._id || i} className="flex items-center gap-5 px-8 py-5 hover:bg-[var(--accent)]/5 transition-all">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${config.bg} ${config.color}`}>
                              <TxIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[var(--text-primary)] text-sm truncate">{tx.description || tx.title || 'Transaction'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase">{tx.type}</span>
                                <span className="text-[var(--text-secondary)] opacity-40">·</span>
                                <span className="text-[10px] text-[var(--text-secondary)] font-bold">{new Date(tx.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-black text-lg ${isCredit ? 'text-emerald-500' : 'text-red-500'}`}>
                                {isCredit ? '+' : '-'}{tx.amount?.toLocaleString()} XAF
                              </p>
                              <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full ${
                                tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                tx.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


