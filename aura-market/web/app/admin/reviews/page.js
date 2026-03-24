"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, MessageSquare, Trash2, Search,
  Filter, RefreshCw, AlertTriangle, User, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function AdminReviewsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);

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

  if (user?.role !== 'admin') return null;

  return (
    <>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-10 glass-panel border-b border-[var(--glass-border)] z-20 bg-[var(--bg-primary)]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg lg:text-xl font-black tracking-tight uppercase">Governance <span className="text-[var(--accent)]">Reviews</span></h1>
          <div className="hidden sm:block h-4 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="hidden md:block text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">{reviews.length} System Records</p>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={fetchAllReviews} className="p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-6 lg:p-10 space-y-8">
         
         {/* Controls */}
         <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" />
              <input 
                type="text" 
                placeholder="Scan by User, Product, or Keyword..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 py-3.5 text-xs font-bold focus:border-[var(--accent)] outline-none transition-all shadow-sm"
              />
            </div>
         </div>

         {/* Content */}
         {loading ? (
           <div className="py-20 flex justify-center"><div className="animate-spin size-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>
         ) : filtered.length === 0 ? (
           <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
              <AlertTriangle className="size-16 mb-4 text-[var(--text-secondary)]" />
              <h3 className="text-xl font-black uppercase tracking-tighter">No Feedback Records</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2">The platform has not registered any reviews matching these criteria.</p>
           </div>
         ) : (
           <div className="glass-panel rounded-[24px] lg:rounded-[32px] border border-[var(--glass-border)] overflow-hidden bg-[var(--bg-primary)]/40 shadow-sm">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                   <thead>
                      <tr className="border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/60 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                         <th className="px-8 py-5">Customer</th>
                         <th className="px-8 py-5">Product</th>
                         <th className="px-8 py-5">Rating</th>
                         <th className="px-8 py-5">Comment</th>
                         <th className="px-8 py-5 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-[var(--glass-border)]/50">
                      {filtered.map(r => (
                        <tr key={r._id} className="hover:bg-[var(--bg-primary)]/60 transition-colors group">
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                 <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {r.user_id?.avatar ? <img src={r.user_id.avatar} className="size-full object-cover" /> : <User className="size-5 opacity-40" />}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">{r.user_id?.name || 'Anonymous'}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{r.user_id?.email || 'No email'}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-3 max-w-[200px]">
                                 <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {(() => {
                                       const imgObj = r.product_id?.images?.[0];
                                       const imgSrc = typeof imgObj === 'string' ? imgObj : imgObj?.url;
                                       return imgSrc ? <img src={imgSrc} className="size-full object-cover" /> : <Package className="size-5 opacity-40" />;
                                    })()}
                                 </div>
                                 <p className="text-xs font-bold truncate">{r.product_id?.name || 'Deleted Product'}</p>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-1">
                                 {[...Array(5)].map((_, i) => (
                                   <Star key={i} className={`size-3 ${i < r.rating ? 'text-amber-500 fill-amber-500 shadow-[0_0_8px_#f59e0b44]' : 'text-[var(--text-secondary)] opacity-10'}`} />
                                 ))}
                                 <span className="ml-2 text-xs font-black text-[var(--text-secondary)]">{r.rating}.0</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <div className="max-w-[300px]">
                                 <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic line-clamp-2">"{r.comment}"</p>
                              </div>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                   onClick={() => handleDelete(r._id)}
                                   disabled={deletingId === r._id}
                                   className="size-10 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 shadow-sm"
                                   title="Delete Review"
                                 >
                                    {deletingId === r._id ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                 </button>
                              </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
         )}
      </div>
    </>
  );
}


