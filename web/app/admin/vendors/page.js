"use client";

import { useState, useEffect } from 'react';
import { Store, ShieldCheck, Mail, MapPin, Building2, ExternalLink, Search, Loader2, Ban, Verified, Power, User } from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';
import Link from 'next/link';

import Pagination from '@/components/common/Pagination';

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const itemsPerPage = 9;

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
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerify = async (vendorId, currentStatus) => {
    try {
      const res = await api.patch(`/admin/vendors/${vendorId}/status`, { verified: !currentStatus });
      if (res.data.success) {
        toast.success(`Verification status shift complete.`);
        setVendors(prev => prev.map(v => v._id === vendorId ? { ...v, verified: !currentStatus } : v));
      }
    } catch (err) {
      toast.error('Verification toggle failed');
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.store_name?.toLowerCase().includes(search.toLowerCase()) || 
    v.user_id?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const currentVendors = filteredVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex h-screen bg-[var(--bg-secondary)]">
      <RoleSidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-6 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] backdrop-blur-xl shrink-0 z-10 text-[var(--text-primary)]">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Nexus <span className="text-[var(--accent)]">Vendors</span></h2>
            <div className="hidden sm:block h-4 w-px bg-[var(--glass-border)] opacity-30" />
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
              <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
              <input 
                type="text" 
                placeholder="Find node..." 
                className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-48 text-[var(--text-primary)]"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
             <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--glass-border)]">
                {['all', 'verified', 'unverified'].map((s) => (
                  <button 
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 lg:px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/5'}`}
                  >
                    {s}
                  </button>
                ))}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 space-y-6 pb-32">
        {/* Mobile Search */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
          <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
          <input 
            type="text" 
            placeholder="Search stores..." 
            className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-full text-[var(--text-primary)]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {loading ? (
           <div className="py-20 flex flex-col items-center justify-center opacity-40">
              <Loader2 className="size-12 animate-spin text-[var(--accent)] mb-4" />
              <p className="text-[9px] font-black uppercase tracking-[0.5em]">Scanning Grid nodes...</p>
           </div>
        ) : (
           <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8">
                {currentVendors.map(v => (
                  <div key={v._id} className="glass-panel border border-[var(--glass-border)] hover:border-[var(--accent)]/30 rounded-[24px] lg:rounded-[32px] bg-[var(--bg-primary)]/50 group transition-all flex flex-col overflow-hidden relative shadow-sm hover:shadow-xl shrink-0 h-fit">
                    
                    {/* Store Banner */}
                    <div className="h-28 lg:h-32 w-full relative overflow-hidden bg-[var(--bg-secondary)] shrink-0">
                       <img 
                         src={v.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80'} 
                         className="size-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" 
                         alt="" 
                       />
                       <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
                    </div>

                    <div className="px-5 lg:px-8 pb-6 lg:pb-8 pt-0 relative">
                       {/* Overlapping Logo */}
                       <div className="absolute -top-10 left-5 lg:left-8">
                           <div className="size-16 lg:size-20 rounded-2xl bg-[var(--bg-primary)] border-4 border-[var(--bg-primary)] shadow-2xl overflow-hidden shrink-0">
                              <img src={v.user_id?.branding?.logo || v.user_id?.avatar || 'https://via.placeholder.com/150'} className="size-full object-cover" alt="" />
                           </div>
                       </div>

                       <div className="flex items-center justify-between mt-8 lg:mt-10 mb-4 lg:mb-6">
                          <div className="min-w-0 flex-1">
                             <div className="flex items-center gap-2">
                                <h4 className="text-base lg:text-lg font-black tracking-tight uppercase group-hover:text-[var(--accent)] transition-colors truncate">{v.store_name}</h4>
                                {v.verified && <ShieldCheck className="size-3.5 lg:size-4 text-emerald-500 shrink-0" />}
                             </div>
                             <div className="flex items-center gap-1.5 group/vendor mb-2">
                               <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                                 <img 
                                   src={v.user_id?.branding?.logo || v.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${v.store_name}&backgroundColor=var(--accent)`} 
                                   className="size-full object-cover"
                                   alt="Store"
                                 />
                               </div>
                               <span className="text-[9px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[80px]">
                                 {v.store_name}
                               </span>
                             </div>
                             <p className="text-[8px] lg:text-[9px] font-black uppercase text-[var(--text-secondary)] opacity-60 flex items-center gap-1.5 truncate">
                                <User className="size-2.5 lg:size-3" /> {v.user_id?.name}
                             </p>
                          </div>
                          <Link href={`/stores/${v._id}`} className="size-9 lg:size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shrink-0 shadow-sm">
                             <ExternalLink className="size-4 lg:size-5" />
                          </Link>
                       </div>

                       <p className="text-[10px] lg:text-[11px] font-medium text-[var(--text-secondary)] opacity-70 line-clamp-1 mb-6 h-4 uppercase tracking-widest">
                          {v.description || 'Verified Marketplace Node'}
                       </p>

                       <div className="grid grid-cols-3 gap-3 mb-6 lg:mb-8">
                          <div className="py-2 lg:py-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-center shadow-inner">
                             <p className="text-[6px] lg:text-[7px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-0.5 opacity-50">Rating</p>
                             <p className="text-[9px] lg:text-[11px] font-black">{v.rating?.toFixed(1) || '0.0'}</p>
                          </div>
                          <div className="py-2 lg:py-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-center shadow-inner">
                             <p className="text-[6px] lg:text-[7px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-0.5 opacity-50">Volume</p>
                             <p className="text-[9px] lg:text-[11px] font-black">{v.total_sales || 0}</p>
                          </div>
                          <div className="py-2 lg:py-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-center shadow-inner">
                             <p className="text-[6px] lg:text-[7px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-0.5 opacity-50">Rev.</p>
                             <p className="text-[9px] lg:text-[11px] font-black whitespace-nowrap overflow-hidden">{(v.total_revenue || 0).toLocaleString()}</p>
                          </div>
                       </div>

                       <div className="flex gap-3">
                          <button 
                            onClick={() => handleToggleVerify(v._id, v.verified)}
                            className={`flex-1 h-11 lg:h-12 rounded-xl font-black text-[7px] lg:text-[8px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 border shadow-lg ${v.verified ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                          >
                             <ShieldCheck className="size-3.5 lg:size-4" />
                             {v.verified ? 'Revoke' : 'Verify'}
                          </button>
                          <button className="size-11 lg:size-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg shrink-0">
                             <Ban className="size-5" />
                          </button>
                       </div>
                    </div>

                    <div className={`absolute top-0 right-0 p-10 lg:p-14 blur-[60px] lg:blur-[80px] -z-10 rounded-full ${v.verified ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`} />
                  </div>
                ))}
            </div>

            <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
            />

              {filteredVendors.length === 0 && (
                 <div className="col-span-full py-32 text-center opacity-30">
                    <Store className="size-16 mx-auto mb-4 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-[0.5em]">No synchronization nodes found</p>
                 </div>
              )}
           </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

