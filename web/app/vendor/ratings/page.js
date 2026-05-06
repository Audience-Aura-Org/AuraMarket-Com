"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, Search, RefreshCw, Package, User
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import Pagination from '@/components/common/Pagination';
import { motion, AnimatePresence } from 'framer-motion';

export default function VendorRatingsPage() {
  const user = useAuthStore((s) => s.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendor/reviews');
      if (res.data.success) {
        setReviews(res.data.data?.reviews || res.data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (!user || user.role !== 'vendor') return;
    fetchReviews(); 
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

  const fiveStars = reviews.filter(r => r.rating === 5).length;
  const fourStars = reviews.filter(r => r.rating === 4).length;
  const threeStars = reviews.filter(r => r.rating === 3).length;
  const twoStars = reviews.filter(r => r.rating === 2).length;
  const oneStar = reviews.filter(r => r.rating === 1).length;

  if (user?.role !== 'vendor') return null;

  return (
    <div className="w-full min-h-screen max-w-[1600px] mx-auto">
        
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner border border-amber-500/20 shrink-0">
               <Star className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Public <span className="text-[var(--accent)]">Ratings</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Reputation Hub</p>
              </div>
            </div>
          </div>
          <button onClick={fetchReviews} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative group flex-1 md:flex-none md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
              <input 
                type="text" 
                placeholder="Scan reviews..." 
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-[11px] lg:text-[12px] font-semibold outline-none focus:border-[var(--accent)] transition-all"
              />
           </div>
           <button onClick={fetchReviews} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

        <div className="px-4 md:px-8 py-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[
              { label: 'Score', value: avgRating, sub: '/ 5 Stars', icon: Star, color: 'amber' },
              { label: 'Feedback', value: reviews.length, sub: 'Total', icon: Package, color: 'indigo' },
              { label: 'Top Tier', value: fiveStars, sub: '5 Stars', icon: Star, color: 'emerald' },
              { label: 'Issues', value: (threeStars + twoStars + oneStar), sub: '< 4 Stars', icon: Star, color: 'rose' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="p-5 md:p-6 rounded-3xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] group hover:border-amber-500/30 transition-all shadow-sm"
              >
                <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 w-fit mb-4 group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                </div>
                <p className="text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)] tracking-tight mb-1 uppercase opacity-40">{stat.label}</p>
                <h4 className="text-2xl md:text-3xl font-bold tracking-tighter mb-1">{stat.value}</h4>
                <p className="text-[10px] md:text-[11px] font-semibold opacity-40 uppercase tracking-tight">{stat.sub}</p>
              </motion.div>
            ))}
          </div>


          {/* Reviews List */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin size-10 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="size-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-[var(--text-secondary)]/30" />
              </div>
              <h3 className="text-xl  font-bold text-[var(--text-primary)]">No Reviews</h3>
              <p className="text-xs text-[var(--text-secondary)] opacity-60 mt-2">No reviews found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentReviews.map(r => (
                <div key={r._id} className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/20 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="size-12 h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.user_id?.avatar ? (
                        <img src={r.user_id.avatar} className="size-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-[var(--accent)] opacity-60" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className=" font-bold text-sm text-[var(--text-primary)]">
                          {r.user_id?.name || 'Customer'}
                        </span>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`size-3 ${i < r.rating ? 'text-amber-500 fill-amber-500' : 'text-[var(--text-secondary)]/30'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      
                      {r.comment && (
                        <p className="text-xs text-[var(--text-secondary)] mb-3">"{r.comment}"</p>
                      )}
                      
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                        <div className="size-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {r.product_id?.images?.[0]?.url ? (
                            <img src={r.product_id.images[0].url} className="size-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-[var(--accent)] opacity-40" />
                          )}
                        </div>
                        <span className="text-xs  font-bold text-[var(--accent)] truncate">
                          {r.product_id?.name || 'Product'}
                        </span>
                      </div>
                    </div>
                    
                    <span className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-60">
                      {new Date(r.createdAt).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pt-6 flex justify-center">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </div>
  );
}
