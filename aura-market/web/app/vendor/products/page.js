"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Zap, Package, TrendingUp, AlertCircle, Eye } from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function VendorProductsPage() {
  const authTokenFromStore = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const pollingRef = useRef(null);

  const fetchProducts = async (token) => {
    setError(null);
    setLoading(true);
    try {
      // Use the token from Zustand store if present, otherwise rely on default API interceptor
      const res = await api.get('/vendors/products');

      if (res?.data?.success) {
        const prods = res.data.data?.products || res.data.data || [];
        setProducts(prods);
        setLoading(false);
        return true;
      }

      setError(res?.data?.message || 'Failed to load products');
      setLoading(false);
      return false;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        if (updateUser) updateUser({ onboarded: false });
        router.push('/onboarding');
        return false;
      }
      if (status === 401 || status === 403) {
        setError('Unauthorized. Please sign in.');
      } else {
        setError(err?.response?.data?.message || err.message || 'Fetch error');
      }
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    if (!user || user.role !== 'vendor' || !user.onboarded) return;

    // Prefer the auth token in the client store; api interceptor will attach token automatically.
    (async () => {
      if (!cancelled) await fetchProducts();
    })();

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authTokenFromStore, user]);


  if (!mounted) return null;
  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-fluid-lg lg:text-fluid-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Base <span className="text-[var(--accent)]">Inventory</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[8px] lg:text-[9px] font-black uppercase tracking-[0.3em] opacity-40"><span>{products.length}</span> Active Nodes</p>
        </div>

        <div className="flex items-center gap-3 lg:gap-4 self-end lg:self-auto w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-sm opacity-50">search</span>
            <input 
              className="w-full lg:w-64 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl py-2 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-30" 
              placeholder="Search Inventory..." 
            />
          </div>
          <Link href="/vendor/products/add" className="flex items-center gap-2 bg-[var(--accent)] hover:opacity-90 text-white font-black px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl shadow-lg shadow-[var(--accent)]/20 hover:-translate-y-0.5 transition-all text-[8px] lg:text-[10px] tracking-widest uppercase shrink-0">
            <span className="material-symbols-outlined text-sm">add</span>
            Deploy Node
          </Link>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-8 lg:space-y-12 pb-32">

          {error ? (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">Authentication / Authorization Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/login" className="text-sm font-black bg-red-600 text-white px-3 py-1 rounded">Sign In</Link>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="glass-panel rounded-2xl overflow-hidden animate-pulse border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                  <div className="aspect-square bg-[var(--bg-secondary)]" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-[var(--bg-secondary)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--bg-secondary)] rounded w-1/2" />
                    <div className="h-6 bg-[var(--bg-secondary)] rounded w-1/3 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-32 text-center">
              <div className="size-24 rounded-full bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-4xl text-[var(--text-secondary)]/40">inventory_2</span>
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2 uppercase tracking-widest">No Products Yet</h3>
              <p className="text-[var(--text-secondary)] mb-8 font-bold">Start by listing your first product on Aura Market.</p>
              <Link href="/vendor/products/add" className="flex items-center gap-2 bg-[var(--accent)] text-white font-black px-10 py-4 rounded-full shadow-lg shadow-[var(--accent)]/20 hover:scale-105 transition-all text-[10px] tracking-widest uppercase">
                <span className="material-symbols-outlined">add</span>
                List Your First Product
              </Link>
            </div>
          ) : (
            <>
              {/* Product KPIs Container */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <KPICard 
                   title="Total Portfolio" 
                   value={products.length} 
                   icon={Package} 
                   color="fuchsia" 
                   sub={`${products.filter(p => p.stock > 0).length} active`} 
                />
                <KPICard 
                   title="Depleted Nodes" 
                   value={products.filter(p => p.stock === 0).length} 
                   icon={AlertCircle} 
                   color={products.filter(p => p.stock === 0).length > 0 ? 'red' : 'emerald'} 
                   sub="Requires restock" 
                />
                <KPICard 
                   title="Net Purchases" 
                   value={products.reduce((acc, p) => acc + (p.purchase_count || 0), 0)} 
                   icon={ShoppingCart} 
                   color="emerald" 
                   sub="Market volume" 
                />
                <KPICard 
                   title="Impressions" 
                   value={products.reduce((acc, p) => acc + (p.view_count || 0), 0)} 
                   icon={Eye} 
                   color="blue" 
                   sub="Node exposure" 
                />
              </div>

              <div className="glass-panel rounded-[32px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-sm">
              <div className="p-8 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-primary)]/50">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">All Products</h3>
                <div className="flex gap-2">
                  <button className="bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] px-3 py-1 rounded-full font-black tracking-widest uppercase">ALL</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
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
                    {products.map((product) => {
                      const imgSrc = product.images?.[0]?.url || product.images?.[0] || null;
                      const isLowStock = product.stock < 10;
                      const isFeatured = product.featured;
                      return (
                        <tr key={product._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-xl bg-[var(--bg-secondary)] overflow-hidden flex-shrink-0 border border-[var(--glass-border)] shadow-sm">
                                {imgSrc ? (
                                  <img src={imgSrc} alt={product.name} className="size-full object-cover" />
                                ) : (
                                  <div className="size-full flex items-center justify-center text-[var(--accent)] font-black text-lg">{product.name?.[0]}</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{product.name}</p>
                                {isFeatured && (
                                  <span className="text-[10px] text-[var(--accent)] font-black flex items-center gap-1 uppercase tracking-widest mt-1 opacity-80"><span className="material-symbols-outlined text-xs">grade</span> Featured</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5"><span className="text-[10px] font-black px-3 py-1 rounded-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-[var(--text-secondary)] uppercase tracking-widest">{product.category || '—'}</span></td>
                          <td className="px-6 py-5 text-sm font-black text-[var(--text-primary)]">{product.price?.toLocaleString()} XAF</td>
                          <td className="px-6 py-5"><span className={`text-sm font-black ${isLowStock ? 'text-red-600' : 'text-emerald-600'}`}>{product.stock}</span>{isLowStock && <span className="ml-2 text-[10px] text-red-600 font-black uppercase tracking-widest">LOW</span>}</td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-secondary)]">
                              <span className="flex items-center gap-1.5"><ShoppingCart className="w-3 h-3 text-emerald-500" /> {product.purchase_count || 0} Sales</span>
                              <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-[var(--accent)]" /> {product.view_count || 0} Views</span>
                            </div>
                          </td>
                          <td className="px-6 py-5"><span className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[10px] font-black tracking-widest uppercase border ${product.stock > 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}><span className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />{product.stock > 0 ? 'Active' : 'Out of Stock'}</span></td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                              <Link href={`/products/${product._id}`} className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 transition-all shadow-sm" title="View"><span className="material-symbols-outlined text-[18px]">visibility</span></Link>
                              <Link href={`/vendor/products/edit/${product._id}`} className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all shadow-sm" title="Edit"><span className="material-symbols-outlined text-[18px]">edit</span></Link>
                              <button 
                                onClick={async () => {
                                  if (confirm('Decommission this asset node? This action is archived but irreversible from the public grid.')) {
                                    try {
                                      await api.delete(`/products/${product._id}`);
                                      setProducts(prev => prev.filter(p => p._id !== product._id));
                                    } catch (err) {
                                      alert('Decommissioning sequence failed.');
                                    }
                                  }
                                }}
                                className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all shadow-sm" title="Decommission"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
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


