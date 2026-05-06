"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  Check, X, Eye, ShieldCheck, Loader2, 
  Package, Building2, User, FileText, AlertCircle, 
  RefreshCw, Database, Zap, Activity, Clock, ExternalLink
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState('Vendors');
  const [mounted, setMounted] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setMounted(true);
    fetchData();
    setCurrentPage(1);
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'Vendors') {
        const res = await api.get('/admin/vendors/pending');
        if (res.data?.success) setVendors(res.data.data.submissions || []);
      } else {
        const res = await api.get('/admin/products/pending');
        if (res.data?.success) setProducts(res.data.data.products || []);
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

  const currentData = activeTab === 'Vendors' ? vendors : products;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const pagedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight ">Queue <span className="text-[var(--accent)]">Control</span> Management</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Auth Queue Active // Node_Governance_Master</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1">
              {['Vendors', 'Products'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-bold tracking-tight transition-all capitalize ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab}
                </button>
              ))}
           </div>

           <button onClick={fetchData} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Pending Vendors', value: vendors.length, icon: Building2, color: 'var(--accent)', sub: 'KYC_QUEUE' },
               { label: 'Pending Assets', value: products.length, icon: Package, color: '#6366f1', sub: 'PRODUCT_GATE' },
               { label: 'Wait Latency', value: '4.2h', icon: Clock, color: '#10b981', sub: 'SYNC_SPEED' },
               { label: 'Risk Profile', value: 'Minimal', icon: AlertCircle, color: '#fbbf24', sub: 'SAFETY_INDEX' }
            ].map(s => (
               <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-2 capitalize opacity-40">{s.label}</p>
                        <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Approval Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Verification Ledger // {activeTab.toUpperCase()}
               </h3>
               <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Global Governance Active</p>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                 <LoadingSpinner text="Synchronizing Governance Nodes" />
              ) : pagedData.length === 0 ? (
                 <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                    <ShieldCheck className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                    <p className="text-sm font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No pending nodes in the synchronization queue.</p>
                 </div>
              ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left font-sm">
                       <thead>
                          <tr className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] text-[var(--text-secondary)] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 capitalize">
                             <th className="px-10 py-5">Ident Node</th>
                             <th className="px-6 py-5">Descriptor</th>
                             <th className="px-6 py-5">Protocol State</th>
                             <th className="px-10 py-5 text-right">Governance</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[var(--glass-border)]/50">
                          {activeTab === 'Vendors' ? pagedData.map(v => (
                             <tr key={v._id} className="group hover:bg-[var(--accent)]/5 transition-all">
                                <td className="px-10 py-6">
                                   <div className="flex items-center gap-4">
                                      <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-sm group-hover:scale-110 transition-transform">
                                         {v.user_id?.avatar ? <img src={v.user_id.avatar} className="size-full object-cover" /> : <User className="w-5 h-5" />}
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] tracking-tight capitalize truncate max-w-[200px]">{v.vendor_id?.store_name || v.user_id?.name}</p>
                                         <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 font-mono capitalize">#{v._id.slice(-6).toUpperCase()}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-6">
                                   <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] capitalize">{v.user_id?.email}</p>
                                   <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-30 mt-1 capitalize flex items-center gap-1.5">
                                      <FileText className="w-3 h-3" /> {v.id_type?.replace(/_/g, ' ') || 'IDENTITY_VERIF'}
                                   </p>
                                </td>
                                <td className="px-6 py-6">
                                   <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] lg:text-[12px] font-bold tracking-widest border border-amber-500/20 capitalize">
                                      Pending Sync
                                   </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      <button className="size-9 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] transition-all flex items-center justify-center shadow-sm">
                                         <Eye className="w-4 h-4" />
                                      </button>
                                      <button 
                                         onClick={() => handleReviewKYC(v._id, 'rejected')}
                                         disabled={actioning === v._id}
                                         className="size-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                      >
                                         <X className="w-5 h-5" />
                                      </button>
                                      <button 
                                         onClick={() => handleReviewKYC(v._id, 'approved')}
                                         disabled={actioning === v._id}
                                         className="size-9 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
                                      >
                                         {actioning === v._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          )) : pagedData.map(p => (
                             <tr key={p._id} className="group hover:bg-[var(--accent)]/5 transition-all">
                                <td className="px-10 py-6">
                                   <div className="flex items-center gap-4">
                                      <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                                         <img src={p.images?.[0]?.url || '/placeholder.png'} className="size-full object-cover" alt="" />
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] tracking-tight capitalize truncate max-w-[200px]">{p.name}</p>
                                         <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 font-mono capitalize">#{p._id.slice(-6).toUpperCase()}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-6">
                                   <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] capitalize">{p.vendor_id?.store_name}</p>
                                   <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-30 mt-1 capitalize">Merchant Node</p>
                                </td>
                                <td className="px-6 py-6">
                                   <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] lg:text-[12px] font-bold tracking-widest border border-indigo-500/20 capitalize">
                                      Inventory Lock
                                   </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      <button className="size-9 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] transition-all flex items-center justify-center shadow-sm">
                                         <Eye className="w-4 h-4" />
                                      </button>
                                      <button 
                                         onClick={() => handleReviewProduct(p._id, 'rejected')}
                                         disabled={actioning === p._id}
                                         className="size-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                      >
                                         <X className="w-5 h-5" />
                                      </button>
                                      <button 
                                         onClick={() => handleReviewProduct(p._id, 'active')}
                                         disabled={actioning === p._id}
                                         className="size-9 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
                                      >
                                         {actioning === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
            </div>

            <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
               <Pagination 
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={setCurrentPage}
               />
            </div>
         </div>
      </div>
    </div>
  );
}
