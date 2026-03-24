"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Store, Star, ArrowRight, ShieldCheck, Users, Search, Filter } from 'lucide-react';
import api from '@/services/api';
import { vendorService } from '@/services/vendor';

export const dynamic = 'force-dynamic';

export default function StoresDirectoryPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchStores = async () => {
      try {
        const data = await vendorService.getPublicStores();
        if (data?.success) {
          setStores(data.data.stores || []);
        }
      } catch (err) {
        console.error("Error fetching stores:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const filteredStores = stores.filter(s => 
    s.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 relative overflow-x-hidden pb-40 transition-colors duration-500">
      {/* Background Ambience */}
      <div className="fixed top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-[var(--accent-light)]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <main className="w-full px-6 lg:px-20 py-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-black tracking-widest uppercase">
               Verified Merchants
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-[var(--text-primary)]">
              Store <span className="text-[var(--accent)]">Network</span>
            </h1>
            <p className="text-[var(--text-secondary)] font-medium max-w-xl text-lg">
              Direct connection to elite vendors across the global Aura ecosystem.
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search premium nodes..." 
                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all outline-none shadow-sm"
              />
            </div>
            <button className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)] shadow-sm">
               <Filter className="size-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="h-80 rounded-[40px] bg-[var(--bg-primary)] animate-pulse border border-[var(--glass-border)]"></div>
            ))}
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="py-40 text-center glass-panel rounded-[64px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
             <Store className="size-16 text-[var(--text-secondary)]/30 mx-auto mb-6" />
             <h2 className="text-2xl font-black text-[var(--text-primary)]/60">No nodes found in vicinity</h2>
             <p className="text-[var(--text-secondary)] font-medium mt-2">Adjust your frequency scan criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredStores.map((s) => (
              <Link 
                key={s._id} 
                href={`/stores/${s._id}`}
                className="group relative rounded-[40px] bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--accent)]/20 hover:-translate-y-2 glass-panel"
              >
                {/* Banner Background */}
                <div className="absolute top-0 left-0 w-full h-32 overflow-hidden">
                   <img 
                    src={s.store?.banner || s.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000'} 
                    className="w-full h-full object-cover brightness-75 group-hover:scale-110 transition-transform duration-1000"
                    alt="Banner"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] to-transparent opacity-80"></div>
                </div>

                <div className="relative pt-20 px-6 pb-8 flex flex-col items-center text-center">
                  {/* Profile Avatar */}
                  <div className="size-24 rounded-3xl overflow-hidden border-4 border-[var(--bg-primary)] shadow-2xl relative z-10 bg-[var(--bg-secondary)]">
                    <img 
                      src={s.store?.logo || s.user_id?.branding?.logo || s.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${s.store_name}&backgroundColor=f20df2`} 
                      alt={s.store_name}
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>

                  <div className="mt-6 space-y-3 relative z-10 w-full">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-xl font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight line-clamp-1">{s.store_name}</h3>
                      {s.verified && (
                        <ShieldCheck className="size-4 text-blue-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-black tracking-widest w-fit mx-auto">
                      <Star className="size-3 fill-current" /> {s.rating || '4.9'}
                    </div>

                    <p className="text-[var(--text-secondary)] text-xs font-medium line-clamp-2 leading-relaxed h-8">
                      {s.description || 'Verified merchant providing elite assets to the collective.'}
                    </p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-[var(--glass-border)] w-full flex items-center justify-between">
                    <div className="flex flex-col items-start">
                       <span className="text-[8px] font-black text-[var(--text-secondary)]/60 tracking-[0.3em] uppercase">Status</span>
                       <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <div className="size-1 rounded-full bg-emerald-500 animate-pulse"></div> Active
                       </span>
                    </div>
                    
                    <div className="size-10 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)] group-hover:text-white flex items-center justify-center transition-all duration-500 shadow-sm">
                       <ArrowRight className="size-5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


