"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Search, X, ChevronRight, Package, 
  Star, MapPin, CheckCircle2, ArrowLeft,
  Heart, ShoppingCart, MessageCircle, RefreshCw
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { useLanguage } from '@/context/LanguageContext';

import Pagination from '@/components/common/Pagination';

const getVendorId = (vendor) => (vendor?.vendor_id?._id || vendor?.vendor_id || vendor?._id)?.toString();
const getVendorUserId = (vendor) => (vendor?.user_id?._id || vendor?.user_id || vendor?.vendor_id?.user_id?._id || vendor?.vendor_id?.user_id)?.toString();
const getVendorName = (vendor) => vendor?.store_name || vendor?.vendor_id?.store_name || 'Store';
const getVendorDescription = (vendor) => vendor?.description || vendor?.vendor_id?.description || '';
const getStoreHref = (vendorId) => `/stores?id=${encodeURIComponent(vendorId)}`;

/**
 * VendorListPanel
 * WhatsApp-style vendor list. Each vendor acts like a chat contact.
 * Clicking a vendor slides in a VendorStorefront panel with their products.
 */
export default function VendorListPanel({ onOpenChat, followedStatuses = [], onOpenStatus }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const { openChat } = useChat();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendors');
      if (res.data.success) {
        // Backend returns { success: true, count: X, data: { stores: [] } }
        const stores = res.data.data?.stores || res.data.data?.vendors || res.data.stores || [];
        setVendors(stores);
      }
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    window.addEventListener('online', fetchVendors);
    return () => window.removeEventListener('online', fetchVendors);
  }, [fetchVendors]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const { followedVendorIds } = useAuthStore();

  const filtered = vendors.filter(v => {
    const vendorId = getVendorId(v);
    // 1. Must be in followed list
    if (!followedVendorIds.map(String).includes(vendorId)) return false;

    // 2. Search filter
    const name = getVendorName(v);
    const desc = getVendorDescription(v);
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentVendors = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col"
    >
      {/* Search */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)] px-4 py-3 border-b border-[var(--glass-border)]/50">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('vendor.searchPlaceholder', 'Search vendors...')}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2.5 pl-10 pr-10 !text-base placeholder:!text-base font-medium focus:ring-1 focus:ring-[var(--accent)] outline-none placeholder:text-[var(--text-secondary)]/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Vendor List */}
      <div className="pb-20">
        {loading ? (
          // Skeleton loaders
          [...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--glass-border)]/30 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 bg-[var(--bg-secondary)] rounded" />
                <div className="h-2.5 w-40 bg-[var(--bg-secondary)] rounded" />
              </div>
              <div className="h-2 w-8 bg-[var(--bg-secondary)] rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="size-16 rounded-full bg-[var(--accent)]/5 flex items-center justify-center mb-4">
               <MessageCircle className="w-8 h-8 text-[var(--accent)] opacity-20" />
            </div>
            <p className=" font-bold text-[var(--text-primary)]  tracking-tighter text-base">{t('vendor.circleEmpty', 'Your Circle is Empty')}</p>
            <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-50 mt-2 max-w-[220px] mx-auto font-medium">
              {t('vendor.circleEmptyDetail', 'Only vendors you follow appear here for quick chat access. Explore the marketplace to find stores you like.')}
            </p>
            <button 
              onClick={() => router.push('/shop')}
              className="mt-6 px-6 py-2 bg-[var(--accent)] text-white text-[11px] lg:text-[12px]  font-semibold tracking-tight rounded-full shadow-lg"
            >
              {t('vendor.exploreShop', 'Explore Shop')}
            </button>
          </div>
        ) : (
          <>
            {currentVendors.map((vendor, i) => {
              const vendorId = getVendorId(vendor);
              const userId = getVendorUserId(vendor);
              return (
                <VendorRow
                  key={vendorId}
                  vendor={vendor}
                  index={i}
                  hasStatus={followedStatuses.some(s => (s.vendor_id?._id || s.vendor_id)?.toString() === vendorId)}
                  onOpenStatus={() => onOpenStatus(vendorId)}
                  onOpenChat={(vData) => openChat(userId, null, vData)}
                  onClick={() => router.push(getStoreHref(vendorId))}
                  t={t}
                />
              );
            })}
            
            {totalPages > 1 && (
              <div className="py-8 px-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>


    </motion.div>
  );
}

function formatLastSeen(lastSeenVal, t) {
  if (!lastSeenVal) return t('time.recently', 'recently');
  const date = new Date(lastSeenVal);
  if (isNaN(date.getTime())) return t('time.recently', 'recently');
  
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 0) return t('time.justNow', 'just now');
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('time.justNow', 'just now');
  if (diffMins < 60) return t('time.minutesAgoShort', '{count}m ago', { count: diffMins });
  if (diffHours < 24) return t('time.hoursAgoShort', '{count}h ago', { count: diffHours });
  if (diffDays === 1) return t('time.yesterday', 'yesterday');
  if (diffDays < 7) return t('time.daysAgoShort', '{count}d ago', { count: diffDays });
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function VendorRow({ vendor, index, onClick, onOpenChat, hasStatus, onOpenStatus, t }) {
  const { onlineUsersMap } = useChat();
  const userInfo = vendor.user_id || vendor.vendor_id?.user_id || {};
  const storeInfo = vendor.store || vendor;
  const storeName = getVendorName(vendor);
  const logoUrl = storeInfo.logo || userInfo?.branding?.logo || userInfo?.avatar || vendor.logo?.url;
  
  const userId = getVendorUserId(vendor);
  const liveOnline = userId ? onlineUsersMap[userId] : undefined;
  const isOnline = typeof liveOnline === 'boolean' ? liveOnline : (userInfo?.is_online ?? false);
  const lastSeen = formatLastSeen(userInfo?.last_seen, t);
  const snippet = vendor.latest_product?.name || getVendorDescription(vendor) || t('vendor.browseCatalog', 'Browse our latest catalog');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[var(--accent)]/5 active:bg-[var(--accent)]/10 border-b border-[var(--glass-border)]/20 transition-all text-left group cursor-pointer"
    >
      {/* WhatsApp-style Avatar with status bubble */}
      <div className="relative shrink-0" onClick={(e) => { if (hasStatus) { e.stopPropagation(); onOpenStatus(); } }}>
        <div className={`w-14 h-14 rounded-full bg-[var(--bg-secondary)] overflow-hidden border-2 transition-all shadow-sm ${hasStatus ? 'border-[var(--accent)] p-0.5' : 'border-[var(--glass-border)] group-hover:border-[var(--accent)]/30'}`}>
          <div className="size-full rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl  font-bold text-[var(--accent)]">
                {storeName?.[0]?.toUpperCase() || 'S'}
              </div>
            )}
          </div>
        </div>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[var(--bg-primary)] shadow-sm" />
        )}
      </div>

      {/* Contact Info (WhatsApp Style) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className=" font-bold text-base text-[var(--text-primary)] truncate">
            {storeName}
          </h3>
          <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight whitespace-nowrap">
            {isOnline ? t('presence.online', 'Online') : lastSeen}
          </span>
        </div>
        
        <p className="text-[12px] text-[var(--text-secondary)] opacity-60 truncate font-medium">
          “{snippet}”
        </p>
        
        <div className="flex items-center gap-1.5 mt-1">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[11px] lg:text-[12px]  font-semibold text-emerald-500  tracking-tighter">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              {t('presence.available', 'Available')}
            </span>
          ) : (
            <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40  tracking-tighter">
              {t('vendor.repliesFast', 'Replies fast')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onOpenChat({ store_name: storeName, branding: { logo: logoUrl } }); }}
          className="p-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
        >
          <MessageCircle className="size-4" />
        </button>
        <ChevronRight className="w-4 h-4 text-[var(--accent)] transition-all" />
      </div>
    </motion.div>
  );
}


