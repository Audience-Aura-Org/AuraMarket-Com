"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Zap, Package, TrendingUp, AlertCircle, Eye, Search, Trash2 } from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

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
  const itemsPerPage = viewMode === 'grid' ? 8 : 15;

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

  if (!mounted) return null;
  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-fluid-lg lg:text-fluid-xl font-bold text-[var(--text-primary)] tracking-tight ">Product <span className="text-[var(--accent)]">Hub</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[10px] lg:text-[12px] lg:text-[11px] lg:text-[12px] font-bold  tracking-[0.3em] opacity-40"><span>{products.length}</span> Active Listings</p>
        </div>

        <div className="flex items-center gap-3 lg:gap-5 self-end lg:self-auto w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">
              <Search className="size-4" />
            </div>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full lg:w-80 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl py-3 pl-11 pr-4 text-[11px] lg:text-[12px] font-bold tracking-tight outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-30 text-[var(--text-primary)] shadow-sm" 
              placeholder="Filter by name or category..." 
            />
          </div>
          <Link href="/vendor/products/add" className="flex items-center gap-2 bg-[var(--accent)] hover:opacity-90 text-white font-bold px-5 lg:px-8 py-3 lg:py-3.5 rounded-2xl shadow-xl shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all text-[10px] lg:text-[12px] lg:text-[11px] lg:text-[12px] tracking-tight  shrink-0">
            <Zap className="size-4" />
            New Listing
          </Link>
        </div>
      </header>

      <div className="p-6 lg:p-10 pt-12 lg:pt-20 space-y-12 lg:space-y-16 pb-32">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
               <AlertCircle className="size-5" />
               <p className="text-xs font-bold tracking-tight">Error: {error}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="rounded-3xl overflow-hidden animate-pulse border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 h-[420px]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-32 text-center max-w-md mx-auto">
              <div className="size-24 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center mb-8 shadow-inner group">
                <Package className="size-10 text-[var(--text-secondary)] opacity-20 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3  tracking-tighter">Your Store is Empty</h3>
              <p className="text-[var(--text-secondary)] mb-10 font-medium text-sm tracking-tight opacity-60">Ready to start selling on Aura? Deploy your first product listing and reach thousands of buyers instantly.</p>
              <Link href="/vendor/products/add" className="flex items-center gap-3 bg-[var(--accent)] text-white font-bold px-10 py-4.5 rounded-2xl shadow-2xl shadow-[var(--accent)]/30 hover:scale-[1.02] transition-all text-[11px] lg:text-[12px] tracking-[0.2em] ">
                <Zap className="size-4" />
                List Your First Item
              </Link>
            </div>
          ) : (
            <>
              {/* Product KPIs Container */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <KPICard title="Total Items" value={products.length} icon={Package} color="fuchsia" sub={`${products.filter(p => p.stock > 0).length} in stock`} />
                <KPICard title="Low Stock" value={products.filter(p => p.stock <= 5 && p.stock > 0).length} icon={AlertCircle} color={products.filter(p => p.stock <= 5 && p.stock > 0).length > 0 ? 'red' : 'emerald'} sub="Restock alerts" />
                <KPICard title="Market Orders" value={products.reduce((acc, p) => acc + (p.purchase_count || 0), 0)} icon={ShoppingCart} color="emerald" sub="Sales volume" />
                <KPICard title="Discovery Hits" value={products.reduce((acc, p) => acc + (p.view_count || 0), 0)} icon={Eye} color="blue" sub="Traffic exposure" />
              </div>

                <div className="space-y-10">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold text-[var(--text-primary)]  tracking-tighter">
                        Inventory <span className="text-[var(--accent)]">{viewMode === 'grid' ? 'Grid' : 'Table'}</span>
                      </h3>
                      <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)]  tracking-[0.2em] opacity-40">Managing {filteredProducts.length} filtered items</p>
                    </div>
                    <div className="flex items-center gap-3 p-1.5 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl shadow-inner">
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={`px-5 py-2 rounded-xl text-[11px] lg:text-[12px] font-bold tracking-tight transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-50 hover:opacity-100'}`}
                      >
                        Grid
                      </button>
                      <button 
                        onClick={() => setViewMode('table')}
                        className={`px-5 py-2 rounded-xl text-[11px] lg:text-[12px] font-bold tracking-tight transition-all ${viewMode === 'table' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-50 hover:opacity-100'}`}
                      >
                        Table
                      </button>
                    </div>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="py-20 text-center glass-panel rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                      <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)]  tracking-[0.3em] opacity-30">No matches found for "{searchTerm}"</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                      {currentProducts.map((product) => (
                        <ManagementCard 
                          key={product._id} 
                          product={product} 
                          onDelete={() => setProducts(prev => prev.filter(p => p._id !== product._id))}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[11px] lg:text-[12px] font-bold tracking-[0.3em] text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 border-b border-[var(--glass-border)] ">
                              <th className="pl-10 pr-6 py-6">Product Item</th>
                              <th className="px-6 py-6">Category</th>
                              <th className="px-6 py-6 text-right">Price</th>
                              <th className="px-6 py-6 text-center">Stock</th>
                              <th className="px-6 py-6 text-center">Hits</th>
                              <th className="px-6 py-6">Status</th>
                              <th className="pl-6 pr-10 py-6 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--glass-border)]">
                            {currentProducts.map((product) => {
                              const imgSrc = product.images?.[0]?.url || product.images?.[0] || null;
                              const isOutOfStock = product.stock <= 0;
                              const isLowStock = product.stock <= 5 && product.stock > 0;
                              return (
                                <tr key={product._id} className="group hover:bg-[var(--accent)]/[0.03] transition-colors">
                                  <td className="pl-10 pr-6 py-5">
                                    <div className="flex items-center gap-4">
                                      <div className="size-14 rounded-2xl bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)] shadow-inner flex-shrink-0">
                                        {imgSrc ? (
                                          <img src={imgSrc} alt={product.name} className="size-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                          <div className="size-full flex items-center justify-center text-[var(--accent)] font-bold text-xl  tracking-tighter opacity-20">
                                            {product.name?.[0]}
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-[var(--text-primary)] truncate tracking-tight">{product.name}</p>
                                        <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight mt-0.5">ID: {product._id?.slice(-6)}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5">
                                    <span className="inline-flex px-3 py-1.5 rounded-full bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)]  tracking-[0.1em]">
                                      {product.category || 'General'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-5 text-right text-sm font-bold text-[var(--text-primary)] font-mono">
                                    {product.price?.toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-40">XAF</span>
                                  </td>
                                  <td className="px-6 py-5 text-center">
                                    <span className={`text-sm font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
                                      {product.stock}
                                    </span>
                                  </td>
                                  <td className="px-6 py-5 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)] opacity-40">
                                        <Eye className="size-3" />
                                        <span className="text-[11px] lg:text-[12px] font-bold">{product.view_count || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-emerald-500">
                                        <ShoppingCart className="size-3" />
                                        <span className="text-[11px] lg:text-[12px] font-bold">{product.purchase_count || 0}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5">
                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] lg:text-[12px] font-bold tracking-tight border ${
                                      isOutOfStock ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                      isLowStock ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    }`}>
                                      <span className={`size-1.5 rounded-full animate-pulse ${isOutOfStock ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : isLowStock ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                                      {isOutOfStock ? 'Sold Out' : isLowStock ? 'Low Stock' : 'Active'}
                                    </div>
                                  </td>
                                  <td className="pl-6 pr-10 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2.5">
                                      <Link href={`/products/${product._id}`} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all hover:scale-105 shadow-sm">
                                        <Eye className="size-4" />
                                      </Link>
                                      <Link href={`/vendor/products/edit/${product._id}`} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] flex items-center justify-center transition-all hover:scale-105 shadow-sm">
                                        <TrendingUp className="size-4" />
                                      </Link>
                                      <button 
                                        onClick={async () => {
                                          if (confirm('Delete this listing?')) {
                                            try {
                                              await api.delete(`/products/${product._id}`);
                                              setProducts(prev => prev.filter(p => p._id !== product._id));
                                            } catch (err) {
                                              alert('Action failed');
                                            }
                                          }
                                        }}
                                        className="size-10 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all hover:scale-105 shadow-sm"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                
                {totalPages > 1 && (
                  <div className="pt-10">
                    <Pagination 
                      currentPage={currentPage} 
                      totalPages={totalPages} 
                      onPageChange={setCurrentPage} 
                    />
                  </div>
                )}
              </div>
            </>
          )}
      </div>
    </>
  );
}

function ManagementCard({ product, onDelete }) {
  const imgSrc = product.images?.[0]?.url || product.images?.[0] || null;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= 5 && product.stock > 0;

  return (
    <div className="group relative flex flex-col bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 glass-panel">
      {/* Media Wrapper */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-secondary)]">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--accent)]/20 font-bold text-6xl select-none  tracking-tighter">
            {product.name?.[0]}
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className={`px-3 py-1.5 rounded-full text-[11px] lg:text-[12px] font-bold tracking-tight backdrop-blur-md border shadow-lg flex items-center gap-1.5 ${
            isOutOfStock 
              ? 'bg-red-500/20 text-red-500 border-red-500/30' 
              : isLowStock 
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
          }`}>
            <span className={`size-1.5 rounded-full ${isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse shadow-[0_0_8px_currentColor]`} />
            {isOutOfStock ? 'Sold Out' : isLowStock ? `Low: ${product.stock}` : 'Active'}
          </div>
        </div>

        {/* Quick View Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 z-20">
           <Link href={`/products/${product._id}`} className="size-12 rounded-2xl bg-white text-black flex items-center justify-center hover:scale-110 transition-all shadow-xl">
             <Eye className="size-5" />
           </Link>
           <Link href={`/vendor/products/edit/${product._id}`} className="size-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center hover:scale-110 transition-all shadow-xl">
             <TrendingUp className="size-5" />
           </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1 gap-4">
        <div className="space-y-1">
          <p className="text-[11px] lg:text-[12px] font-bold text-[var(--accent)] tracking-tight opacity-60 leading-none">{product.category || 'General'}</p>
          <h3 className="text-[16px] font-bold text-[var(--text-primary)] truncate tracking-tight leading-tight">{product.name}</h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-tight opacity-30">Unit Price</p>
            <p className="text-sm font-bold text-[var(--text-primary)] font-mono">{product.price?.toLocaleString()} XAF</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-tight opacity-30">Stock Level</p>
            <p className={`text-sm font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>{product.stock}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="pt-4 border-t border-[var(--glass-border)] grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShoppingCart className="size-4" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--text-primary)] leading-none">{product.purchase_count || 0}</p>
              <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)]  opacity-40 mt-1">Sales</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Eye className="size-4" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--text-primary)] leading-none">{product.view_count || 0}</p>
              <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)]  opacity-40 mt-1">Hits</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-2">
          <Link href={`/vendor/products/edit/${product._id}`} className="flex-1 h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-xl flex items-center justify-center gap-2 text-[11px] lg:text-[12px] font-bold tracking-tight hover:border-[var(--accent)]/40 transition-all">
            Manage
          </Link>
          <button 
            onClick={async () => {
              if (confirm('Remove this listing from the market?')) {
                try {
                  await api.delete(`/products/${product._id}`);
                  onDelete();
                } catch (err) {
                  alert('Action failed');
                }
              }
            }}
            className="size-11 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color, sub }) {
  const colorMap = {
    fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    blue:    'bg-indigo-500/10 text-indigo-500',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber:   'bg-amber-500/10 text-amber-500',
    red:     'bg-red-500/10 text-red-500',
  };

  return (
    <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[2rem] p-6 lg:p-7 group hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden glass-panel shadow-sm w-full">
      <div className={`absolute -right-4 -top-4 w-16 lg:w-24 h-16 lg:h-24 rounded-full blur-3xl opacity-30 ${colorMap[color]?.split(' ')[0]}`} />
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorMap[color]} shadow-inner`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[var(--text-secondary)] text-[11px] lg:text-[12px] font-bold tracking-[0.2em]  opacity-50">{title}</p>
        <h3 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)] mt-1.5 truncate tracking-tighter">{value}</h3>
        {sub && <p className="text-[11px] lg:text-[12px] text-[var(--text-secondary)] font-bold mt-1 opacity-50 tracking-tight truncate">{sub}</p>}
      </div>
    </div>
  );
}


