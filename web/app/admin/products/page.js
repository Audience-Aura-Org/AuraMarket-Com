"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Package, Search, Loader2, Eye, Building2, Star, CheckCircle, Trash2, RefreshCw, Pencil, Ban, Archive, ShieldAlert, LayoutGrid, SlidersHorizontal, X } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';

const SORT_OPTIONS = [
  { value: 'default',    label: 'Default order' },
  { value: 'name_asc',  label: 'Name A → Z' },
  { value: 'name_desc', label: 'Name Z → A' },
  { value: 'price_low', label: 'Price: Low → High' },
  { value: 'price_high',label: 'Price: High → Low' },
  { value: 'rating',    label: 'Highest rated' },
];

function applySort(list, sortBy) {
  const arr = [...list];
  switch (sortBy) {
    case 'name_asc':  return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'name_desc': return arr.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    case 'price_low': return arr.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    case 'price_high':return arr.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    case 'rating':    return arr.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    default:          return arr;
  }
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetchProducts();
    setCurrentPage(1);
    setSelectedIds([]);
  }, [statusFilter]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === currentProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentProducts.map(p => p._id));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to PURGE ${selectedIds.length} products? This is irreversible.`)) return;
    setBulkDeleting(true);
    try {
      const res = await api.post('/admin/products/bulk-delete', { ids: selectedIds });
      if (res.data.success) {
        toast.success(res.data.message);
        setProducts(prev => prev.filter(p => !selectedIds.includes(p._id)));
        setSelectedIds([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk purge failed');
    } finally {
      setBulkDeleting(false);
    }
  };

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
        const updated = res.data.data?.product;
        setProducts(prev => prev.map(p => p._id === productId ? { ...p, ...(updated || {}), status } : p));
      }
    } catch (err) {
      toast.error('Asset status change failed');
    }
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendor_id?.store_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProducts = applySort(filtered, sortBy);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ── Stat counts (from full products list, not filtered) ──────────────────
  const total     = products.length;
  const active    = products.filter(p => p.status === 'active').length;
  const pending   = products.filter(p => p.status === 'pending').length;
  const suspended = products.filter(p => p.status === 'suspended').length;
  const fmt = n => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className={`size-5 rounded-lg border flex items-center justify-center transition-all ${selectedIds.length === currentProducts.length && currentProducts.length > 0 ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}
            >
              {selectedIds.length === currentProducts.length && currentProducts.length > 0 && <CheckCircle className="size-3" />}
            </button>
            <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Global <span className="text-[var(--accent)]">Assets</span></h2>
            <div className="flex items-center gap-2 mt-0.5 hidden md:flex">
              <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Inventory Node</p>
            </div>
          </div>
          <button onClick={fetchProducts} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar flex-1 md:flex-none justify-between md:justify-start">
            {['all', 'active', 'pending', 'archived', 'suspended'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-semibold tracking-tight transition-all uppercase ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-40'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={fetchProducts} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-10 space-y-6 lg:space-y-8 pb-32">

          {/* ── Stat Cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Assets"    value={fmt(total)}     sub="All Listed Products"   icon={LayoutGrid}  color="blue"    progress={100}            footer={`${fmt(total)} products in pool`} />
            <StatCard label="Active Listings" value={fmt(active)}    sub="Live on Marketplace"   icon={Package}     color="emerald" progress={pct(active)}    footer={`${pct(active)}% of total`} />
            <StatCard label="Pending Review"  value={fmt(pending)}   sub="Awaiting Approval"     icon={Star}        color="amber"   progress={pct(pending)}   footer="Pending approval" />
            <StatCard label="Suspended"       value={fmt(suspended)} sub="Flagged / Deactivated" icon={ShieldAlert} color="rose"    progress={pct(suspended)} footer={`${pct(suspended)}% of total`} />
          </div>

          {/* ── Search + Sort toolbar ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, vendor or category…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 pl-10 pr-10 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[12px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-40 placeholder:font-normal outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-6 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-all"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="h-11 pl-9 pr-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[12px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all appearance-none cursor-pointer w-full sm:w-auto"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Result count */}
            <div className="hidden sm:flex items-center px-4 h-11 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-60 tabular-nums whitespace-nowrap">
                {filteredProducts.length} <span className="opacity-60">of</span> {total}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center opacity-40">
              <Loader2 className="size-12 lg:size-16 animate-spin text-[var(--accent)] shadow-xl" />
            </div>
          ) : (
            <div className="space-y-12">
              <div className="glass-panel overflow-x-auto rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 shadow-2xl">
                <table className="w-full min-w-[1160px] table-fixed text-left">
                  <thead className="bg-[var(--bg-secondary)]/60">
                    <tr className="border-b border-[var(--glass-border)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/60">
                      <th className="w-20 whitespace-nowrap px-5 py-4">Select</th>
                      <th className="w-[320px] whitespace-nowrap px-5 py-4">Product</th>
                      <th className="w-[220px] whitespace-nowrap px-5 py-4">Vendor</th>
                      <th className="w-[150px] whitespace-nowrap px-5 py-4 text-right">Price</th>
                      <th className="w-24 whitespace-nowrap px-5 py-4 text-center">Rating</th>
                      <th className="w-32 whitespace-nowrap px-5 py-4 text-center">Status</th>
                      <th className="w-[240px] whitespace-nowrap px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {currentProducts.map(p => {
                      const statusClass = p.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : p.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : p.status === 'suspended'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                      const isSelected = selectedIds.includes(p._id);

                      return (
                        <tr key={p._id} className={`transition-colors hover:bg-[var(--bg-secondary)]/35 ${isSelected ? 'bg-[var(--accent)]/5' : ''}`}>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => toggleSelect(p._id)}
                              className={`size-6 rounded-lg border flex items-center justify-center transition-all ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-transparent'}`}
                            >
                              <CheckCircle className="size-3.5" />
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="size-12 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                                <img src={p.images?.[0]?.url || '/placeholder.png'} className="size-full object-cover" alt="" />
                              </div>
                              <div className="min-w-0">
                                <p className="max-w-[260px] truncate text-sm font-bold text-[var(--text-primary)]">{p.name}</p>
                                <p className="text-[10px] font-semibold text-[var(--text-secondary)]/45">{p.category || 'Uncategorized'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                              <Building2 className="size-3.5 text-[var(--accent)]" />
                              {p.vendor_id?.store_name || 'Unknown vendor'}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-bold">
                            <div>{(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price)?.toLocaleString()} <span className="text-[10px] text-[var(--text-secondary)]/45">XAF</span></div>
                            {p.sale_price && Number(p.sale_price) < Number(p.price) && (
                              <div className="text-[10px] font-semibold text-[var(--text-secondary)]/45 line-through">{p.price?.toLocaleString()} XAF</div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1 text-xs font-semibold">
                              <Star className="size-3 text-amber-500 fill-amber-500" />
                              {p.rating || '0.0'}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/products?id=${encodeURIComponent(p._id)}`} className="size-9 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[var(--accent)] transition-all">
                                <Eye className="size-4" />
                              </Link>
                              <Link href={`/admin/products/edit/${p._id}`} className="size-9 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[var(--accent)] transition-all" title="Edit product">
                                <Pencil className="size-4" />
                              </Link>
                              {p.status !== 'active' && (
                                <button onClick={() => handleStatusUpdate(p._id, 'active')} className="h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all">
                                  Approve
                                </button>
                              )}
                              {p.status !== 'archived' && (
                                <button onClick={() => handleStatusUpdate(p._id, 'archived')} className="size-9 rounded-xl border border-amber-500/20 bg-amber-500/10 flex items-center justify-center text-amber-400 hover:bg-amber-500 hover:text-white transition-all" title="Disapprove">
                                  <Archive className="size-4" />
                                </button>
                              )}
                              {p.status !== 'suspended' && (
                                <button onClick={() => handleStatusUpdate(p._id, 'suspended')} className="size-9 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all" title="Suspend">
                                  <Ban className="size-4" />
                                </button>
                              )}
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

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-32 lg:py-40 text-center opacity-30">
                  <Package className="size-16 lg:size-20 mx-auto mb-6 opacity-10" />
                  <p className="text-[10px] lg:text-[12px] font-semibold tracking-[0.5em]">
                    {search ? `No products matching "${search}"` : 'No products found'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BULK ACTION BAR */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-36 md:bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 px-10 py-5 bg-[var(--bg-primary)]/80 backdrop-blur-2xl border border-[var(--accent)]/30 rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.4)] min-w-[360px] justify-between"
          >
            <div className="flex flex-col">
              <span className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--accent)]">Batch Selection</span>
              <span className="text-sm font-bold">{selectedIds.length} Asset Items</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedIds([])}
                className="px-4 py-2 rounded-xl text-[11px] lg:text-[12px] font-semibold tracking-tight hover:bg-[var(--bg-secondary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-8 py-4 rounded-full bg-rose-500 text-white text-[11px] lg:text-[12px] font-semibold tracking-tight hover:bg-rose-600 transition-all flex items-center gap-2 shadow-lg shadow-rose-500/30 disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Purge Assets
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
