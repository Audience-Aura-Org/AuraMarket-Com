"use client";

import { useEffect, useState } from 'react';
import { 
  Users, Search, Star, MessageCircle, MapPin, 
  Globe, LayoutGrid, ArrowRight, Loader2, Filter
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';

export default function VendorsDirectoryPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await api.get('/vendors');
        if (res.data?.success) setVendors(res.data.data.stores);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchVendors();
  }, []);

  const filtered = vendors.filter(v => 
    v.store_name?.toLowerCase().includes(search.toLowerCase()) || 
    v.bio?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header & Functional Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[var(--glass-border)]">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                 <Users className="size-6" />
              </div>
              <div className="space-y-0.5">
                 <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Merchant Directory</h1>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">1,240 global nodes</p>
              </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group w-full md:w-64">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
                 <input 
                   type="text" 
                   placeholder="Search nodes..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full h-10 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-xs focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5 transition-all outline-none"
                 />
              </div>
              <button className="h-10 px-4 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-white/5 transition-all">
                 <Filter className="size-4" />
              </button>
           </div>
        </div>

        {/* Dense List Grid */}
        <div className="space-y-3">
           {loading ? (
              [...Array(8)].map((_, i) => (
                 <div key={i} className="h-16 rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] animate-pulse" />
              ))
           ) : (
              filtered.map(vendor => (
                 <div 
                   key={vendor._id} 
                   className="group p-3 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] hover:bg-[var(--bg-primary)] hover:border-[var(--accent)]/30 transition-all flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-pointer relative overflow-hidden"
                 >
                    <div className="absolute left-0 top-0 h-full w-1 bg-transparent group-hover:bg-[var(--accent)] transition-colors duration-500" />
                    
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center p-0.5 shrink-0 transition-transform duration-500 group-hover:scale-105">
                          <img src={vendor.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${vendor._id}`} className="size-full object-cover rounded-lg" alt="" />
                       </div>
                       <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate uppercase tracking-tight">{vendor.store_name}</h3>
                          <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1 text-[var(--accent)]">
                                <Star className="size-3 fill-[var(--accent)]" />
                                <span className="text-[10px] font-black">{vendor.rating || '5.0'}</span>
                             </div>
                             <span className="text-[9px] font-medium text-[var(--text-secondary)] opacity-30 truncate uppercase tracking-widest">{vendor.bio?.slice(0, 40)}...</span>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 h-px bg-[var(--glass-border)] hidden md:block opacity-20" />

                    <div className="flex items-center justify-between md:justify-end gap-6">
                       <div className="hidden lg:flex flex-col items-end">
                          <p className="text-[8px] font-black tracking-widest text-[var(--text-secondary)] opacity-30 uppercase">Origin Node</p>
                          <p className="text-[10px] font-bold text-[var(--text-primary)] opacity-60">West Central Africa</p>
                       </div>
                       
                       <div className="flex items-center gap-3">
                          <Link href={`/chat?vendorId=${vendor._id}`} className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/20 transition-all group/msg">
                             <MessageCircle className="size-4 group-hover/msg:scale-110 transition-transform" />
                          </Link>
                          <Link href={`/shop?vendorId=${vendor._id}`} className="h-10 px-6 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-[var(--accent)] hover:text-white transition-all group/btn">
                             View Node <ArrowRight className="size-3 group-hover/btn:translate-x-1 transition-transform" />
                          </Link>
                       </div>
                    </div>
                 </div>
              ))
           )}
        </div>

        {/* Global Footer */}
        <div className="pt-12 text-center opacity-30">
           <p className="text-[8px] font-black tracking-[0.4em] text-[var(--text-secondary)] uppercase">
              Aura Market Global Network Registry // Definitive Status 2.0
           </p>
        </div>

      </div>
    </div>
  );
}
