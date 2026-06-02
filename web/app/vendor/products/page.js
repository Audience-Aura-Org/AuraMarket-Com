"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Package, AlertCircle, Eye, Search, Trash2, RefreshCw, ChevronRight, LayoutGrid, List } from 'lucide-react';
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

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) =>
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  }, [products, searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const activeCount = products.filter((p) => p.stock > 0).length;
  const lowStockCount = products.filter((p) => p.stock <= 5 && p.stock > 0).length;
  const soldUnits = products.reduce((acc, p) => acc + Number(p.purchase_count || 0), 0);
  const viewUnits = products.reduce((acc, p) => acc + Number(p.view_count || 0), 0);

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
    <main className="min-h-screen w-full bg-[var(--bg-secondary)] font-[Poppins] text-[var(--text-primary)]">
      <div className="sticky top-0 z-30 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur">
        <div className="w-full px-3 py-3 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Package className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Products</h1>
                  <p className="truncate text-[11px] text-[var(--text-secondary)]">{user.store_name || 'Vendor store'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchProducts}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] transition active:scale-95"
                  aria-label="Refresh products"
                >
                  <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/vendor/products/add"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-[11px] font-semibold text-white shadow-md shadow-[var(--accent)]/20 active:scale-95"
                >
                  Add product
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search products or category"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 pl-9 pr-3 text-[12px] outline-none transition focus:border-[var(--accent)]/45"
                />
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  <LayoutGrid className="size-3.5" />
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${viewMode === 'list' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  <List className="size-3.5" />
                  List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full space-y-4 px-3 py-4 pb-28 sm:px-5 sm:py-5 lg:px-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-red-500">
            <AlertCircle className="size-4 shrink-0" />
            <p className="text-[11px] font-medium">{error}</p>
          </div>
        )}

        <div className="flex w-full items-center divide-x divide-[var(--glass-border)] overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          <MetricItem label="Active" value={activeCount} />
          <MetricItem label="Low" value={lowStockCount} />
          <MetricItem label="Sold" value={soldUnits} />
          <MetricItem label="Views" value={viewUnits} />
        </div>

        <section className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2.5 sm:px-4">
            <p className="text-[12px] font-semibold">Product catalog</p>
            <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              {filteredProducts.length} items
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 p-3 sm:p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />
              ))}
            </div>
          ) : currentProducts.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {currentProducts.map((product) => (
                  <ManagementCard key={product._id} product={product} onDelete={handleDeleteProduct} />
                ))}
              </div>
            ) : (
              <div className="space-y-2 p-3 sm:p-4">
                {currentProducts.map((product) => (
                  <ListRow key={product._id} product={product} onDelete={handleDeleteProduct} />
                ))}
              </div>
            )
          ) : (
            <div className="py-16 text-center">
              <Package className="mx-auto mb-3 size-8 text-[var(--text-secondary)]/40" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">No products found.</p>
            </div>
          )}

          <div className="border-t border-[var(--glass-border)] px-3 py-3 sm:px-4">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricItem({ label, value }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5">
      <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
      <span className="text-[12px] font-semibold">{value}</span>
    </div>
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
    <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
      <Link href={`/vendor/products/edit/${product._id}`} className="block">
      <div className="relative aspect-[4/3] bg-[var(--bg-secondary)]">
        {product.images?.[0]?.url ? (
          <img src={product.images[0].url} alt={product.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--accent)]/20">
            <Package className="size-10" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 z-10 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium backdrop-blur">
          <span className={status.color}>
            {status.label}
          </span>
        </div>
      </div>
      </Link>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]">{product.category || 'General'}</p>
            <Link href={`/vendor/products/edit/${product._id}`} className="mt-0.5 block truncate text-[12px] font-semibold">
              {product.name}
            </Link>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(product._id); }}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white"
            aria-label="Delete product"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-2">
          <p className="text-[12px] font-semibold">{product.price?.toLocaleString()} XAF</p>
          <p className={`text-[11px] font-semibold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-emerald-500'}`}>
            Stock: {product.stock}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-medium text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1"><Eye className="size-3" />{product.view_count || 0}</span>
          <span className="inline-flex items-center gap-1"><Zap className="size-3" />{product.purchase_count || 0}</span>
        </div>
      </div>
    </div>
  );
}

function ListRow({ product, onDelete }) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= 5 && product.stock > 0;
  const status = isOutOfStock 
    ? { label: 'Sold Out', color: 'text-red-500', bg: 'bg-red-500/10' }
    : isLowStock 
       ? { label: 'Low Stock', color: 'text-amber-500', bg: 'bg-amber-500/10' }
       : { label: 'Active', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-2.5">
      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-secondary)]">
        {product.images?.[0]?.url ? (
          <img src={product.images[0].url} alt={product.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--accent)]/20">
            <Package className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold">{product.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-secondary)]">
          <span>{product.category || 'General'}</span>
          <span className={status.color}>{status.label}</span>
          <span>{product.price?.toLocaleString()} XAF</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1"><Eye className="size-3" />{product.view_count || 0}</span>
          <span className="inline-flex items-center gap-1"><Zap className="size-3" />{product.purchase_count || 0}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onDelete(product._id)}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white"
          aria-label="Delete product"
        >
          <Trash2 className="size-3.5" />
        </button>
        <Link
          href={`/vendor/products/edit/${product._id}`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:text-[var(--accent)]"
          aria-label="Edit product"
        >
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
