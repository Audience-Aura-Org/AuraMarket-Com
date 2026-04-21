"use client";

import { useEffect, useState } from 'react';
import { 
  Zap, ShieldCheck, Star, ArrowUpRight, 
  LayoutGrid, Globe, Phone, Mail, ChevronRight, Loader2
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';

export default function VerifiedBrandsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await api.get('/vendors');
        if (res.data?.success) {
          // Priority to high rated/verified
          setVendors(res.data.data.stores.sort((a,b) => (b.verified ? 1 : -1)));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchVendors();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Slim Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between items-start gap-4">
           <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--accent)] bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10">
                 <ShieldCheck className="size-3" />
                 <span className="text-[8px] font-black uppercase tracking-[0.4em]">Governance Protocol</span>
              </div>
              <h1 className="text-4xl font-bold text-[var(--text-primary)] tracking-tight uppercase">Elite <span className="text-[var(--accent)]">Entities</span></h1>
              <p className="text-xs font-medium text-[var(--text-secondary)] opacity-40 max-w-sm tracking-tight leading-relaxed">
                 Surgical selection of elite merchants with definitive ratings and fulfillment trust benchmarks.
              </p>
           </div>
           
           <div className="flex gap-3">
              <div className="h-10 px-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                 124 Verified
              </div>
           </div>
        </div>

        {/* Dense Brand List */}
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                 <div key={i} className="h-32 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] animate-pulse" />
              ))}
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor, i) => (
                 <Link 
                   key={vendor._id}
                   href={`/shop?vendorId=${vendor._id}`}
                   className="p-5 rounded-2xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] hover:bg-[var(--bg-primary)] hover:border-[var(--accent)]/30 transition-all group relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--accent)]/[0.02] blur-xl rounded-full translate-x-8 -translate-y-8" />
                    
                    <div className="flex items-center gap-4 relative z-10">
                       <div className="size-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center p-0.5 overflow-hidden group-hover:scale-105 transition-transform duration-500 shadow-sm shrink-0">
                          <img 
                            src={vendor.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${vendor._id}`} 
                            className="size-full object-cover rounded-lg" alt="" 
                          />
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             <h3 className="text-sm font-bold text-[var(--text-primary)] truncate uppercase tracking-tight">{vendor.store_name}</h3>
                             {vendor.verified && <Zap className="size-3 text-[var(--accent)] fill-[var(--accent)]" />}
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1 text-[var(--accent)]">
                                <Star className="size-3 fill-[var(--accent)]" />
                                <span className="text-[10px] font-black">{vendor.rating || '5.0'}</span>
                             </div>
                             <span className="text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest whitespace-nowrap">Node 0x_{vendor._id.slice(-4).toUpperCase()}</span>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--glass-border)] relative z-10">
                       <p className="text-[9px] font-black tracking-widest text-[var(--text-secondary)] opacity-30 uppercase">Fulfillment Rate: 99%</p>
                       <ChevronRight className="size-4 text-[var(--text-secondary)] opacity-20 group-hover:translate-x-1 group-hover:text-[var(--accent)] transition-all" />
                    </div>
                 </Link>
              ))}
           </div>
        )}

        {/* Global Footer Hub Information */}
        <div className="text-center pt-12 pb-20 opacity-20 hover:opacity-100 transition-opacity">
           <p className="text-[8px] font-black tracking-[0.6em] text-[var(--text-secondary)] uppercase">
              Authenticated via Aura Security Protocol | Version 1.2
           </p>
        </div>

      </div>
    </div>
  );
}
