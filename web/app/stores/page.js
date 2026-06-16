"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { Store, Star, ArrowRight, ShieldCheck, Users, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/services/api';
import { vendorService } from '@/services/vendor';
import Pagination from '@/components/common/Pagination';
import StorePageClient from './[id]/StorePageClient';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

function StoresDirectoryContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const storeId = searchParams?.get('id');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mounted, setMounted] = useState(false);

  const fetchStores = async (pageNum = 1) => {
    setLoading(true);
    try {
      const data = await vendorService.getPublicStores(pageNum);
      if (data?.success) {
        setStores(data.data.stores || []);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error("Error fetching stores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchStores(page);
  }, [page]);

  const filteredStores = stores.filter(s => 
    s.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePageChange = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!mounted) return null;
  if (storeId) return <StorePageClient storeId={storeId} />;

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 relative overflow-x-hidden pb-40 transition-colors duration-500 md:pt-0" style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))' }}>
      {/* Background Ambience */}
      <div className="fixed top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-[var(--accent-light)]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <main className="w-full px-6 lg:px-20 py-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-end gap-10 mb-12"
        >

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
              <input 
                type="text" 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('store.searchPlaceholder', 'Search stores...')}
                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3 pl-12 pr-4 !text-base placeholder:!text-base font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent)]/50 transition-all shadow-sm"
              />
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:bg-[var(--bg-primary)]/80 transition-all text-[var(--text-secondary)] shadow-sm hover:text-[var(--accent)]"
            >
               <Filter className="size-5" />
            </motion.button>
          </div>
        </motion.div>

        {filteredStores.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-40 text-center glass-panel rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 space-y-4"
          >
             <div className="size-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto">
               <Store className="size-8 text-[var(--accent)]/60" />
             </div>
             <div>
               <h2 className="text-2xl  font-bold text-[var(--text-primary)]/70">{loading ? t('store.syncing', 'Stores syncing') : t('store.noneFound', 'No stores found')}</h2>
               <p className="text-[var(--text-secondary)] font-medium mt-2 text-sm">
                 {loading ? t('store.syncingDetail', 'Stores appear here as soon as the latest directory arrives.') : t('store.searchEmptyDetail', 'Try adjusting your search criteria.')}
               </p>
             </div>
          </motion.div>
        ) : (
          <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {filteredStores.map((s, idx) => (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                whileHover={{ y: -8 }}
              >
                <Link 
                  href={`/stores?id=${encodeURIComponent(s._id)}`}
                  className="group relative rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-[var(--accent)]/15 glass-panel h-full flex flex-col"
                >
                  {/* Banner Background */}
                  <div className="absolute top-0 left-0 w-full h-28 overflow-hidden">
                     <img 
                      src={s.store?.banner || s.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000'} 
                      className="w-full h-full object-cover brightness-50 group-hover:brightness-60 group-hover:scale-105 transition-all duration-700"
                      alt="Banner"
                     />
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-primary)]"></div>
                  </div>

                  <div className="relative pt-16 px-5 pb-6 flex flex-col items-center text-center flex-1">
                    {/* Profile Avatar */}
                    <motion.div 
                      className="size-20 rounded-2xl overflow-hidden border-4 border-[var(--bg-primary)] shadow-xl relative z-10 bg-[var(--bg-secondary)] -mt-10 group-hover:shadow-2xl transition-all"
                      whileHover={{ scale: 1.08 }}
                    >
                      <img 
                        src={s.store?.logo || s.user_id?.branding?.logo || s.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${s.store_name}&backgroundColor=f20df2`} 
                        alt={s.store_name}
                        className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </motion.div>

                    <div className="mt-5 space-y-3 relative z-10 w-full flex-1 flex flex-col">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <h3 className="text-base  font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">{s.store_name}</h3>
                        {s.verified && (
                          <ShieldCheck className="size-3.5 text-blue-400" />
                        )}
                      </div>
                      
                      <div className="flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-xs  font-bold w-fit mx-auto">
                        <Star className="size-3 fill-current" />
                        {Number(s.rating || 0) > 0 && <span>{Number(s.rating).toFixed(1)}</span>}
                      </div>

                      <p translate={s.description ? 'no' : undefined} className="text-[var(--text-secondary)] text-xs font-medium line-clamp-2 leading-relaxed h-8 flex-1">
                        {s.description || t('store.verifiedMerchantFallback', 'Verified merchant providing quality products.')}
                      </p>
                    </div>

                    <div className="mt-auto pt-4 border-t border-[var(--glass-border)] w-full flex items-center justify-between">
                      <div className="flex flex-col items-start">
                         <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)]/50 tracking-tight">{t('common.status', 'Status')}</span>
                         <span className="text-[11px] lg:text-[12px]  font-semibold text-emerald-500 flex items-center gap-1.5">
                            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div> {t('common.active', 'Active')}
                         </span>
                      </div>
                      
                      <div className="size-9 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)] group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm">
                         <ArrowRight className="size-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-20 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function StoresDirectoryPage() {
  return (
    <Suspense fallback={null}>
      <StoresDirectoryContent />
    </Suspense>
  );
}
