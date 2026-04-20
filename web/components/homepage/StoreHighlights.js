"use client";
import Link from 'next/link';
import { BadgeCheck, Users, ArrowUpRight } from 'lucide-react';

export default function StoreHighlights({ title, data }) {
  if (!data?.length) return null;

  return (
    <section className="py-4 px-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div className="space-y-2">
          <h2 className="text-xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight">
            {title || "Featured Artisans & Stores"}
          </h2>
          <div className="h-1 w-12 md:w-20 bg-[var(--accent)] rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.map((item, i) => {
          const vendor = item.vendor_id;
          if (!vendor) return null;
          const store = vendor.store;

          return (
            <div key={i} className="group relative bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden hover:border-[var(--accent)]/30 transition-all duration-500">
              {/* Cover Banner */}
              <div className="h-32 w-full overflow-hidden">
                <img 
                  src={store?.banner || vendor.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000'} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  alt={vendor.store_name}
                />
                <div className="absolute inset-x-0 top-0 h-32 bg-black/20" />
              </div>

              {/* Logo & Content */}
              <div className="px-8 pb-8 -mt-10 relative">
                <div className="relative group/logo inline-block">
                   <div className="w-20 h-20 rounded-2xl border-4 border-[var(--bg-secondary)] overflow-hidden shadow-xl bg-white">
                    <img 
                      src={store?.logo || vendor.user_id?.branding?.logo || vendor.user_id?.avatar || 'https://via.placeholder.com/150'} 
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
                    <div>
                      <h3 className="font-black text-xl text-[var(--text-primary)] leading-tight">
                        {vendor.store_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 opacity-60">
                         <StarIcon />
                         <span className="text-xs font-bold">{vendor.rating || 5.0} Rating</span>
                      </div>
                    </div>
                    <Link href={`/stores/${vendor._id}`} className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all">
                      <ArrowUpRight className="w-5 h-5" />
                    </Link>
                  </div>

                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 min-h-[2.5rem]">
                    {vendor.description || "Discover premium products from this elite curator."}
                  </p>

                  <div className="pt-4 flex items-center gap-4">
                    <button className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all">
                      Follow Store
                    </button>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                      <Users className="w-4 h-4 opacity-40" />
                      <span className="text-xs font-bold opacity-80">1.2k</span>
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
