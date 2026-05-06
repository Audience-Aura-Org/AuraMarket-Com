"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, MessageSquare, Trash2, Search,
  Filter, RefreshCw, AlertTriangle, User, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import { useAuthStore } from '@/hooks/useAuth';

import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminReviewsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchAllReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews/admin');
      if (res.data.success) {
        setReviews(res.data.data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    fetchAllReviews();
  }, [fetchAllReviews, user]);

  const handleDelete = async (reviewId) => {
    if (!confirm('Are you sure you want to permanently delete this review? This will also update the product rating.')) return;
    
    try {
      setDeletingId(reviewId);
      const res = await api.delete(`/reviews/${reviewId}`);
      if (res.data.success) {
        setReviews(prev => prev.filter(r => r._id !== reviewId));
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete review.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = reviews.filter(r => {
    const userName = r.user_id?.name || 'User';
    const productName = r.product_id?.name || 'Product';
    return userName.toLowerCase().includes(search.toLowerCase()) || 
           productName.toLowerCase().includes(search.toLowerCase()) ||
           (r.comment && r.comment.toLowerCase().includes(search.toLowerCase()));
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentReviews = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (user?.role !== 'admin') return null;

  return (
    <>
      {/* Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Star className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Governance <span className="text-[var(--accent)]">Reviews</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">{reviews.length} System Records</p>
              </div>
            </div>
          </div>
          <button onClick={fetchAllReviews} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative group flex-1 md:flex-none md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
              <input 
                type="text" 
                placeholder="Scan by User, Product..." 
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-[11px] lg:text-[12px] font-semibold outline-none focus:border-[var(--accent)] transition-all"
              />
           </div>
           <button onClick={fetchAllReviews} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-6 lg:p-10 space-y-8">
         

         {/* Content */}
         {loading ? (
           <LoadingSpinner fullScreen />
         ) : filtered.length === 0 ? (
           <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
              <AlertTriangle className="size-16 mb-4 text-[var(--text-secondary)]" />
              <h3 className="text-xl  font-bold  tracking-tighter">No Feedback Records</h3>
              <p className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] mt-2">The platform has not registered any reviews matching these criteria.</p>
           </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {currentReviews.map(r => (
                 <div key={r._id} className="group glass-panel rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-6 flex flex-col space-y-4 hover:border-[var(--accent)]/30 transition-all shadow-sm hover:shadow-xl">
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                             {r.user_id?.avatar ? <img src={r.user_id.avatar} className="size-full object-cover" /> : <User className="size-5 opacity-40" />}
                          </div>
                          <div className="min-w-0">
                             <p className="text-sm font-bold text-[var(--text-primary)] truncate">{r.user_id?.name || 'Anonymous'}</p>
                             <div className="flex items-center gap-1 mt-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`size-2.5 ${i < r.rating ? 'text-amber-500 fill-amber-500' : 'text-[var(--text-secondary)] opacity-10'}`} />
                                ))}
                             </div>
                          </div>
                       </div>
                       <button 
                         onClick={() => handleDelete(r._id)}
                         disabled={deletingId === r._id}
                         className="size-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
                       >
                          {deletingId === r._id ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                       </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]">
                       <div className="size-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                          {(() => {
                             const imgObj = r.product_id?.images?.[0];
                             const imgSrc = typeof imgObj === 'string' ? imgObj : imgObj?.url;
                             return imgSrc ? <img src={imgSrc} className="size-full object-cover" /> : <Package className="size-5 opacity-40" />;
                          })()}
                       </div>
                       <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-tight opacity-40">Product</p>
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{r.product_id?.name || 'Deleted Product'}</p>
                       </div>
                    </div>

                    <div className="flex-1">
                       <p className="text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] leading-relaxed line-clamp-4 italic opacity-80">"{r.comment}"</p>
                    </div>

                    <div className="pt-4 border-t border-[var(--glass-border)]/50 flex items-center justify-between">
                       <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em]">Rating {r.rating}.0</span>
                       <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-tight">Active Node</span>
                    </div>
                 </div>
               ))}
               
               <div className="col-span-full pt-10">
                  <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
               </div>
            </div>
         )}
      </div>
    </>
  );
}
