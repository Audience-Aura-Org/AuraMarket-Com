"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Zap, Package, TrendingUp, AlertCircle, Eye, Search, Trash2, RefreshCw, ChevronRight, Database, LayoutGrid, List } from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import StatCard from '@/components/layout/StatCard';

import Pagination from '@/components/common/Pagination';

export default function VendorProductsPage() {
  const authTokenFromStore = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const itemsPerPage = viewMode === 'grid' ? 12 : 20;

  const fetchProducts = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/vendors/products');
      if (res?.data?.success) {
        const prods = res.data.data?.products || res.data.data || [];
        setProducts(prods);
        setLoading(false);
        return;
      }
      setError(res?.data?.message || 'Failed to load products');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        if (updateUser) updateUser({ onboarded: false });
        router.push('/onboarding');
      } else {
        setError(err?.response?.data?.message || err.message || 'Fetch error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (!user || user.role !== 'vendor' || !user.onboarded) return;
    fetchProducts();
  }, [authTokenFromStore, user]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    try {
      const res = await api.delete(`/vendors/products/${id}`);
      if (res.data.success) {
        setProducts(products.filter(p => p._id !== id));
      }
    } catch (err) {
      setError('Deletion failed: ' + (err.response?.data?.message || err.message));
    }
  };

  if (!mounted) return null;
  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <>
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Package className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Product <span className="text-[var(--accent)]">Catalog</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase truncate max-w-[150px]">{user.store_name || 'STORE_ID'}</p>
              </div>
            </div>
          </div>
          <button onClick={fetchProducts} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text" 
                placeholder="Find Reference..." 
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
              />
           </div>
           <Link href="/vendor/products/add" className="flex shrink-0 px-4 md:px-6 h-11 rounded-xl bg-[var(--accent)] text-white text-[11px] font-bold tracking-tight items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20">
              New Asset Node
           </Link>
           <button onClick={fetchProducts} className="hidden md:flex size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-40">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
               <AlertCircle className="size-5" />
               <p className="text-xs  font-bold tracking-tight">System Interrupt: {error}</p>
            </div>
          )}
          {/* Operational Matrix */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatCard label="Active" value={products.filter(p => p.stock > 0).length} icon="inventory_2" color="fuchsia" sub="ACTIVE PRODUCTS" />
            <StatCard label="Attention" value={products.filter(p => p.stock <= 5 && p.stock > 0).length} icon="warning" color="rose" sub="LOW STOCK" />
            <StatCard label="Resolved" value={products.reduce((acc, p) => acc + (p.purchase_count || 0), 0)} icon="check_circle" color="emerald" sub="UNITS SOLD" />
            <StatCard label="Yield" value={products.reduce((acc, p) => acc + (p.view_count || 0), 0)} icon="bolt" color="indigo" sub="TOTAL VIEWS" />
          </div>

                {/* Inventory Ledger */}
                <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
                   <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                           <Database className="w-4 h-4 text-[var(--accent)]" /> 
                           Product Directory
                        </h3>
                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Real-time Product Status: {filteredProducts.length} items</p>
                      </div>

                      <div className="flex items-center gap-2 p-1 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl shadow-inner self-start md:self-auto">
                        <button 
                          onClick={() => setViewMode('grid')}
                          className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                        >
                          <LayoutGrid className="size-4" />
                        </button>
                        <button 
                          onClick={() => setViewMode('table')}
                          className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                        >
                          <List className="size-4" />
                        </button>
                      </div>
                   </div>

                   <div className="space-y-4">
                   {loading ? (
                      <div className="p-10 space-y-4">
                        {[1,2,3,4].map(i => (
                           <div key={i} className="h-24 rounded-[2rem] bg-[var(--bg-secondary)]/50 animate-pulse" />
                        ))}
                      </div>
                   ) : currentProducts.length > 0 ? (
                      viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6 md:p-10">
                           {currentProducts.map(product => (
                              <ManagementCard key={product._id} product={product} onDelete={handleDeleteProduct} />
                           ))}
                        </div>
                      ) : (
                        <div className="overflow-x-auto p-6 md:p-10">
                          <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                              <tr className="border-b border-[var(--glass-border)] text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-60">
                                <th className="pb-6 pr-4">Product</th>
                                <th className="pb-6 px-4">Category</th>
                                <th className="pb-6 px-4 text-center">Telemetry</th>
                                <th className="pb-6 px-4 text-center">Status</th>
                                <th className="pb-6 px-4 text-right">Valuation</th>
                                <th className="pb-6 pl-4 text-right">Trace</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                              {currentProducts.map(product => (
                                <TabularRow key={product._id} product={product} onDelete={handleDeleteProduct} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                   ) : (
                      <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                         <Database className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                         <p className="text-sm  font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No products found in this category.</p>
                      </div>
                   )}
                   </div>

                   <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
                      <Pagination 
                         currentPage={currentPage}
                         totalPages={totalPages}
                         onPageChange={setCurrentPage}
                      />
                   </div>
                </div>
      </div>
    </>
  );
}
function ManagementCard({ product, onDelete }) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= 5 && product.stock > 0;
  const status = isOutOfStock 
    ? { label: 'Sold Out', color: 'text-red-500', bg: 'bg-red-500/10' }
    : isLowStock 
       ? { label: 'Low Stock', color: 'text-amber-500', bg: 'bg-amber-500/10' }
       : { label: 'Active', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };

  return (
    <div className="group flex flex-col bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 glass-panel relative">
      <div className="relative aspect-[4/3] bg-[var(--bg-secondary)] overflow-hidden">
        {product.images?.[0]?.url ? (
          <img src={product.images[0].url} className="size-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110" />
        ) : (
          <div className="size-full flex items-center justify-center text-[var(--accent)] opacity-10">
            <Package className="size-16" />
          </div>
        )}
        <div className="absolute top-4 left-4 z-10">
          <span className={`text-[10px] font-medium tracking-wide ${status.color}`}>
            {status.label}
          </span>
        </div>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
           <button 
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(product._id); }}
             className="size-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
           >
              <Trash2 className="size-3.5" />
           </button>
        </div>
      </div>
      <Link href={`/vendor/products/edit/${product._id}`} className="p-6 space-y-4 flex-1 flex flex-col">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium capitalize tracking-wide text-[var(--text-secondary)] opacity-70">{product.category || 'General'}</p>
            <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
               <span className="flex items-center gap-1"><Eye className="size-2.5" /> {product.view_count || 0}</span>
               <span className="flex items-center gap-1"><Zap className="size-2.5" /> {product.purchase_count || 0}</span>
            </div>
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{product.name}</h4>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-4">
           <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-65">Price</p>
              <p className="text-sm font-bold text-[var(--text-primary)] font-mono">{product.price?.toLocaleString()} <span className="text-[10px] opacity-30">XAF</span></p>
           </div>
           <div className="text-right space-y-0.5">
              <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-65">In stock</p>
              <p className={`text-sm font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>{product.stock}</p>
           </div>
        </div>
      </Link>
    </div>
  );
}

function TabularRow({ product, onDelete }) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= 5 && product.stock > 0;
  const status = isOutOfStock 
    ? { label: 'Sold Out', color: 'text-red-500', bg: 'bg-red-500/10' }
    : isLowStock 
       ? { label: 'Low Stock', color: 'text-amber-500', bg: 'bg-amber-500/10' }
       : { label: 'Active', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };

  return (
    <tr className="group hover:bg-[var(--accent)]/[0.02] transition-all">
      <td className="py-5 pr-4">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] overflow-hidden flex items-center justify-center shrink-0">
            {product.images?.[0]?.url ? (
              <img src={product.images[0].url} className="size-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
            ) : (
              <Package className="size-5 text-[var(--accent)] opacity-20" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{product.name}</p>
            <p className="text-[10px] font-mono text-[var(--text-secondary)] opacity-30 uppercase">#{product._id.slice(-8)}</p>
          </div>
        </div>
      </td>
      <td className="py-5 px-4">
        <span className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)]/80 px-2 py-0.5 text-[10px] font-medium capitalize tracking-wide text-[var(--text-secondary)] opacity-75">
          {product.category || 'General'}
        </span>
      </td>
      <td className="py-5 px-4 text-center">
        <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
          <span className="flex items-center gap-1.5"><Eye className="size-3" /> {product.view_count || 0}</span>
          <span className="flex items-center gap-1.5"><Zap className="size-3" /> {product.purchase_count || 0}</span>
        </div>
      </td>
      <td className="py-5 px-4 text-center">
        <span className={`text-[10px] font-medium capitalize tracking-wide ${status.color}`}>
          {status.label}
        </span>
      </td>
      <td className="py-5 px-4 text-right">
        <p className="text-sm font-bold text-[var(--text-primary)] font-mono">{product.price?.toLocaleString()}</p>
      </td>
      <td className="py-5 pl-4 text-right">
        <div className="flex items-center justify-end gap-2">
           <button 
             onClick={() => onDelete(product._id)}
             className="inline-flex size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all active:scale-90"
           >
              <Trash2 className="size-4" />
           </button>
           <Link 
             href={`/vendor/products/edit/${product._id}`}
             className="inline-flex size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] items-center justify-center text-[var(--text-secondary)] opacity-20 group-hover:opacity-100 hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all active:scale-90"
           >
             <ChevronRight className="size-4" />
           </Link>
        </div>
      </td>
    </tr>
  );
}
