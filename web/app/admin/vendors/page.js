"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  Store, ShieldCheck, Mail, MapPin, 
  Building2, ExternalLink, Search, Loader2, 
  Ban, User, TrendingUp, Star, 
  ChevronRight, RefreshCw, Activity, Package, Database
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchVendors();
    setCurrentPage(1);
  }, [statusFilter]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/vendors?status=${statusFilter === 'all' ? '' : statusFilter}`);
      if (res.data?.success) setVendors(res.data.data.vendors || []);
    } catch (err) {
      toast.error('Failed to resolve vendor registry');
    } finally { setLoading(false); }
  };

  const handleToggleVerify = async (vendorId, currentStatus) => {
    try {
      const res = await api.patch(`/admin/vendors/${vendorId}/status`, { verified: !currentStatus });
      if (res.data.success) {
        toast.success(`Node shifted to ${!currentStatus ? 'VERIFIED' : 'UNVERIFIED'}`);
        setVendors(prev => prev.map(v => v._id === vendorId ? { ...v, verified: !currentStatus } : v));
      }
    } catch (err) { toast.error('Shift failed'); }
  };

  const filteredVendors = vendors.filter(v => 
    v.store_name?.toLowerCase().includes(search.toLowerCase()) || 
    v.user_id?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const currentVendors = filteredVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-quicksand font-bold text-[var(--text-primary)] tracking-tight ">Merchant <span className="text-[var(--accent)]">Registry</span> Matrix</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Vendor Nodes Active // Global_Merchant_Registry</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)] shadow-inner">
              <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
              <input
                type="text"
                placeholder="FIND MERCHANT NODE..."
                className="bg-transparent border-none outline-none text-[10px] lg:text-[12px] font-quicksand font-bold tracking-[0.1em] w-48 text-[var(--text-primary)] capitalize"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
           </div>
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1">
              {['all', 'verified', 'unverified'].map(s => (
                <button
                  key={s} onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-quicksand font-bold tracking-tight transition-all capitalize ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {s}
                </button>
              ))}
           </div>
           <button onClick={fetchVendors} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Total Merchants', value: vendors.length, icon: Store, color: 'var(--accent)', sub: 'REGISTRY_COUNT' },
               { label: 'Verified Nodes', value: vendors.filter(v => v.verified).length, icon: ShieldCheck, color: '#10b981', sub: 'TRUST_INDEX' },
               { label: 'Avg Rating', value: '4.85', icon: Star, color: '#fbbf24', sub: 'UX_SCORE' },
               { label: 'Network Yield', value: 'High', icon: TrendingUp, color: '#6366f1', sub: 'SCALE_VECTOR' }
            ].map(s => (
               <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-2 capitalize opacity-40">{s.label}</p>
                        <h3 className="text-2xl font-quicksand font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Vendor Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Global Merchant Ledger
               </h3>
               <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Active Verification Matrix</p>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                 <LoadingSpinner text="Synchronizing Merchant Nodes" />
              ) : currentVendors.length === 0 ? (
                 <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                    <Store className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                    <p className="text-sm font-quicksand font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No merchant nodes synchronized in the registry matrix.</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 gap-4 p-6 lg:p-10">
                    {currentVendors.map(v => (
                       <div key={v._id} className="group relative rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex items-center p-4 lg:p-6 gap-6">
                          <div className="size-16 rounded-[1.5rem] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500">
                             <img src={v.user_id?.branding?.logo || v.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${v.store_name}`} className="size-full object-cover" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-primary)] tracking-tight capitalize truncate">{v.store_name}</h4>
                                {v.verified && <ShieldCheck className="size-3.5 text-emerald-500" />}
                             </div>
                             <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-tight">Node_Owner: {v.user_id?.name || 'GENERIC_USER'}</p>
                          </div>

                          <div className="hidden lg:grid grid-cols-3 gap-12 px-12 border-x border-[var(--glass-border)]/50">
                             <div className="text-center">
                                <p className="text-lg font-quicksand font-bold tabular-nums tracking-tighter">{v.total_sales || 0}</p>
                                <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-30 capitalize tracking-widest mt-1">Volume</p>
                             </div>
                             <div className="text-center">
                                <p className="text-lg font-quicksand font-bold tabular-nums tracking-tighter">{fmt(v.total_revenue)}</p>
                                <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-30 capitalize tracking-widest mt-1">Revenue</p>
                             </div>
                             <div className="text-center">
                                <div className="flex items-center gap-1 justify-center">
                                   <Star className="size-3 text-amber-500 fill-amber-500" />
                                   <p className="text-lg font-quicksand font-bold tabular-nums tracking-tighter">{v.rating?.toFixed(1) || '0.0'}</p>
                                </div>
                                <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-30 capitalize tracking-widest mt-1">Rating</p>
                             </div>
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                             <div className="text-right">
                                <div className="flex items-center gap-2 justify-end mb-1">
                                   <div className={`size-1.5 rounded-full ${v.verified ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                                   <span className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest capitalize opacity-60">{v.verified ? 'Verified' : 'Pending'}</span>
                                </div>
                                <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-20 capitalize tracking-widest">Merchant State</p>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                <button 
                                   onClick={() => handleToggleVerify(v._id, v.verified)} 
                                   className={`size-10 rounded-xl flex items-center justify-center border transition-all ${v.verified ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'}`}
                                   title={v.verified ? 'Revoke Verification' : 'Verify Merchant'}
                                >
                                   <ShieldCheck className="size-4.5" />
                                </button>
                                <Link href={`/stores/${v._id}`} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm active:scale-95">
                                   <ExternalLink className="size-4.5" />
                                </Link>
                                <button className="size-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95">
                                   <Ban className="size-4.5" />
                                </button>
                             </div>
                          </div>
                       </div>
                    ))}
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
