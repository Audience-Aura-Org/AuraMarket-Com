"use client";
import Link from 'next/link';
import { BadgeCheck, Users, ArrowUpRight, Check } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useEffect } from 'react';
import VendorFollowButton from '@/components/VendorFollowButton';

export default function StoreHighlights({ title, data }) {
  const { followedVendorIds, fetchFollowedVendors, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) fetchFollowedVendors();
  }, [isAuthenticated, fetchFollowedVendors]);

  if (!data?.length) return null;

  // Helper to format follower counts
  const formatCount = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <section className="py-6 w-full">
      <div className="flex flex-col md:flex-row items-baseline justify-between mb-8 px-4 md:px-6 gap-3">
        <div className="space-y-1 text-left">
          <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {title || "Top Rated Vendors"}
          </h2>
          <div className="h-1 w-12 md:w-20 bg-[var(--accent)] rounded-full" />
        </div>
        <Link href="/discovery?tab=vendors" className="flex items-center gap-2 group cursor-pointer">
           <div className="h-0.5 w-12 bg-[var(--accent)] rounded-full transition-all group-hover:w-16" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)]">View All Vendors</span>
        </Link>
      </div>

      <div className="flex gap-6 md:gap-8 px-4 md:px-6 overflow-x-auto no-scrollbar pb-10 snap-x snap-mandatory">
        {data.map((item, i) => {
          const vendor = item.vendor_id;
          if (!vendor) return null;
          const store = vendor.store;

          return (
            <div key={i} className="flex-shrink-0 w-[280px] md:w-[360px] snap-start group relative bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden hover:border-[var(--accent)]/30 transition-all duration-500">
              {/* Cover Banner */}
              <div className="h-32 w-full overflow-hidden relative">
                <img 
                  src={store?.banner || vendor.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000'} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  alt={vendor.store_name}
                />
                <div className="absolute inset-0 bg-black/20" />
              </div>

              {/* Logo & Content */}
              <div className="px-6 pb-6 -mt-10 relative">
                <div className="relative group/logo inline-block">
                   <div className="w-20 h-20 rounded-2xl border-4 border-[var(--bg-secondary)] overflow-hidden shadow-xl bg-white">
                    <img 
                      src={store?.logo || vendor.user_id?.branding?.logo || vendor.user_id?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.store_name)}&background=random`} 
                      className="w-full h-full object-cover" 
                      alt={vendor.store_name}
                    />
                  </div>
                  {vendor.verified && (
                    <div className="absolute -right-2 -bottom-2 bg-blue-500 text-white rounded-full p-1 border-2 border-[var(--bg-secondary)] shadow-lg">
                      <BadgeCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-black text-lg text-[var(--text-primary)] leading-tight truncate">
                        {vendor.store_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 opacity-60">
                         <StarIcon />
                         <span className="text-[10px] font-bold uppercase tracking-tight">{vendor.rating ? vendor.rating.toFixed(1) : '5.0'} Rating</span>
                      </div>
                    </div>
                    <Link href={`/stores/${vendor._id}`} className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shrink-0">
                      <ArrowUpRight className="w-5 h-5" />
                    </Link>
                  </div>

                  <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed">
                    {vendor.description || "Discover premium products from this elite curator."}
                  </p>

                  <div className="pt-2 flex items-center gap-3">
                    <VendorFollowButton 
                      vendorId={vendor._id} 
                      className="!h-10 !text-[9px] flex-1"
                    />
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                      <Users className="w-3.5 h-3.5 opacity-40 text-[var(--accent)]" />
                      <span className="text-[10px] font-black opacity-80">{formatCount(vendor.follower_count)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StarIcon() {
  return (
    <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 24 24">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}
