"use client";
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';

/**
 * StatusRow
 * Premium horizontal story bubble row — Instagram-meets-Aura aesthetic.
 * Gradient rings for unseen, greyscale for seen, vendor avatar with store name.
 */
export default function StatusRow({ statuses = [], onSelect, onAdd, isVendor }) {
  const scrollRef = useRef(null);

  // Group statuses by vendor
  const vendorMap = statuses.reduce((acc, status) => {
    const vId = status.vendor_id?._id;
    if (!vId) return acc;
    if (!acc[vId]) acc[vId] = { vendor: status.vendor_id, items: [] };
    acc[vId].items.push(status);
    return acc;
  }, {});

  const vendors = Object.values(vendorMap);

  return (
    <div
      ref={scrollRef}
      className="flex items-end gap-4 overflow-x-auto no-scrollbar py-4 px-4"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {/* Add Status CTA for Vendors */}
      {isVendor && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={onAdd}
          className="flex flex-col items-center gap-2 shrink-0 group"
          style={{ scrollSnapAlign: 'start' }}
        >
          {/* Ring with add icon */}
          <div className="relative">
            <div className="size-[60px] md:size-[68px] rounded-full p-[2.5px] bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-500 shadow-lg shadow-[var(--accent)]/25 group-hover:shadow-[var(--accent)]/50 transition-all duration-300">
              <div className="w-full h-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center">
                <Plus className="size-5 md:size-6 text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300" />
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center shadow-md">
              <Sparkles className="size-2.5 text-white" />
            </div>
          </div>
          <span className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest">Add Story</span>
        </motion.button>
      )}

      {/* Vendor Status Bubbles */}
      {vendors.map(({ vendor, items }, i) => {
        const logoUrl = vendor.user_id?.branding?.logo || vendor.user_id?.avatar;
        const hasUnviewed = items.some(s => !s.isViewed);
        const storeName = vendor.store_name || 'Store';

        return (
          <motion.button
            key={vendor._id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: i * 0.04 }}
            onClick={() => {
              const others = statuses.filter(s => s.vendor_id?._id !== vendor._id);
              onSelect([...items, ...others]);
            }}
            className="flex flex-col items-center gap-2 shrink-0 group"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="relative">
              {/* Gradient ring for unseen / grey for seen */}
              <div className={`size-[60px] md:size-[68px] rounded-full p-[2.5px] transition-all duration-300 ${
                hasUnviewed
                  ? 'bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-400 shadow-md shadow-[var(--accent)]/30 group-hover:shadow-[var(--accent)]/60'
                  : 'bg-[var(--glass-border)] opacity-50 group-hover:opacity-70'
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--bg-primary)]">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={storeName}
                      className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${
                        !hasUnviewed ? 'grayscale' : ''
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">
                      {storeName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              {/* Unviewed dot */}
              {hasUnviewed && (
                <div className="absolute top-0 right-0 size-3.5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] shadow-sm" />
              )}
            </div>
            <span className="text-[9px] font-black text-[var(--text-primary)] truncate w-14 md:w-16 text-center tracking-tight group-hover:text-[var(--accent)] transition-colors">
              {storeName.length > 9 ? storeName.slice(0, 8) + '…' : storeName}
            </span>
          </motion.button>
        );
      })}

    </div>
  );
}
