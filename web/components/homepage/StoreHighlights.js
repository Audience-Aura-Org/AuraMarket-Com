"use client";
import Link from 'next/link';
import { BadgeCheck, Users, ArrowUpRight, ArrowRight } from 'lucide-react';
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
    <section className="w-full py-6 sm:py-7 lg:py-9">
      <div className="mb-5 flex items-end justify-between gap-3 px-0 md:mb-7 md:px-1">
        <div className="min-w-0 space-y-1 text-left">
          <h2 className="truncate font-[var(--font-poppins)] text-[18px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-xl md:text-2xl">
            {title || "Top Rated Vendors"}
          </h2>
        </div>
        <Link
          href="/discovery?tab=vendors"
          className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 font-[var(--font-poppins)] text-[11px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--accent)] hover:text-white active:scale-[0.98] sm:h-10 sm:px-4 sm:text-[12px]"
        >
           <span>Vendors</span>
           <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 sm:size-4" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar px-0 pb-8 snap-x snap-mandatory md:gap-4 md:px-1 md:pb-10">
        {data.map((item, i) => {
          const vendor = item.vendor_id;
          if (!vendor) return null;
          const store = vendor.store;

          return (
            <div key={i} className="group relative w-[82vw] max-w-[340px] flex-shrink-0 snap-start overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm transition-all duration-300 hover:border-[var(--accent)]/30 hover:shadow-lg sm:w-[48vw] md:w-[340px]">
              {/* Cover Banner */}
              <div className="relative h-28 w-full overflow-hidden sm:h-32">
                <img 
                  src={store?.banner || vendor.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000'} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  alt={vendor.store_name}
                />
                <div className="absolute inset-0 bg-black/20" />
              </div>

              {/* Logo & Content */}
              <div className="relative -mt-9 px-4 pb-5 sm:px-5 sm:pb-6">
                <div className="relative group/logo inline-block">
                   <div className="size-[72px] overflow-hidden rounded-2xl border-4 border-[var(--bg-secondary)] bg-white shadow-xl sm:size-20">
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
                      <h3 className="truncate font-[var(--font-poppins)] text-base font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-lg">
                        {vendor.store_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 opacity-60">
                         <StarIcon />
                         {Number(vendor.rating || 0) > 0 && (
                           <span className="font-[var(--font-poppins)] text-[11px] font-semibold tracking-normal">{Number(vendor.rating).toFixed(1)}</span>
                         )}
                      </div>
                    </div>
                    <Link href={`/stores?id=${encodeURIComponent(vendor._id)}`} className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shrink-0">
                      <ArrowUpRight className="w-5 h-5" />
                    </Link>
                  </div>

                  <p className="line-clamp-2 min-h-[2.5rem] font-[var(--font-poppins)] text-[12px] font-medium leading-relaxed text-[var(--text-secondary)] sm:text-[13px]">
                    {vendor.description || "Discover premium products from this elite curator."}
                  </p>

                  <div className="pt-2 flex items-center gap-3">
                    <VendorFollowButton 
                      vendorId={vendor._id} 
                      className="!h-10 flex-1 !text-[10px] lg:text-[12px]"
                    />
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                      <Users className="w-3.5 h-3.5 opacity-40 text-[var(--accent)]" />
                      <span className="font-[var(--font-poppins)] text-[11px] font-semibold opacity-80 lg:text-[12px]">{formatCount(vendor.follower_count)}</span>
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
