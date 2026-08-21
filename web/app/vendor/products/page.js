"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Package, AlertCircle, Eye, Search, Trash2, RefreshCw, ChevronRight, LayoutGrid, List, Pencil, Tag, SlidersHorizontal, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import Pagination from '@/components/common/Pagination';
import { useLanguage } from '@/context/LanguageContext';
import StatCard from '@/components/layout/StatCard';

export default function VendorProductsPage() {
  const { t } = useLanguage();
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
  const [viewMode, setViewMode] = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('productsView')) || 'grid'
  );
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const itemsPerPage = viewMode === 'grid' ? 12 : 20;

  const fetchProducts = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/vendor/products');
      if (res?.data?.success) {
        const prods = res.data.data?.products || res.data.data || [];
        setProducts(prods);
        setLoading(false);
        return;
      }
      setError(res?.data?.message || t('products.loadFailed', 'Failed to load products'));
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        if (updateUser) updateUser({ onboarded: false });
        router.push('/onboarding');
      } else {
        setError(err?.response?.data?.message || err.message || t('products.fetchError', 'Fetch error'));
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
    let list = products.filter((p) =>
      !query ||
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
    if (stockFilter === 'in_stock') list = list.filter((p) => p.stock > 5);
    else if (stockFilter === 'low_stock') list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (stockFilter === 'out_of_stock') list = list.filter((p) => p.stock <= 0);
    if (sortBy === 'price_asc') list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sortBy === 'price_desc') list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else if (sortBy === 'stock') list = [...list].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    else list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list;
  }, [products, searchTerm, stockFilter, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  // Meals don't track stock — consider them "in stock" when status is active.
  // Variant products track stock per-variant; sum the variants for accurate counts.
  const activeCount = products.filter((p) => {
    if (p.is_meal || p.meal) return p.status === 'active';
    if (p.has_variants && p.sku_variants?.length)
      return p.sku_variants.some((v) => (v.stock || 0) > 0);
    return (p.stock || 0) > 0;
  }).length;

  const lowStockCount = products.filter((p) => {
    if (p.is_meal || p.meal) return false; // no stock concept for meals
    if (p.has_variants && p.sku_variants?.length) {
      const variantTotal = p.sku_variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      return variantTotal > 0 && variantTotal <= 5;
    }
    return (p.stock || 0) > 0 && (p.stock || 0) <= 5;
  }).length;

  const onSaleCount = products.filter((p) => {
    // Top-level sale price
    if (p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price)) return true;
    // Variant-level sale price
    if (p.has_variants && p.sku_variants?.length)
      return p.sku_variants.some(v => v.sale_price != null && Number(v.sale_price) > 0 && Number(v.sale_price) < Number(v.price));
    return false;
  }).length;

  const handleDeleteProduct = async (id) => {
    if (!window.confirm(t('products.deleteConfirm', 'Are you sure you want to delete this product? This action cannot be undone.'))) return;
    try {
      const res = await api.delete(`/products/${id}`);
      if (res.data.success) {
        setProducts(products.filter(p => p._id !== id));
      }
    } catch (err) {
      setError(`${t('products.deletionFailed', 'Deletion failed:')} ${err.response?.data?.message || err.message}`);
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
                  <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{t('products.title', 'Products')}</h1>
                  <p className="truncate text-[11px] text-[var(--text-secondary)]">{user?.branding?.store_name || t('products.vendorStore', 'Vendor store')}</p>
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
                  {t('products.addProduct', 'Add product')}
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder={t('products.searchPlaceholder', 'Search products or category')}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="h-9 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 pl-8 pr-3 text-[11px] placeholder:text-[11px] placeholder:font-normal placeholder:opacity-70 outline-none transition-all focus:border-[var(--accent)]/50 focus:bg-[var(--bg-primary)]/80 focus:ring-1 focus:ring-[var(--accent)]/20"
                  />
                </div>
                <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-1">
                  <button
                    onClick={() => { setViewMode('grid'); localStorage.setItem('productsView', 'grid'); }}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                  >
                    <LayoutGrid className="size-3.5" />
                    {t('products.grid', 'Grid')}
                  </button>
                  <button
                    onClick={() => { setViewMode('list'); localStorage.setItem('productsView', 'list'); }}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${viewMode === 'list' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                  >
                    <List className="size-3.5" />
                    {t('products.list', 'List')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'in_stock', label: 'In Stock' },
                  { key: 'low_stock', label: 'Low Stock' },
                  { key: 'out_of_stock', label: 'Out of Stock' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setStockFilter(key); setCurrentPage(1); }}
                    className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-medium transition ${stockFilter === key ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
                  >
                    {label}
                  </button>
                ))}
                <div className="ml-auto shrink-0">
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                    className="h-7 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-2 text-[10px] text-[var(--text-secondary)] outline-none"
                  >
                    <option value="name">A–Z</option>
                    <option value="price_asc">Price ↑</option>
                    <option value="price_desc">Price ↓</option>
                    <option value="stock">Stock</option>
                  </select>
                </div>
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

        {(() => {
          const total      = products.length || 1;
          const activePct  = Math.round((activeCount    / total) * 100);
          const lowPct     = Math.round((lowStockCount  / total) * 100);
          const salePct    = Math.round((onSaleCount    / total) * 100);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label={t('products.total', 'Total')}    value={String(products.length)} icon="inventory_2"  color="indigo"  sub="Products"   progress={100}     footer={`${products.length} in catalog`} />
              <StatCard label={t('products.active', 'Active')}  value={String(activeCount)}     icon="check_circle" color="emerald" sub="In stock"    progress={activePct} footer={`${activePct}% active`} />
              <StatCard label={t('products.low', 'Low Stock')}  value={String(lowStockCount)}   icon="warning"      color="amber"   sub="≤ 5 units"  progress={lowPct}    footer={lowStockCount > 0 ? `${lowStockCount} need restock` : 'Stock healthy'} />
              <StatCard label={t('products.onSale', 'On Sale')} value={String(onSaleCount)}     icon="sell"         color="primary" sub="Discounted"  progress={salePct}   footer={`${salePct}% on sale`} />
            </div>
          );
        })()}

        <section className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2.5 sm:px-4">
            <p className="text-[12px] font-semibold">{t('products.productCatalog', 'Product catalog')}</p>
            <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              {filteredProducts.length} {t('products.items', 'items')}
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
                  <ManagementCard key={product._id} product={product} onDelete={handleDeleteProduct} t={t} />
                ))}
              </div>
            ) : (
              <div className="space-y-2 p-3 sm:p-4">
                {currentProducts.map((product) => (
                  <ListRow key={product._id} product={product} onDelete={handleDeleteProduct} t={t} />
                ))}
              </div>
            )
          ) : (
            <div className="py-16 text-center">
              <Package className="mx-auto mb-3 size-8 text-[var(--text-secondary)]/40" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">{t('products.noProductsFound', 'No products found.')}</p>
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


function getProductImageUrl(product) {
  const firstImage = product?.images?.[0];
  if (!firstImage) return '';
  return typeof firstImage === 'string' ? firstImage : firstImage.url || firstImage.location || '';
}

function ManagementCard({ product, onDelete, t }) {
  const router = useRouter();
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= 5 && product.stock > 0;
  const hasSale = product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price);
  const discountPct = hasSale ? Math.round(((Number(product.compare_at_price) - Number(product.price)) / Number(product.compare_at_price)) * 100) : 0;
  const status = isOutOfStock
    ? { label: t('products.soldOut', 'Sold Out'), color: 'text-red-500', bg: 'bg-red-500/10' }
    : isLowStock
       ? { label: t('products.lowStock', 'Low Stock'), color: 'text-amber-500', bg: 'bg-amber-500/10' }
       : { label: t('products.active', 'Active'), color: 'text-emerald-500', bg: 'bg-emerald-500/10' };

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => router.push(`/vendor/products/edit?id=${product._id}`)}
    >
      <div className="relative aspect-[4/3] bg-[var(--bg-secondary)]">
        {getProductImageUrl(product) ? (
          <img src={getProductImageUrl(product)} alt={product.name} loading="lazy" decoding="async" className="size-full object-cover transition duration-500 group-hover:scale-105" />
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
        {hasSale && (
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-1 text-[10px] font-bold text-white shadow-sm">
            <Tag className="size-2.5" />
            -{discountPct}%
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]">{product.category || t('products.general', 'General')}</p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-[var(--text-primary)]">
              {product.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--accent)]">
              <Pencil className="size-3.5" />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(product._id); }}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white"
              aria-label="Delete product"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-2">
          <div className="flex flex-col">
            {hasSale ? (
              <>
                <span className="text-[12px] font-bold text-[var(--accent)]">{Number(product.price).toLocaleString()} XAF</span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] line-through">{product.compare_at_price?.toLocaleString()} XAF</span>
              </>
            ) : (
              <span className="text-[12px] font-semibold">{product.price?.toLocaleString()} XAF</span>
            )}
          </div>
          <p className={`text-[11px] font-semibold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-emerald-500'}`}>
            {t('products.stock', 'Stock:')} {product.stock}
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

function ListRow({ product, onDelete, t }) {
  const router = useRouter();
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= 5 && product.stock > 0;
  const hasSale = product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price);
  const discountPct = hasSale ? Math.round(((Number(product.compare_at_price) - Number(product.price)) / Number(product.compare_at_price)) * 100) : 0;
  const status = isOutOfStock
    ? { label: t('products.soldOut', 'Sold Out'), color: 'text-red-500', bg: 'bg-red-500/10' }
    : isLowStock
       ? { label: t('products.lowStock', 'Low Stock'), color: 'text-amber-500', bg: 'bg-amber-500/10' }
       : { label: t('products.active', 'Active'), color: 'text-emerald-500', bg: 'bg-emerald-500/10' };

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-2.5 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => router.push(`/vendor/products/edit?id=${product._id}`)}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-secondary)]">
        {getProductImageUrl(product) ? (
          <img src={getProductImageUrl(product)} alt={product.name} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--accent)]/20">
            <Package className="size-5" />
          </div>
        )}
        {hasSale && (
          <div className="absolute bottom-0 left-0 right-0 bg-[var(--accent)] py-0.5 text-center text-[8px] font-bold text-white">
            -{discountPct}%
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold">{product.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-secondary)]">
          <span>{product.category || t('products.general', 'General')}</span>
          <span className={status.color}>{status.label}</span>
          {hasSale ? (
            <span className="flex items-center gap-1">
              <span className="font-semibold text-[var(--accent)]">{Number(product.price).toLocaleString()} XAF</span>
              <span className="line-through">{product.compare_at_price?.toLocaleString()} XAF</span>
            </span>
          ) : (
            <span>{product.price?.toLocaleString()} XAF</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1"><Eye className="size-3" />{product.view_count || 0}</span>
          <span className="inline-flex items-center gap-1"><Zap className="size-3" />{product.purchase_count || 0}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-2 text-[10px] font-medium text-[var(--accent)]">
          <Pencil className="size-3.5" />
          {t('products.edit', 'Edit')}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(product._id); }}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition hover:bg-red-500 hover:text-white"
          aria-label="Delete product"
        >
          <Trash2 className="size-3.5" />
        </button>
        <div className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--accent)]">
          <ChevronRight className="size-3.5" />
        </div>
      </div>
    </div>
  );
}
