'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight, CheckCircle2, Eye, LayoutGrid, List, Loader2, Package, Pencil, Plus, RefreshCw, Search, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { effectiveStock, isAvailable, stockLevel } from '@/lib/stock';
import { productImageUrl } from '@/lib/productEditor';
import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';
import { ProductPageHeader, useProductPaths } from '@/components/vendor/ProductWorkspace';
import styles from '@/components/vendor/Products.module.css';

function priceDetails(product) {
  const variants = product.has_variants && Array.isArray(product.sku_variants) ? product.sku_variants : [];
  const offers = variants.length ? variants : [product];
  const sale = offers.some((offer) => Number(offer.sale_price) > 0 && Number(offer.sale_price) < Number(offer.price));
  const price = Math.min(...offers.map((offer) => Number(offer.sale_price) > 0 && Number(offer.sale_price) < Number(offer.price) ? Number(offer.sale_price) : Number(offer.price) || 0));
  return { price, sale, variants: variants.length };
}

function StockBadge({ product }) {
  const level = stockLevel(product);
  const tone = level === 'out' ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10' : level === 'low' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
  return <span className={`${styles.pill} ${tone}`}><span className="size-1.5 rounded-full bg-current" />{level === 'out' ? 'Out of stock' : level === 'low' ? 'Low stock' : product.is_meal ? 'On menu' : 'In stock'}</span>;
}

function ProductImage({ product, className }) {
  const src = productImageUrl(product.images?.[0]);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? <img src={src} alt={product.name} className={className} loading="lazy" onError={() => setBroken(true)} />
    : <div className={`${className} flex items-center justify-center`}><Package className="size-9 text-[var(--text-secondary)] opacity-25" aria-hidden="true" /></div>;
}

function ProductItem({ product, listView, editPath, onDelete, deleting }) {
  const pricing = priceDetails(product);
  const category = typeof product.category === 'string' ? product.category : product.category?.name || 'General';
  const price = <p className="break-words text-[13px] font-bold tabular-nums">{pricing.variants > 0 && <span className="text-[10px] font-normal text-[var(--text-secondary)]">From </span>}{pricing.price.toLocaleString()} <span className="text-[10px] font-medium text-[var(--text-secondary)]">XAF</span></p>;
  const actions = <>
    <Link href={editPath} aria-label={`Edit ${product.name}`} className={`${styles.secondaryButton} !min-h-9 !gap-1.5 !px-3 !py-2`}><Pencil className="size-3.5" /><span className="text-[10px]">Edit</span></Link>
    <button type="button" disabled={deleting} onClick={() => onDelete(product)} aria-label={`Delete ${product.name}`} className={`${styles.iconButton} !size-9 !min-h-9 !rounded-xl text-rose-500`}>
      {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  </>;
  if (listView) return <article className={`${styles.card} flex items-center gap-3 p-3 sm:gap-4 sm:p-4`}>
    <Link href={editPath} className="shrink-0"><ProductImage product={product} className="size-16 rounded-xl bg-[var(--bg-secondary)] object-cover sm:size-20" /></Link>
    <div className="min-w-0 flex-1"><p className="truncate text-[10px] text-[var(--text-secondary)]">{category}</p><Link href={editPath} className="mt-0.5 block truncate text-[12px] font-semibold">{product.name}</Link><div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4">{price}<StockBadge product={product} /></div></div>
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">{actions}</div>
  </article>;
  return <article className={styles.card}>
    <div className="relative"><Link href={editPath} aria-label={`Edit ${product.name}`}><ProductImage product={product} className={styles.image} /></Link><div className="absolute left-3 top-3"><StockBadge product={product} /></div>{pricing.sale && <span className="absolute bottom-3 left-3 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold text-white">On sale</span>}</div>
    <div className="space-y-3 p-3 sm:p-4">
      <div><p className="truncate text-[10px] text-[var(--text-secondary)]">{category}</p><Link href={editPath} className="mt-1 block truncate text-[12px] font-semibold">{product.name}</Link></div>
      <div className="space-y-1">{price}<p className="text-[10px] text-[var(--text-secondary)]">{product.is_meal ? 'On your menu' : `${effectiveStock(product)} units in stock`}{pricing.variants > 0 ? ` · ${pricing.variants} variants` : ''}</p></div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-secondary)]"><span className="inline-flex items-center gap-1"><Eye className="size-3" />{product.view_count || 0} views</span><span className="inline-flex items-center gap-1"><ShoppingBag className="size-3" />{product.purchase_count || 0} sold</span></div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3"><div className="flex items-center gap-1.5">{actions}</div><Link href={`/products/${product._id}`} aria-label={`View ${product.name} in store`} className="hidden rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] sm:block"><ArrowUpRight className="size-4" /></Link></div>
      {product.status && product.status !== 'active' && <p className="text-[10px] capitalize text-[var(--text-secondary)]">{product.status} listing</p>}
    </div>
  </article>;
}

export default function VendorProductsPage() {
  const { t } = useLanguage();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hasHydrated);
  const paths = useProductPaths();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  const requestId = useRef(0);
  const deleteRef = useRef(false);
  const userId = user?._id;
  const role = user?.role;
  const pageSize = view === 'grid' ? 12 : 20;

  const loadProducts = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    try {
      const res = await api.get('/vendor/products', { skipClientCache: true });
      if (request !== requestId.current) return;
      if (!res.data?.success) throw new Error(res.data?.message || 'Could not load products.');
      const records = res.data.data?.products || res.data.data;
      if (!Array.isArray(records)) throw new Error('Could not read your product catalogue. Please try again.');
      setProducts(records.filter((product) => product && product._id));
    } catch (err) { if (request === requestId.current) setError(err.response?.data?.message || err.message || 'Could not load products.'); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (!hydrated || !userId || role !== 'vendor') return;
    loadProducts();
    return () => { requestId.current += 1; };
  }, [hydrated, userId, role, loadProducts]);
  useEffect(() => { try { const saved = localStorage.getItem('productsView'); if (saved === 'grid' || saved === 'list') setView(saved); } catch {} }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const records = products.filter((product) => {
      const category = typeof product.category === 'string' ? product.category : product.category?.name || '';
      if (query && !`${product.name || ''} ${category}`.toLowerCase().includes(query)) return false;
      if (stockFilter === 'in') return isAvailable(product);
      if (stockFilter === 'low') return stockLevel(product) === 'low';
      if (stockFilter === 'out') return stockLevel(product) === 'out';
      return true;
    });
    return records.sort((a, b) => sort === 'name' ? String(a.name || '').localeCompare(String(b.name || ''))
      : sort === 'price_asc' ? priceDetails(a).price - priceDetails(b).price
        : sort === 'price_desc' ? priceDetails(b).price - priceDetails(a).price
          : sort === 'stock' ? effectiveStock(b) - effectiveStock(a)
            : (Date.parse(b.createdAt || b.created_at) || 0) - (Date.parse(a.createdAt || a.created_at) || 0));
  }, [products, search, stockFilter, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = products.filter(isAvailable).length;
  const lowCount = products.filter((product) => stockLevel(product) === 'low').length;
  const saleCount = products.filter((product) => priceDetails(product).sale).length;
  const filters = [{ value: 'all', label: 'All products', count: products.length }, { value: 'in', label: 'In stock', count: activeCount }, { value: 'low', label: 'Low stock', count: lowCount }, { value: 'out', label: 'Out of stock', count: products.filter((product) => stockLevel(product) === 'out').length }];
  const changeView = (value) => { setView(value); setPage(1); try { localStorage.setItem('productsView', value); } catch {} };

  const deleteProduct = async (product) => {
    if (deleteRef.current || !window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    deleteRef.current = true; setDeleting(product._id);
    try {
      const res = await api.delete(`/products/${encodeURIComponent(product._id)}`);
      if (!res.data?.success) throw new Error(res.data?.message || 'Could not delete this product.');
      setProducts((previous) => previous.filter((item) => item._id !== product._id));
    } catch (err) { setError(err.response?.data?.message || err.message || 'Could not delete this product.'); }
    finally { deleteRef.current = false; setDeleting(null); }
  };

  if (!hydrated || !user) return null;
  return <div className={styles.page}>
    <ProductPageHeader title={t('products.title', 'Products')} description={user.branding?.store_name || 'Your catalogue, all in one place.'}>
      <button type="button" aria-label="Refresh products" onClick={loadProducts} disabled={loading} className={styles.iconButton}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
      <Link href={paths.add} className={styles.button}><Plus className="size-4" /><span className="text-[11px]">{t('products.addProduct', 'Add product')}</span></Link>
    </ProductPageHeader>
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 pb-32 sm:px-6 md:px-8 md:py-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total products" value={products.length} icon={Package} color="indigo" pct="Catalogue" footer="Products in your store" loading={loading} />
        <StatCard label="In stock" value={activeCount} icon={CheckCircle2} color="emerald" progress={products.length ? activeCount / products.length * 100 : 0} footer="Ready for your customers" loading={loading} />
        <StatCard label="Low stock" value={lowCount} icon={AlertCircle} color="amber" progress={products.length ? lowCount / products.length * 100 : 0} footer={lowCount ? `${lowCount} products need a restock` : 'Stock is looking healthy'} loading={loading} />
        <StatCard label="On sale" value={saleCount} icon={Tag} color="primary" progress={products.length ? saleCount / products.length * 100 : 0} footer="Products with a sale price" loading={loading} />
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-[12px] text-rose-600 dark:text-rose-300"><AlertCircle className="size-4 shrink-0" /><p className="min-w-0 flex-1">{error}</p><button type="button" onClick={loadProducts} disabled={loading} className="font-semibold underline">Try again</button></div>}
      <section className={`${styles.panel} !p-0 overflow-hidden`} aria-label="Product catalogue">
        <div className="space-y-5 border-b border-[var(--glass-border)] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Your catalogue</h2><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Keep your products fresh and your stock up to date.</p></div><span className={`${styles.pill} hidden text-[var(--text-secondary)] sm:inline-flex`}>{filtered.length} products</span></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]" /><input type="search" aria-label="Search products" placeholder="Search products or categories" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className={`${styles.input} !pl-11 text-[12px]`} /></div>
            <div className="flex items-center gap-2"><select aria-label="Sort products" className={`${styles.input} min-w-0 flex-1 text-[11px] sm:!w-auto`} value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest first</option><option value="name">Name: A to Z</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="stock">Most stock</option></select><div className="flex gap-1 rounded-2xl border border-[var(--glass-border)] p-1">{[{ value: 'grid', icon: LayoutGrid }, { value: 'list', icon: List }].map(({ value, icon: Icon }) => <button key={value} type="button" aria-label={`${value === 'grid' ? 'Grid' : 'List'} view`} aria-pressed={view === value} onClick={() => changeView(value)} className={`rounded-xl p-2.5 ${view === value ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}><Icon className="size-4" /></button>)}</div></div>
          </div>
          <div className="flex flex-wrap gap-2">{filters.map((filter) => <button key={filter.value} type="button" aria-pressed={stockFilter === filter.value} onClick={() => { setStockFilter(filter.value); setPage(1); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-medium transition ${stockFilter === filter.value ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>{filter.label}<span className="opacity-65">{filter.count}</span></button>)}</div>
        </div>
        {loading ? <div aria-label="Loading products" aria-busy="true" className="grid grid-cols-2 gap-4 p-4 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl bg-[var(--bg-secondary)]" />)}</div>
          : visible.length ? <div className={view === 'grid' ? 'grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 lg:grid-cols-3 2xl:grid-cols-4' : 'space-y-3 p-3 sm:p-6'}>{visible.map((product) => <ProductItem key={product._id} product={product} editPath={paths.edit(product._id)} listView={view === 'list'} onDelete={deleteProduct} deleting={deleting === product._id} />)}</div>
            : <div className="flex flex-col items-center px-5 py-16 text-center"><span className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-[var(--accent)]/10 text-[var(--accent)]"><Package className="size-7" /></span><h3 className="text-base font-semibold">{products.length ? 'No products match your filters' : error ? 'Your catalogue is unavailable' : 'Your next great product starts here'}</h3><p className="mb-6 mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--text-secondary)]">{products.length ? 'Try a different search or clear your filters.' : error ? 'Try loading your products again.' : 'Add your first product with photos, a price, and a few details.'}</p>{products.length ? <button type="button" className={styles.secondaryButton} onClick={() => { setSearch(''); setStockFilter('all'); setPage(1); }}>Clear filters</button> : !error && <Link href={paths.add} className={styles.button}><Plus className="size-4" />Add your first product</Link>}</div>}
        {!loading && filtered.length > 0 && <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--glass-border)] px-4 py-4 sm:flex-row sm:px-6"><p className="text-[11px] text-[var(--text-secondary)]">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} products</p><Pagination compact currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} /></div>}
      </section>
    </div>
  </div>;
}
