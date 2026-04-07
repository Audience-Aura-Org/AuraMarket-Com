"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Zap, Package, TrendingUp, AlertCircle, Eye } from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

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
  const itemsPerPage = 8;

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

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const currentProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!mounted) return null;
  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-fluid-lg lg:text-fluid-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Product <span className="text-[var(--accent)]">List</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[8px] lg:text-[9px] font-black uppercase tracking-[0.3em] opacity-40"><span>{products.length}</span> Live Items</p>
        </div>

        <div className="flex items-center gap-3 lg:gap-4 self-end lg:self-auto w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-sm opacity-50">search</span>
            <input 
              className="w-full lg:w-64 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl py-2 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-30 text-[var(--text-primary)]" 
              placeholder="Search Inventory..." 
            />
          </div>
          <Link href="/vendor/products/add" className="flex items-center gap-2 bg-[var(--accent)] hover:opacity-90 text-white font-black px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl shadow-lg shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all text-[8px] lg:text-[10px] tracking-widest uppercase shrink-0">
            <span className="material-symbols-outlined text-sm">add</span>
            Add Product
          </Link>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-8 lg:space-y-12 pb-32">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
               <p className="font-bold">Error: {error}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="glass-panel rounded-2xl overflow-hidden animate-pulse border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 h-80" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-32 text-center">
              <div className="size-24 rounded-full bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-4xl text-[var(--text-secondary)]/40">inventory_2</span>
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2 uppercase tracking-widest">No Products Yet</h3>
              <p className="text-[var(--text-secondary)] mb-8 font-bold text-sm tracking-tight">Start by listing your first product on Aura Market.</p>
              <Link href="/vendor/products/add" className="flex items-center gap-2 bg-[var(--accent)] text-white font-black px-10 py-4 rounded-full shadow-lg shadow-[var(--accent)]/20 hover:scale-105 transition-all text-[10px] tracking-widest uppercase">
                <span className="material-symbols-outlined">add</span>
                List Your First Product
              </Link>
            </div>
          ) : (
            <>
              {/* Product KPIs Container */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <KPICard title="Total Items" value={products.length} icon={Package} color="fuchsia" sub={`${products.filter(p => p.stock > 0).length} active`} />
                <KPICard title="Low Stock items" value={products.filter(p => p.stock <= 5).length} icon={AlertCircle} color={products.filter(p => p.stock <= 5).length > 0 ? 'red' : 'emerald'} sub="Requires restock" />
                <KPICard title="Net Purchases" value={products.reduce((acc, p) => acc + (p.purchase_count || 0), 0)} icon={ShoppingCart} color="emerald" sub="Market volume" />
                <KPICard title="Impressions" value={products.reduce((acc, p) => acc + (p.view_count || 0), 0)} icon={Eye} color="blue" sub="Item exposure" />
              </div>

              <div className="glass-panel rounded-[32px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-sm">
                <div className="p-8 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-primary)]/50">
                  <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase underline decoration-[var(--accent)]/30 underline-offset-8">All Products</h3>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead>
                    <tr className="text-[10px] tracking-widest text-[var(--text-secondary)] bg-[var(--bg-secondary)]/30 border-b border-[var(--glass-border)] uppercase">
                      <th className="px-8 py-4 font-black">Product</th>
                      <th className="px-6 py-4 font-black">Category</th>
                      <th className="px-6 py-4 font-black">Price</th>
                      <th className="px-6 py-4 font-black">Stock</th>
                      <th className="px-6 py-4 font-black">Metrics</th>
                      <th className="px-6 py-4 font-black">Status</th>
                      <th className="px-8 py-4 font-black text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {currentProducts.map((product) => {
                      const imgSrc = product.images?.[0]?.url || product.images?.[0] || null;
                      const isLowStock = product.stock <= 5;
                      return (
                        <tr key={product._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-xl bg-[var(--bg-secondary)] overflow-hidden flex-shrink-0 border border-[var(--glass-border)] shadow-sm">
                                {imgSrc ? <img src={imgSrc} alt={product.name} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center text-[var(--accent)] font-black text-lg">{product.name?.[0]}</div>}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[var(--text-primary)] truncate uppercase">{product.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5"><span className="text-[10px] font-black px-3 py-1 rounded-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-[var(--text-secondary)] uppercase tracking-widest">{product.category || '—'}</span></td>
                          <td className="px-6 py-5 text-sm font-black text-[var(--text-primary)] font-mono">{product.price?.toLocaleString()} XAF</td>
                          <td className="px-6 py-5"><span className={`text-sm font-black ${isLowStock ? 'text-red-500' : 'text-emerald-500'}`}>{product.stock}</span></td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-secondary)]">
                              <span className="flex items-center gap-1.5"><ShoppingCart className="w-3 h-3 text-emerald-500" /> {product.purchase_count || 0}</span>
                              <span className="flex items-center gap-1.5"><Eye className="w-3 h-3 text-[var(--accent)]" /> {product.view_count || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5"><span className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[10px] font-black tracking-widest uppercase border ${product.stock > 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}><span className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />{product.stock > 0 ? 'Active' : 'Out of Stock'}</span></td>
                          <td className="px-8 py-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/products/${product._id}`} className="size-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all"><Eye className="size-4" /></Link>
                              <Link href={`/vendor/products/edit/${product._id}`} className="size-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] flex items-center justify-center transition-all"><span className="material-symbols-outlined text-[16px]">edit</span></Link>
                              <button 
                                onClick={async () => {
                                  if (confirm('Remove this product?')) {
                                    try {
                                      await api.delete(`/products/${product._id}`);
                                      setProducts(prev => prev.filter(p => p._id !== product._id));
                                    } catch (err) {
                                      alert('Removal failed.');
                                    }
                                  }
                                }}
                                className="size-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>
            </>
          )}
      </div>
    </>
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
    <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[24px] lg:rounded-3xl p-4 lg:p-6 group hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden glass-panel shadow-sm w-full">
      <div className={`absolute -right-4 -top-4 w-16 lg:w-24 h-16 lg:h-24 rounded-full blur-2xl opacity-50 ${colorMap[color]?.split(' ')[0]}`} />
      <div className="flex justify-between items-start mb-3 lg:mb-4 relative z-10">
        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[var(--text-secondary)] text-[7px] lg:text-[10px] font-black tracking-[0.2em] uppercase opacity-50">{title}</p>
        <h3 className="text-fluid-base lg:text-fluid-xl font-bold text-[var(--text-primary)] mt-1 truncate">{value}</h3>
        {sub && <p className="text-[7px] lg:text-[11px] text-[var(--text-secondary)] font-bold mt-1 opacity-50 uppercase tracking-tighter truncate">{sub}</p>}
      </div>
    </div>
  );
}


