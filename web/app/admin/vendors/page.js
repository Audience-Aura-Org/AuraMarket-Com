"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Store, ShieldCheck, Mail, MapPin, 
  Building2, ExternalLink, Search, Loader2, 
  Ban, User, TrendingUp, Star, 
  ChevronRight, RefreshCw, Activity, Package, Database,
  Pencil, X, Upload
} from 'lucide-react';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StatCard from '@/components/layout/StatCard';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [mediaForm, setMediaForm] = useState({ logo: '', banner: '', commission_rate: '', delivery_time: '', minimum_order_amount: '' });
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(null);
  const itemsPerPage = 12;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchVendors();
    setCurrentPage(1);
  }, [statusFilter]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/vendors?status=${statusFilter === 'all' ? '' : statusFilter}`);
      if (res.data?.success) setVendors(res.data.data.vendors || []);
    } catch (err) {
      toast.error('Failed to resolve vendor registry');
    } finally { setLoading(false); }
  };

  const handleToggleVerify = async (vendorId, currentStatus) => {
    try {
      const res = await api.patch(`/admin/vendors/${vendorId}/status`, { verified: !currentStatus });
      if (res.data.success) {
        toast.success(`Node shifted to ${!currentStatus ? 'VERIFIED' : 'UNVERIFIED'}`);
        setVendors(prev => prev.map(v => v._id === vendorId ? { ...v, verified: !currentStatus } : v));
      }
    } catch (err) { toast.error('Shift failed'); }
  };

  const getVendorLogo = (vendor) => (
    vendor?.store?.logo ||
    vendor?.user_id?.branding?.logo ||
    vendor?.user_id?.avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor?.store_name || 'Vendor')}`
  );

  const getVendorBanner = (vendor) => (
    vendor?.store?.banner ||
    vendor?.user_id?.branding?.banner ||
    ''
  );

  const getEditableVendorLogo = (vendor) => (
    vendor?.store?.logo ||
    vendor?.user_id?.branding?.logo ||
    vendor?.user_id?.avatar ||
    ''
  );

  const openMediaEditor = (vendor) => {
    setEditingVendor(vendor);
    setMediaForm({
      logo: getEditableVendorLogo(vendor),
      banner: getVendorBanner(vendor),
      commission_rate: vendor?.store?.commission_rate ?? '',
      delivery_time: vendor?.store?.delivery_time || '',
      minimum_order_amount: vendor?.store?.minimum_order_amount ?? '',
    });
  };

  const closeMediaEditor = () => {
    setEditingVendor(null);
    setMediaForm({ logo: '', banner: '', commission_rate: '', delivery_time: '', minimum_order_amount: '' });
    setMediaUploading(null);
  };

  const handleMediaUpload = async (field, file) => {
    if (!file) return;
    setMediaUploading(field);
    try {
      const res = await uploadService.uploadSingle(file, field === 'banner' ? 'banners' : 'avatars');
      if (res?.success && res?.data?.url) {
        setMediaForm((prev) => ({ ...prev, [field]: res.data.url }));
        toast.success(`${field === 'banner' ? 'Banner' : 'Logo'} uploaded.`);
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setMediaUploading(null);
    }
  };

  const saveVendorMedia = async () => {
    if (!editingVendor) return;
    setMediaSaving(true);
    try {
      const mediaPayload = { logo: mediaForm.logo, banner: mediaForm.banner };
      const mediaChanged =
        mediaPayload.logo !== getEditableVendorLogo(editingVendor) ||
        mediaPayload.banner !== getVendorBanner(editingVendor);

      let updatedVendor = null;
      if (mediaChanged) {
        const mediaRes = await api.patch(`/admin/vendors/${editingVendor._id}/media`, mediaPayload);
        updatedVendor = mediaRes.data?.data?.vendor || null;
      }

      const res = await api.patch(`/admin/vendors/${editingVendor._id}/store-settings`, {
        commission_rate: mediaForm.commission_rate,
        delivery_time: mediaForm.delivery_time,
        minimum_order_amount: mediaForm.minimum_order_amount,
      });
      updatedVendor = res.data?.data?.vendor || updatedVendor;
      if (res.data?.success && updatedVendor) {
        setVendors((prev) => prev.map((vendor) => vendor._id === updatedVendor._id ? updatedVendor : vendor));
        toast.success('Vendor store settings updated.');
        closeMediaEditor();
      } else {
        toast.error(res.data?.message || 'Could not update vendor settings');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update vendor settings');
    } finally {
      setMediaSaving(false);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.store_name?.toLowerCase().includes(search.toLowerCase()) || 
    v.user_id?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const currentVendors = filteredVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Store className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Merchant <span className="text-[var(--accent)]">Registry</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Items Active // Matrix</p>
              </div>
            </div>
          </div>
          <button onClick={fetchVendors} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
           <div className="relative w-full md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input
                type="text"
                placeholder="FIND MERCHANT NODE..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all shadow-inner"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
           </div>
           
           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-none flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 shadow-inner">
                 {['all', 'verified', 'unverified'].map(s => (
                   <button
                     key={s} onClick={() => setStatusFilter(s)}
                     className={`flex-1 md:flex-none px-4 py-1.5 rounded-xl text-[10px] md:text-[11px] font-bold tracking-tight transition-all uppercase ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                   >
                     {s}
                   </button>
                 ))}
              </div>
              <button onClick={fetchVendors} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
                 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
           </div>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Live Intelligence Stats */}
         {/* Live Intelligence Stats */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Merchants" value={vendors.length} icon="storefront" color="fuchsia" sub="REGISTRY" />
            <StatCard label="Verified Items" value={vendors.filter(v => v.verified).length} icon="verified_user" color="emerald" sub="TRUST" />
            <StatCard
              label="Avg Rating"
              value={(() => {
                const rated = vendors.map(v => Number(v.rating || 0)).filter(v => v > 0);
                return rated.length ? (rated.reduce((sum, v) => sum + v, 0) / rated.length).toFixed(2) : 'New';
              })()}
              icon="star"
              color="amber"
              sub="SCORE"
            />
            <StatCard label="Network Yield" value="High" icon="trending_up" color="indigo" sub="SCALE" />
         </div>

         {/* Vendor Ledger */}
         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Database className="size-4 text-[var(--accent)]" /> Global Merchant Ledger
               </h3>
               <p className="hidden md:block text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Active Verification Matrix</p>
            </div>

            <div className="p-4 md:p-8 space-y-4">
              {loading ? (
                 <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                    <Loader2 className="animate-spin size-10" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Synchronizing Registry...</p>
                 </div>
              ) : currentVendors.length === 0 ? (
                 <div className="py-40 flex flex-col items-center justify-center opacity-10 px-10 text-center gap-6">
                    <Store className="w-16 h-16 text-[var(--text-secondary)]" />
                    <p className="text-xs font-bold tracking-[0.4em] uppercase max-w-sm">No Merchant Items Synchronized</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 gap-4">
                    {currentVendors.map(v => (
                       <div key={v._id} className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-6">
                          <div className="flex items-center gap-5 flex-1 min-w-0">
                             <div className="size-14 md:size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                <img src={getVendorLogo(v)} className="size-full object-cover" alt="" />
                             </div>
                             
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                   <h4 className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight truncate group-hover:text-[var(--accent)] transition-colors">{v.store_name}</h4>
                                   {v.verified && <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />}
                                </div>
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest truncate">Owner: {v.user_id?.name || 'GENERIC_USER'}</p>
                             </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 md:gap-12 md:px-12 md:border-x border-[var(--glass-border)]/50 py-4 md:py-0 border-y md:border-y-0">
                             <div className="text-center">
                                <p className="text-base md:text-lg font-bold tabular-nums tracking-tighter text-[var(--text-primary)]">{v.total_sales || 0}</p>
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-[0.2em] mt-0.5">Sales</p>
                             </div>
                             <div className="text-center">
                                <p className="text-base md:text-lg font-bold tabular-nums tracking-tighter text-[var(--text-primary)]">{fmt(v.total_revenue)}</p>
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-[0.2em] mt-0.5">Revenue</p>
                             </div>
                             <div className="text-center">
                                <div className="flex items-center gap-1 justify-center">
                                   <Star className="size-3 text-amber-500 fill-amber-500" />
                                   <p className="text-base md:text-lg font-bold tabular-nums tracking-tighter text-[var(--text-primary)]">{v.rating?.toFixed(1) || '0.0'}</p>
                                </div>
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-[0.2em] mt-0.5">Rating</p>
                             </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                             <div className="flex items-center gap-2">
                                <div className={`size-1.5 rounded-full ${v.verified ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                                <span className="text-[10px] font-bold tracking-widest uppercase opacity-60">{v.verified ? 'Verified' : 'Pending'}</span>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                <button
                                   type="button"
                                   onClick={() => openMediaEditor(v)}
                                   className="size-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm active:scale-95"
                                   title="Edit vendor logo and banner"
                                >
                                   <Pencil className="size-4.5" />
                                </button>
                                <button 
                                   onClick={() => handleToggleVerify(v._id, v.verified)} 
                                   className={`size-10 rounded-xl flex items-center justify-center border transition-all ${v.verified ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'}`}
                                   title={v.verified ? 'Revoke Verification' : 'Verify Merchant'}
                                >
                                   <ShieldCheck className="size-4.5" />
                                </button>
                                <Link href={`/stores/${v._id}`} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm active:scale-95">
                                   <ExternalLink className="size-4.5" />
                                </Link>
                                <button className="size-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95">
                                   <Ban className="size-4.5" />
                                </button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              )}
            </div>

            <div className="p-6 md:p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 flex justify-center">
               <Pagination 
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={setCurrentPage}
               />
            </div>
         </div>
      </div>
      {mounted && editingVendor && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-stretch bg-black/55 backdrop-blur-sm">
          <div className="flex h-[100dvh] w-full flex-col bg-[var(--bg-primary)]">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--glass-border)] px-4 py-4 md:px-8">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Vendor settings</p>
                <h3 className="truncate text-xl font-bold text-[var(--text-primary)]">{editingVendor.store_name}</h3>
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Update store media, commission override, delivery time, and minimum order rules.</p>
              </div>
              <button
                type="button"
                onClick={closeMediaEditor}
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-4 shadow-sm">
                  <div className="relative h-56 overflow-hidden rounded-2xl bg-[var(--bg-primary)]">
                    {mediaForm.banner ? (
                      <img src={mediaForm.banner} alt="Vendor banner preview" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm font-semibold text-[var(--text-secondary)]">No banner selected</div>
                    )}
                    <div className="absolute -bottom-8 left-5 size-24 overflow-hidden rounded-3xl border-4 border-[var(--bg-secondary)] bg-[var(--bg-primary)] shadow-xl">
                      <img src={mediaForm.logo || getVendorLogo(editingVendor)} alt="Vendor logo preview" className="size-full object-cover" />
                    </div>
                  </div>
                  <div className="mt-12">
                    <h4 className="text-lg font-bold text-[var(--text-primary)]">{editingVendor.store_name}</h4>
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">Live preview</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm md:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[
                      { field: 'commission_rate', label: 'Commission override (%)', placeholder: 'e.g. 10', hint: 'Blank uses platform default.', type: 'number' },
                      { field: 'delivery_time', label: 'Delivery time', placeholder: 'e.g. 1-2 days', hint: 'Shown on product cards.', type: 'text' },
                      { field: 'minimum_order_amount', label: 'Minimum order (XAF)', placeholder: 'e.g. 5000', hint: 'Blank disables store minimum.', type: 'number' },
                    ].map((item) => (
                      <div key={item.field} className="flex flex-col justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-4 transition-all duration-300 hover:border-[var(--accent)]/30">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{item.label}</label>
                          <input
                            type={item.type}
                            value={mediaForm[item.field]}
                            onChange={(event) => setMediaForm((prev) => ({ ...prev, [item.field]: event.target.value }))}
                            placeholder={item.placeholder}
                            className="mt-2 h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[11px] placeholder:font-normal placeholder:opacity-40 outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                        <p className="mt-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-60 leading-normal">{item.hint}</p>
                      </div>
                    ))}
                  </div>

                  {[
                    { field: 'logo', label: 'Store logo', hint: 'Square image recommended.' },
                    { field: 'banner', label: 'Store banner', hint: 'Wide landscape image recommended.' },
                  ].map((item) => (
                    <div key={item.field} className="space-y-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold text-[var(--text-primary)]">{item.label}</label>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{item.hint}</p>
                        </div>
                        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white">
                          {mediaUploading === item.field ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleMediaUpload(item.field, event.target.files?.[0])}
                          />
                        </label>
                      </div>
                      <input
                        type="url"
                        value={mediaForm[item.field]}
                        onChange={(event) => setMediaForm((prev) => ({ ...prev, [item.field]: event.target.value }))}
                        placeholder={`${item.label} URL`}
                        className="h-12 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[11px] placeholder:font-normal outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeMediaEditor}
                className="h-11 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveVendorMedia}
                disabled={mediaSaving || mediaUploading}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-xs font-bold text-white shadow-lg shadow-[var(--accent)]/20 disabled:opacity-60"
              >
                {mediaSaving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                Save settings
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
