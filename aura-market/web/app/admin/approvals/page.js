"use client";

import { useState, useEffect } from 'react';
import { 
  Check, X, Eye, ShieldCheck, Loader2, 
  Package, Building2, User, FileText, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState('Vendors');
  const [mounted, setMounted] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'Vendors') {
        const res = await api.get('/admin/vendors/pending');
        if (res.data?.success) setVendors(res.data.data.submissions || []);
      } else if (activeTab === 'Products') {
        const res = await api.get('/admin/products/pending');
        if (res.data?.success) setProducts(res.data.data.products || []);
      } else if (activeTab === 'Withdrawals') {
        const res = await api.get('/wallet/admin/withdrawals');
        if (res.data?.success) setWithdrawals(res.data.data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending queue:', err);
      toast.error('Failed to sync with verification nodes');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewKYC = async (kycId, status) => {
    setActioning(kycId);
    try {
      const res = await api.patch(`/admin/kyc/${kycId}/review`, { 
        status, 
        feedback: status === 'approved' ? 'Profile verified by platform administration.' : 'Documentation verification failed.'
      });
      if (res.data.success) {
        toast.success(`Vendor ${status} successfully`);
        setVendors(prev => prev.filter(v => v._id !== kycId));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification shift failed');
    } finally {
      setActioning(null);
    }
  };

  const handleReviewProduct = async (productId, status) => {
    setActioning(productId);
    try {
      const res = await api.patch(`/admin/products/${productId}/review`, { status });
      if (res.data.success) {
        toast.success(`Product ${status === 'active' ? 'authorized' : 'rejected'}`);
        setProducts(prev => prev.filter(p => p._id !== productId));
      }
    } catch (err) {
      toast.error('Asset authorization failed');
    } finally {
      setActioning(null);
    }
  };

  const handleReviewWithdrawal = async (txId, action) => {
    setActioning(txId);
    try {
      const res = await api.patch(`/wallet/admin/withdrawals/${txId}`, { action });
      if (res.data.success) {
        toast.success(`Withdrawal ${action}ed successfully`);
        setWithdrawals(prev => prev.filter(w => w._id !== txId));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Financial sync failed');
    } finally {
      setActioning(null);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-10 glass-panel border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Queue <span className="text-[var(--accent)]">Control</span></h2>
          <div className="hidden sm:block h-4 w-px bg-[var(--glass-border)]" />
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
             <button 
               onClick={() => setActiveTab('Vendors')} 
               className={`px-3 lg:px-4 py-1.5 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'Vendors' ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/10'}`}
             >
               Vendors
             </button>
             <button 
                onClick={() => setActiveTab('Products')} 
                className={`px-3 lg:px-4 py-1.5 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'Products' ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/10'}`}
              >
                Products
              </button>
              <button 
                onClick={() => setActiveTab('Withdrawals')} 
                className={`px-3 lg:px-4 py-1.5 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'Withdrawals' ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/10'}`}
              >
                Withdrawals
              </button>
          </div>
        </div>
        <div className="flex items-center gap-3 lg:gap-4">
           <button onClick={fetchData} className="p-2 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-primary)]">
              <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
           <div className="hidden xs:flex px-3 lg:px-4 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] lg:text-[9px] font-black tracking-widest uppercase">
              System Active
           </div>
        </div>
      </header>

      <div className="flex-1 p-4 lg:p-10 space-y-8">
         <div className="max-w-[1400px] mx-auto space-y-8">
            
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {[
                 { label: 'Pending Vendors', value: vendors.length, icon: Building2 },
                 { label: 'Pending Products', value: products.length, icon: Package },
                 { label: 'Withdrawal Req.', value: withdrawals.length, icon: RefreshCw },
                 { label: 'Safety Index', value: '99.2%', icon: ShieldCheck }
               ].map(s => (
                 <div key={s.label} className="glass-panel p-5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">{s.label}</p>
                    <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{s.value}</h3>
                 </div>
               ))}
            </div>

            {/* Data Table View */}
            <div className="glass-panel rounded-[32px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-xl">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="text-[10px] font-black tracking-[0.3em] uppercase text-[var(--text-secondary)] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                           <th className="px-8 py-5">Ident Node</th>
                           <th className="px-6 py-5">Descriptor</th>
                           <th className="px-6 py-5">Protocol State</th>
                           <th className="px-8 py-5 text-right">Goverance</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[var(--glass-border)]">
                        {activeTab === 'Vendors' ? vendors.map(v => (
                          <tr key={v._id} className="hover:bg-[var(--accent)]/5 transition-all group">
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                   <div className="size-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-black border border-[var(--accent)]/10">
                                      {(v.vendor_id?.store_name || v.user_id?.name || 'V')[0].toUpperCase()}
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-[var(--text-primary)] line-clamp-1">{v.vendor_id?.store_name || v.user_id?.name}</p>
                                      <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60">ID: #{v._id.slice(-6).toUpperCase()}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                   <p className="text-xs font-bold text-[var(--text-primary)]">{v.user_id?.email}</p>
                                   <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest flex items-center gap-2">
                                      <FileText className="size-3" /> {v.id_type?.replace('_', ' ') || 'National ID'}
                                   </p>
                                </div>
                             </td>
                             <td className="px-6 py-5">
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-[0.2em] border border-amber-500/20">
                                   Pending Sync
                                </span>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                   <button className="size-9 rounded-lg border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)]/10 group-hover:scale-105 transition-all shadow-sm">
                                      <Eye className="size-4" />
                                   </button>
                                   <button 
                                     onClick={() => handleReviewKYC(v._id, 'rejected')}
                                     disabled={actioning === v._id}
                                     className="size-9 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                   >
                                      <X className="size-5" />
                                   </button>
                                   <button 
                                     onClick={() => handleReviewKYC(v._id, 'approved')}
                                     disabled={actioning === v._id}
                                     className="size-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
                                   >
                                      {actioning === v._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="size-5" />}
                                   </button>
                                </div>
                             </td>
                          </tr>
                        )) : activeTab === 'Products' ? products.map(p => (
                          <tr key={p._id} className="hover:bg-[var(--accent)]/5 transition-all group">
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                   <div className="size-10 rounded-xl bg-[var(--accent)]/5 overflow-hidden border border-[var(--glass-border)]">
                                      <img src={p.images?.[0]?.url || '/placeholder.png'} className="size-full object-cover" alt="" />
                                   </div>
                                   <div className="max-w-[200px]">
                                      <p className="text-sm font-black text-[var(--text-primary)] truncate">{p.name}</p>
                                      <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60">PRICE: {p.price?.toLocaleString()} XAF</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-5">
                                <p className="text-xs font-bold text-[var(--text-primary)] uppercase">{p.vendor_id?.store_name}</p>
                                <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-1 opacity-60">Vendor Node</p>
                             </td>
                             <td className="px-6 py-5">
                                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-[0.2em] border border-blue-500/20">
                                   Inventory Lock
                                </span>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                   <button className="size-9 rounded-lg border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)]/10 transition-all">
                                      <Eye className="size-4" />
                                   </button>
                                   <button 
                                     onClick={() => handleReviewProduct(p._id, 'rejected')}
                                     disabled={actioning === p._id}
                                     className="size-9 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                   >
                                      <X className="size-5" />
                                   </button>
                                   <button 
                                     onClick={() => handleReviewProduct(p._id, 'active')}
                                     disabled={actioning === p._id}
                                     className="size-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
                                   >
                                      {actioning === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="size-5" />}
                                   </button>
                                </div>
                             </td>
                          </tr>
                        )) : withdrawals.map(w => (
                          <tr key={w._id} className="hover:bg-[var(--accent)]/5 transition-all group">
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                   <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-black border border-red-500/10">
                                      <DollarSign className="size-5" />
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-[var(--text-primary)]">{w.user_id?.name || 'Unknown User'}</p>
                                      <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60">REF: {w.reference}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-5">
                                <p className="text-xs font-black text-rose-500">{w.amount?.toLocaleString()} XAF</p>
                                <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-1 opacity-60">Payout Frequency</p>
                             </td>
                             <td className="px-6 py-5">
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-[0.2em] border border-amber-500/20">
                                   Awaiting Liquidaton
                                </span>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                   <button 
                                     onClick={() => handleReviewWithdrawal(w._id, 'reject')}
                                     disabled={actioning === w._id}
                                     className="size-9 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                   >
                                      <X className="size-5" />
                                   </button>
                                   <button 
                                     onClick={() => handleReviewWithdrawal(w._id, 'approve')}
                                     disabled={actioning === w._id}
                                     className="size-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                                   >
                                      {actioning === w._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="size-5" />}
                                   </button>
                                </div>
                             </td>
                          </tr>
                        ))}

                        {((activeTab === 'Vendors' && vendors.length === 0) || (activeTab === 'Products' && products.length === 0) || (activeTab === 'Withdrawals' && withdrawals.length === 0)) && !loading && (
                          <tr>
                             <td colSpan={4} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-4 opacity-30">
                                   <ShieldCheck className="size-12" />
                                   <p className="text-[10px] font-black uppercase tracking-widest">Protocol Sync Complete (Queue Empty)</p>
                                </div>
                             </td>
                          </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
