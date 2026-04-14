"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  Loader2, X, CheckCircle2, AlertCircle,
  Lock, ArrowRightLeft, Sparkles, Building2
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';

const TX_ICONS = {
  deposit:    { Icon: ArrowDownLeft,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  withdrawal: { Icon: ArrowUpRight,   color: 'text-red-500',     bg: 'bg-red-500/10' },
  payment:    { Icon: ArrowDownLeft,  color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  refund:     { Icon: ArrowDownLeft,  color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  payout:     { Icon: Building2,     color: 'text-purple-500',  bg: 'bg-purple-500/10' },
};

export default function WalletPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [withdrawalMethod, setWithdrawalMethod] = useState('');
  const [accountDetails, setAccountDetails] = useState({ account_number: '', holder_name: '' });
  const itemsPerPage = 10;

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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    
    fetchWallet();
    const timer = setInterval(fetchWallet, 15000);
    const onFocus = () => fetchWallet();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [mounted, user]);

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
        showToast('Withdrawal request submitted!');
        setModal(null);
        setAmount('');
        setWithdrawalMethod('');
        setAccountDetails({ account_number: '', holder_name: '' });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Withdrawal failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalIn = transactions.filter(t => ['deposit', 'refund', 'payout'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => ['withdrawal', 'payment'].includes(t.type)).reduce((s, t) => s + t.amount, 0);

  const filteredTransactions = transactions.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in') return ['deposit', 'refund', 'payout'].includes(tx.type);
    if (activeTab === 'out') return ['withdrawal', 'payment'].includes(tx.type);
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <DashboardLayout role={user?.role || 'vendor'}>
      
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-bold animate-in fade-in slide-in-from-top-4 ${
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setModal(null); setAmount(''); setWithdrawalMethod(''); }} className="absolute top-5 right-5 p-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)]">
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${modal === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]'}`}>
                {modal === 'deposit' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">
                  {modal === 'deposit' ? 'Add Funds' : 'Withdraw'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] opacity-60">
                  {modal === 'deposit' ? 'Top up your wallet instantly' : 'Transfer to your account'}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-[var(--text-secondary)] tracking-widest uppercase mb-2 block opacity-60">Amount (XAF)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-5 text-3xl font-black text-[var(--text-primary)] placeholder-[var(--text-secondary)]/30 focus:outline-none focus:border-[var(--accent)] transition-all text-center"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--text-secondary)]/40">XAF</span>
                </div>
                {modal === 'deposit' && (
                  <div className="flex gap-2 mt-3">
                    {[5000, 10000, 25000, 50000].map(qa => (
                      <button key={qa} onClick={() => setAmount(String(qa))} className="flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
                        {qa >= 1000 ? `${qa/1000}K` : qa}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {modal === 'withdraw' && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] tracking-widest uppercase block opacity-60">Receive Via</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'mtn', label: 'MTN MoMo', logo: 'bg-yellow-400' },
                      { id: 'orange', label: 'Orange', logo: 'bg-orange-500' },
                      { id: 'bank', label: 'Bank', logo: 'bg-indigo-600' }
                    ].map(m => (
                      <button 
                        key={m.id}
                        onClick={() => setWithdrawalMethod(m.id)}
                        className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${withdrawalMethod === m.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] hover:border-[var(--accent)]/30'}`}
                      >
                        <div className={`size-6 rounded-lg ${m.logo} flex items-center justify-center`}>
                          {m.id === 'bank' && <Building2 className="w-3 h-3 text-white" />}
                          {m.id === 'mtn' && <span className="text-[6px] font-black text-black">MTN</span>}
                          {m.id === 'orange' && <span className="text-[6px] font-black text-white">OM</span>}
                        </div>
                        <span className={`text-[8px] font-black uppercase ${withdrawalMethod === m.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {withdrawalMethod && (
                    <div className="space-y-3 pt-2">
                      <input 
                        type="text" 
                        placeholder={withdrawalMethod === 'bank' ? 'Account Number' : 'Phone Number'}
                        value={accountDetails.account_number}
                        onChange={e => setAccountDetails({...accountDetails, account_number: e.target.value})}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none focus:border-[var(--accent)]"
                      />
                      <input 
                        type="text" 
                        placeholder="Account Holder Name"
                        value={accountDetails.holder_name}
                        onChange={e => setAccountDetails({...accountDetails, holder_name: e.target.value})}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={modal === 'deposit' ? handleDeposit : handleWithdraw}
                disabled={submitting || !amount || (modal === 'withdraw' && (!withdrawalMethod || !accountDetails.account_number))}
                className={`w-full h-14 flex items-center justify-center gap-2 font-black uppercase tracking-wider text-xs rounded-2xl transition-all active:scale-[0.98] disabled:opacity-30 ${
                  modal === 'deposit' ? 'bg-emerald-500 text-white' : 'bg-[var(--accent)] text-white'
                }`}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {submitting ? 'Processing...' : modal === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--text-primary)]">My Wallet</h1>
              <p className="text-sm text-[var(--text-secondary)] opacity-60">Manage your funds</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Secured</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="size-14 rounded-full border-4 border-[var(--accent)]/10 border-t-[var(--accent)] animate-spin" />
            <p className="mt-6 text-[var(--text-secondary)] font-bold text-xs uppercase tracking-widest opacity-40">Loading...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* KPI Cards - Same style as vendor/products */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
              <KPICard title="Available" value={`${balance.toLocaleString()}`} icon={Wallet} color="emerald" sub="XAF Ready" />
              <KPICard title="In Escrow" value={`${pendingBalance.toLocaleString()}`} icon={Lock} color="amber" sub="XAF Held" />
              <KPICard title="Total In" value={`+${totalIn.toLocaleString()}`} icon={ArrowDownLeft} color="fuchsia" sub="XAF Received" />
              <KPICard title="Total Out" value={`-${totalOut.toLocaleString()}`} icon={ArrowUpRight} color="blue" sub="XAF Sent" />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setModal('deposit')}
                className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider hover:bg-emerald-600 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
              >
                <ArrowDownLeft className="w-5 h-5" />
                Deposit
              </button>
              <button
                onClick={() => setModal('withdraw')}
                className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-bold text-sm uppercase tracking-wider hover:bg-[var(--bg-secondary)]/80 transition-all active:scale-[0.98]"
              >
                <ArrowUpRight className="w-5 h-5" />
                Withdraw
              </button>
            </div>

            {/* Transactions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-[var(--text-primary)]">Transactions</h2>
                <span className="text-xs font-bold text-[var(--text-secondary)] opacity-60">{filteredTransactions.length} records</span>
              </div>

              <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-xl">
                {['all', 'in', 'out'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'in' ? 'Received' : 'Sent'}
                  </button>
                ))}
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
                  <div className="size-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
                    <ArrowRightLeft className="w-7 h-7 text-[var(--text-secondary)]/30" />
                  </div>
                  <p className="text-sm font-bold text-[var(--text-secondary)] opacity-40">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentTransactions.map((tx, i) => {
                    const config = TX_ICONS[tx.type] || TX_ICONS.payment;
                    const TxIcon = config.Icon;
                    const isCredit = ['deposit', 'refund', 'payout'].includes(tx.type);
                    
                    return (
                      <div key={tx._id || i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/20 transition-all">
                        <div className={`size-12 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                          <TxIcon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-[var(--text-primary)] truncate">
                            {tx.description || tx.title || (isCredit ? 'Received' : 'Sent')}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                            {new Date(tx.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-base font-black ${isCredit ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isCredit ? '+' : '-'}{tx.amount?.toLocaleString()}
                          </p>
                          <p className={`text-[9px] font-bold uppercase ${
                            tx.status === 'completed' ? 'text-emerald-500' :
                            tx.status === 'pending' ? 'text-amber-500' : 'text-red-500'
                          }`}>
                            {tx.status}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="pt-6 flex justify-center">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function KPICard({ title, value, icon: Icon, color, sub }) {
  const colorMap = {
    fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    blue: 'bg-indigo-500/10 text-indigo-500',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[24px] lg:rounded-3xl p-4 lg:p-6 group hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden glass-panel shadow-sm w-full">
      <div className={`absolute -right-4 -top-4 w-16 lg:w-24 h-16 lg:h-24 rounded-full blur-2xl opacity-50 ${colorMap[color]?.split(' ')[0]}`} />
      <div className="flex justify-between items-start mb-3 lg:mb-4 relative z-10">
        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[var(--text-secondary)] text-[7px] lg:text-[10px] font-black tracking-[0.2em] uppercase opacity-50">{title}</p>
        <h3 className="text-fluid-base lg:text-fluid-xl font-bold text-[var(--text-primary)] mt-1 truncate">{value}</h3>
        {sub && <p className="text-[7px] lg:text-[11px] text-[var(--text-secondary)] font-bold mt-1 opacity-50 uppercase tracking-tighter truncate">{sub}</p>}
      </div>
    </div>
  );
}
