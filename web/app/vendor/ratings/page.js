"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, Search, RefreshCw, Package, User
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Pagination from '@/components/common/Pagination';

export const dynamic = 'force-dynamic';

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
    <DashboardLayout role="vendor">
      <div className="w-full min-h-screen">
        
        {/* Page Header */}
        <div className="px-4 md:px-8 py-6 border-b border-[var(--glass-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)]">Ratings</h1>
                <p className="text-sm text-[var(--text-secondary)] opacity-60">Customer reviews</p>
              </div>
            </div>
            <button onClick={fetchReviews} className="p-2 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 text-[var(--text-secondary)]">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-4 md:px-8 py-8">
          
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Star className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Average</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-amber-500">{avgRating}</p>
                <span className="text-xs text-amber-500/60">/ 5</span>
              </div>
            </div>
            
            <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Total</p>
              <p className="text-3xl font-black text-[var(--text-primary)]">{reviews.length}</p>
            </div>
            
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-3">5 Stars</p>
              <p className="text-3xl font-black text-emerald-500">{fiveStars}</p>
            </div>
            
            <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hidden lg:block">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">1-4 Stars</p>
              <p className="text-3xl font-black text-[var(--text-primary)]">{fourStars + threeStars + twoStars + oneStar}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
            <input 
              type="text" 
              placeholder="Search reviews..." 
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-11 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-[var(--accent)] transition-all"
            />
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
              <h3 className="text-xl font-black text-[var(--text-primary)]">No Reviews</h3>
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
                        <span className="font-bold text-sm text-[var(--text-primary)]">
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
                        <span className="text-xs font-bold text-[var(--accent)] truncate">
                          {r.product_id?.name || 'Product'}
                        </span>
                      </div>
                    </div>
                    
                    <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
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
    </DashboardLayout>
  );
}
