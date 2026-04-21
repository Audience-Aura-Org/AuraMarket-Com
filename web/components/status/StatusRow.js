"use client";
import { motion } from 'framer-motion';
import { Plus, Flame } from 'lucide-react';

/**
 * StatusRow
 * Horizontal scrollable row of vendor avatars with status rings.
 * Shows 'Followed Only' logic in Discovery.
 */
export default function StatusRow({ statuses, onSelect, onAdd, isVendor }) {
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
    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-4 px-2">
      {/* Add Status for Vendor */}
      {isVendor && (
        <button 
          onClick={onAdd}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="size-16 md:size-20 rounded-full border-2 border-dashed border-[var(--glass-border)] flex items-center justify-center group-hover:border-[var(--accent)] transition-all bg-[var(--bg-primary)] shadow-sm">
            <Plus className="size-6 text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">My Status</span>
        </button>
      )}

      {vendors.map(({ vendor, items }) => {
        const logoUrl = vendor.user_id?.branding?.logo || vendor.user_id?.avatar;
        const hasUnviewed = items.some(s => !s.isViewed);

        return (
          <button 
            key={vendor._id}
            onClick={() => onSelect(items)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className={`size-16 md:size-20 rounded-full p-1 border-2 transition-all shadow-md ${hasUnviewed ? 'border-[var(--accent)] animate-pulse' : 'border-[var(--glass-border)] opacity-60'}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                {logoUrl ? (
                  <img src={logoUrl} alt={vendor.store_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-black text-[var(--accent)] bg-[var(--bg-secondary)]">
                    {vendor.store_name?.[0]}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] font-bold text-[var(--text-primary)] truncate w-16 text-center tracking-tight">
              {vendor.store_name}
            </span>
          </button>
        );
      })}

      {vendors.length === 0 && !isVendor && (
        <div 
          onClick={() => {
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
              if (btn.innerText.toUpperCase().includes('STATUS')) btn.click();
            });
          }}
          className="flex-1 min-w-[280px] h-16 md:h-20 rounded-2xl bg-gradient-to-r from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/20 flex items-center gap-4 px-5 cursor-pointer hover:bg-[var(--accent)]/15 transition-all group shrink-0"
        >
          <div className="size-10 md:size-12 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 group-hover:scale-110 transition-transform">
            <Flame className="size-5 md:size-6 text-white" />
          </div>
          <div className="text-left">
            <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight">Explore Trending stories 🔥</p>
            <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest opacity-60">Tap to synchronize nodes</p>
          </div>
        </div>
      )}
    </div>
  );
}
