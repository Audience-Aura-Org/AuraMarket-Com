"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, MessageSquare, Package, Search,
  TrendingUp, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

import Pagination from '@/components/common/Pagination';

export default function VendorRatingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendors/reviews');
      if (res.data.success) {
        setReviews(res.data.data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (!user || user.role !== 'vendor') return;
    let mounted = true;
    if (mounted) fetchReviews(); 
    return () => { mounted = false; };
  }, [fetchReviews, user]);

  const filtered = reviews.filter(r => {
    const productName = r.product_id?.name || 'Product';
    return productName.toLowerCase().includes(search.toLowerCase()) || 
           (r.comment && r.comment.toLowerCase().includes(search.toLowerCase()));
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentReviews = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : 0;

  if (user?.role !== 'vendor') return null;

  return (
    <>
      <header className="min-h-20 lg:h-24 h-auto flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Customer <span className="text-[var(--accent)]">Reviews</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[9px] font-black uppercase tracking-[0.3em] opacity-40"><span>{reviews.length}</span> Total Reviews</p>
        </div>

        <div className="flex items-center gap-3 lg:gap-4 self-end lg:self-auto">
          <button onClick={fetchReviews} className="p-2 lg:p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
            <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="bg-amber-500/10 text-amber-500 px-4 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl font-black text-[8px] lg:text-[10px] uppercase tracking-widest border border-amber-500/20 shadow-lg shadow-amber-500/10">
             Store Reputation
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
           {/* Summary Stats */}
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 mt-2">
              <div className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-3 lg:gap-6 shadow-sm">
                 <div className="size-10 lg:size-16 rounded-xl lg:rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                    <Star className="size-5 lg:size-8" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[7px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Average Rating</p>
                    <h2 className="text-base lg:text-3xl font-black tracking-tighter mt-0.5 lg:mt-1 font-mono">{avgRating}</h2>
                 </div>
              </div>
              
              <div className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-3 lg:gap-6 shadow-sm">
                 <div className="size-10 lg:size-16 rounded-xl lg:rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="size-5 lg:size-8" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[7px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Total Reviews</p>
                    <h2 className="text-base lg:text-3xl font-black tracking-tighter mt-0.5 lg:mt-1 font-mono">{reviews.length}</h2>
                 </div>
              </div>

              <div className="hidden lg:flex glass-panel p-6 rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 items-center gap-6 shadow-sm">
                 <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="size-8" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Store Status</p>
                    <h2 className="text-xl font-black tracking-tighter mt-1 uppercase text-emerald-500 whitespace-nowrap">Highly Rated</h2>
                 </div>
              </div>
           </div>

           {/* Search */}
           <div className="relative w-full lg:w-96 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors opacity-40" />
             <input 
               type="text" 
               placeholder="Search reviews by comment or product..." 
               value={search}
               onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
               className="w-full bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 py-3 lg:py-4 text-[10px] lg:text-xs font-black focus:border-[var(--accent)] outline-none transition-all shadow-xl placeholder:tracking-widest placeholder:uppercase placeholder:opacity-30 uppercase tracking-tighter"
             />
           </div>

           {/* Review List */}
           {loading ? (
             <div className="py-20 flex justify-center"><div className="animate-spin size-8 lg:size-10 border-2 border-[var(--accent)] border-t-transparent rounded-full shadow-lg shadow-[var(--accent)]/20" /></div>
           ) : filtered.length === 0 ? (
             <div className="py-20 lg:py-40 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="size-20 lg:size-28 rounded-[28px] lg:rounded-[40px] bg-[var(--bg-primary)] opacity-40 border border-[var(--glass-border)] flex items-center justify-center mb-8 relative group">
                   <AlertTriangle className="size-10 lg:size-14 text-[var(--text-secondary)]" />
                </div>
                <h3 className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">No Reviews Found</h3>
                <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] text-[var(--text-secondary)] mt-4 opacity-40 leading-relaxed">No matching reviews found within your current search.</p>
             </div>
           ) : (
             <div className="grid gap-4 lg:gap-8">
                {currentReviews.map(r => (
                  <div key={r._id} className="glass-panel p-6 lg:p-10 rounded-[32px] lg:rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all shadow-2xl flex flex-col lg:flex-row gap-6 lg:gap-10 group/row relative overflow-hidden">
                     <div className="lg:w-[280px] lg:border-r border-[var(--glass-border)] lg:pr-10 space-y-4 lg:space-y-6 flex flex-col justify-between">
                        <div className="flex items-center gap-4 lg:gap-5">
                           <div className="size-10 lg:size-14 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shadow-inner group-hover/row:scale-110 transition-transform">
                              {r.user_id?.avatar ? <img src={r.user_id.avatar} className="size-full object-cover" /> : <div className="text-xs lg:text-sm font-black text-[var(--accent)]">{r.user_id?.name?.charAt(0) || 'U'}</div>}
                           </div>
                           <div className="min-w-0">
                              <p className="text-[10px] lg:text-xs font-black uppercase tracking-tight truncate text-[var(--text-primary)]">{r.user_id?.name || 'Customer'}</p>
                              <p className="text-[8px] lg:text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest mt-0.5">{new Date(r.createdAt).toLocaleDateString([], {month: 'short', day: '2-digit', year: 'numeric'})}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 lg:p-3 bg-[var(--bg-primary)]/30 rounded-xl border border-[var(--glass-border)] w-fit lg:w-full lg:justify-center">
                           {[...Array(5)].map((_, i) => (
                             <Star key={i} className={`size-3 lg:size-5 ${i < r.rating ? 'text-amber-500 fill-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'text-[var(--text-secondary)] opacity-20'}`} />
                           ))}
                        </div>
                     </div>
                     
                     <div className="flex-1 min-w-0 flex flex-col justify-between py-2">
                        <div className="relative">
                           <div className="absolute -top-4 -left-4 opacity-[0.03] pointer-events-none">
                              <span className="material-symbols-outlined text-6xl lg:text-8xl">format_quote</span>
                           </div>
                           <p className="text-xs lg:text-base font-black leading-relaxed text-[var(--text-primary)] relative z-10 italic">"{r.comment}"</p>
                        </div>
                        
                        <div className="mt-8 flex items-center gap-4 lg:gap-6 p-4 lg:p-5 rounded-2xl lg:rounded-3xl bg-[var(--bg-primary)]/20 border border-[var(--glass-border)] hover:bg-[var(--accent)]/5 transition-all cursor-pointer group/product">
                           <div className="size-12 lg:size-16 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg group-hover/product:scale-105 transition-transform duration-500">
                              {(() => {
                                  const imgObj = r.product_id?.images?.[0];
                                  const imgSrc = typeof imgObj === 'string' ? imgObj : imgObj?.url;
                                  return imgSrc ? <img src={imgSrc} className="size-full object-cover" /> : <Package className="size-6 text-[var(--accent)] opacity-40" />;
                               })()}
                           </div>
                           <div className="min-w-0">
                              <p className="text-[9px] lg:text-[11px] font-black tracking-[0.2em] uppercase text-[var(--accent)] truncate group-hover/product:text-[var(--text-primary)] transition-colors">{r.product_id?.name || 'Product'}</p>
                              <p className="text-[7px] lg:text-[9px] font-black text-[var(--text-secondary)] uppercase mt-1 opacity-40">Purchased Item</p>
                           </div>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}

           <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
           />
      </div>
    </>
  );
}
