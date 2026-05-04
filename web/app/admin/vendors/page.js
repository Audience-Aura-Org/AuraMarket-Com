"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  Store, ShieldCheck, Mail, MapPin, 
  Building2, ExternalLink, Search, Loader2, 
  Ban, User, TrendingUp, Star, 
  ChevronRight, RefreshCw, Activity, Package
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

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

  const filteredVendors = vendors.filter(v => 
    v.store_name?.toLowerCase().includes(search.toLowerCase()) || 
    v.user_id?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const currentVendors = filteredVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      
      {/* Surgical Header */}
      <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
              <Store className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Merchant Registry</h1>
              <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight">Global Vendor Oversight</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
              <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
              <input
                type="text"
                placeholder="FIND STORE..."
                className="bg-transparent border-none outline-none text-[11px] font-bold tracking-tight w-48 text-[var(--text-primary)]"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5">
              {['all', 'verified', 'unverified'].map(s => (
                <button
                  key={s} onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-bold tracking-tight transition-all ${statusFilter === s ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] opacity-40'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-4 max-w-[1600px] mx-auto">
        
        {loading ? (
           <LoadingSpinner />
        ) : (
           <div className="space-y-2 min-h-[600px]">
              {currentVendors.map(v => (
                <div key={v._id} className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                  <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img src={v.user_id?.branding?.logo || v.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${v.store_name}`} className="size-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] font-bold  truncate">{v.store_name}</p>
                      {v.verified && <ShieldCheck className="size-3 text-emerald-500" />}
                    </div>
                    <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 truncate  mt-0.5">Owner: {v.user_id?.name}</p>
                  </div>

                  {/* Business Metrics */}
                  <div className="hidden lg:grid grid-cols-3 gap-8 px-8 border-x border-[var(--glass-border)]">
                     <div className="text-center">
                        <p className="text-xs font-bold">{v.total_sales || 0}</p>
                        <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-20 tracking-tight">Volume</p>
                     </div>
                     <div className="text-center">
                        <p className="text-xs font-bold">{fmt(v.total_revenue)}</p>
                        <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-20 tracking-tight">Revenue</p>
                     </div>
                     <div className="text-center">
                        <div className="flex items-center gap-1 justify-center">
                           <Star className="size-2 text-amber-500 fill-amber-500" />
                           <p className="text-xs font-bold">{v.rating?.toFixed(1) || '0.0'}</p>
                        </div>
                        <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-20 tracking-tight">Rating</p>
                     </div>
                  </div>

                  <div className="flex items-center gap-6">
                     <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                           <div className={`size-1.5 rounded-full ${v.verified ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                           <span className="text-[11px] font-bold tracking-tight opacity-60">{v.verified ? 'Verified' : 'Pending'}</span>
                        </div>
                        <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-20  mt-0.5 tracking-tight">Merchant State</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleVerify(v._id, v.verified)} className={`size-9 rounded-xl flex items-center justify-center border transition-all ${v.verified ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'}`}>
                           <ShieldCheck className="size-4" />
                        </button>
                        <Link href={`/stores/${v._id}`} className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                           <ExternalLink className="size-4" />
                        </Link>
                        <button className="size-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                           <Ban className="size-4" />
                        </button>
                     </div>
                  </div>
                </div>
              ))}

              <div className="pt-8 flex justify-center">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>

              {filteredVendors.length === 0 && (
                 <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-20">
                    <p className="text-xs font-bold tracking-tight">No merchant nodes synchronized</p>
                 </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
}
