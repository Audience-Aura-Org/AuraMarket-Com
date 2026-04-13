"use client";

import { useState, useEffect } from 'react';
import { Package, ShieldCheck, Box, Search, Loader2, Ban, Eye, Building2, MoreVertical, Star, CheckCircle } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';
import Link from 'next/link';

import Pagination from '@/components/common/Pagination';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    fetchProducts();
    setCurrentPage(1);
  }, [statusFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/products?status=${statusFilter === 'all' ? '' : statusFilter}`);
      if (res.data?.success) setProducts(res.data.data.products || []);
    } catch (err) {
      toast.error('Failed to sync with global asset pool');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (productId, status) => {
    try {
      const res = await api.patch(`/admin/products/${productId}/review`, { status });
      if (res.data.success) {
        toast.success(`Asset status shift complete.`);
        setProducts(prev => prev.map(p => p._id === productId ? { ...p, status: status === 'active' ? 'active' : 'archived' } : p));
      }
    } catch (err) {
      toast.error('Asset status change failed');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.vendor_id?.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-6 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] backdrop-blur-xl shrink-0 z-10 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Global <span className="text-[var(--accent)]">Assets</span></h2>
            <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
              <Search className="size-4 text-[var(--text-secondary)] opacity-40" />
              <input 
                type="text" 
                placeholder="Find node by name or vendor..." 
                className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-64 placeholder:opacity-40"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
             <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--glass-border)]">
                {['all', 'active', 'pending', 'archived'].map((s) => (
                  <button 
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/5'}`}
                  >
                    {s}
                  </button>
                ))}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
        {/* Mobile Search */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
          <Search className="size-4 text-[var(--text-secondary)] opacity-40" />
          <input 
            type="text" 
            placeholder="Search assets..." 
            className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-full placeholder:opacity-40"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {loading ? (
           <div className="py-20 flex flex-col items-center justify-center opacity-40">
              <Loader2 className="size-12 lg:size-16 animate-spin text-[var(--accent)] mb-6 shadow-xl" />
              <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.5em]">Extracting asset data...</p>
           </div>
        ) : (
           <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 min-h-[600px]">
                {currentProducts.map(p => (
                  <div key={p._id} className="p-6 lg:p-8 glass-panel border border-[var(--glass-border)] hover:border-[var(--accent)]/40 rounded-[32px] lg:rounded-[48px] bg-[var(--bg-primary)]/50 group transition-all flex flex-col h-fit relative overflow-hidden shadow-sm hover:shadow-xl shrink-0">
                    <div className="aspect-[1.5] lg:aspect-[1.6] rounded-[24px] lg:rounded-[32px] overflow-hidden border border-[var(--glass-border)] mb-6 lg:mb-8 bg-[var(--bg-secondary)]/50 relative shadow-inner shrink-0">
                       <img src={p.images?.[0]?.url || '/placeholder.png'} className="size-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="" />
                       <div className="absolute top-3 right-3 lg:top-4 lg:right-4 flex gap-2">
                          <span className={`px-3 lg:px-4 py-1 lg:py-1.5 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest border backdrop-blur-md shadow-2xl ${p.status === 'active' ? 'bg-emerald-500/80 text-white border-emerald-400' : p.status === 'pending' ? 'bg-amber-500/80 text-white border-amber-400' : 'bg-rose-500/80 text-white border-rose-400'}`}>
                             {p.status}
                          </span>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                       <div className="flex items-center justify-between mb-2">
                          <h4 className="text-base lg:text-xl font-black tracking-tight uppercase group-hover:text-[var(--accent)] transition-colors truncate">{p.name}</h4>
                          <Link href={`/p/${p._id}`} className="size-9 lg:size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[var(--accent)] transition-all shrink-0">
                             <Eye className="size-4 lg:size-5" />
                          </Link>
                       </div>
                       
                       <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-[var(--accent)] mb-4 lg:mb-6 flex items-center gap-2 opacity-70">
                          <Building2 className="size-3 lg:size-3.5" /> {p.vendor_id?.store_name}
                       </p>

                       <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-6 lg:mb-8">
                          <div className="p-3 lg:p-4 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-center shadow-inner">
                             <p className="text-[7px] lg:text-[8px] font-black text-[var(--text-secondary)] tracking-widest mb-1 opacity-40 uppercase">Price Node</p>
                             <p className="text-xs lg:text-sm font-black text-[var(--text-primary)]">{p.price?.toLocaleString()} <span className="text-[8px] opacity-40">XAF</span></p>
                          </div>
                          <div className="p-3 lg:p-4 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-center shadow-inner">
                             <p className="text-[7px] lg:text-[8px] font-black text-[var(--text-secondary)] tracking-widest mb-1 opacity-40 uppercase">Rating Node</p>
                             <div className="flex items-center justify-center gap-1">
                                <Star className="size-2.5 lg:size-3 text-amber-500 fill-amber-500" />
                                <span className="text-[9px] lg:text-[10px] font-black">{p.rating || '0.0'}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex gap-3 lg:gap-4 pt-4 lg:pt-6 border-t border-[var(--glass-border)]/50">
                       {p.status !== 'active' ? (
                          <button 
                            onClick={() => handleStatusUpdate(p._id, 'active')}
                            className="flex-1 h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black text-[8px] lg:text-[9px] tracking-widest uppercase hover:bg-emerald-500 hover:text-white transition-all shadow-xl shadow-emerald-500/5 flex items-center justify-center gap-2"
                          >
                             <CheckCircle className="size-4" />
                             Authorize Asset
                          </button>
                       ) : (
                          <button 
                            onClick={() => handleStatusUpdate(p._id, 'rejected')}
                            className="flex-1 h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-[8px] lg:text-[9px] tracking-widest uppercase hover:bg-rose-500 hover:text-white transition-all shadow-xl shadow-rose-500/5 flex items-center justify-center gap-2"
                          >
                             <Ban className="size-4" />
                             Suspend Asset
                          </button>
                       )}
                       <button className="size-12 lg:size-14 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all shadow-sm">
                          <MoreVertical className="size-5" />
                       </button>
                    </div>
                  </div>
                ))}
            </div>

            <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

              {filteredProducts.length === 0 && (
                 <div className="col-span-full py-32 lg:py-40 text-center opacity-30">
                    <Package className="size-16 lg:size-20 mx-auto mb-6 opacity-10" />
                    <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.5em]">No synchronization nodes found</p>
                 </div>
              )}
           </div>
        )}
          </div>
        </div>
      </div>
  );
}

