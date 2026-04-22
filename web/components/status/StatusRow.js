"use client";
import { useRef } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import BlurUpImage from '@/components/common/BlurUpImage';

/**
 * StatusRow — WhatsApp-style horizontal story bubble row.
 * - Avatars never block tapping: clicking works before image finishes loading
 * - No framer-motion overhead on each bubble (pure CSS)
 * - Shimmer pulse on avatar while it loads
 * - Seen stories: greyscale + muted ring
 * - Unseen stories: gradient ring with subtle glow pulse
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
      className="flex items-end gap-3 overflow-x-auto no-scrollbar py-3 px-4"
    >
      {/* Add Story CTA */}
      {isVendor && (
        <button
          onClick={onAdd}
          className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform duration-100"
        >
          <div className="relative">
            <div className="size-[60px] md:size-[66px] rounded-full p-[2.5px] bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-500 shadow-md">
              <div className="w-full h-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center">
                <Plus className="size-5 md:size-6 text-[var(--accent)] group-hover:rotate-90 transition-transform duration-200" />
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center shadow-md">
              <Sparkles className="size-2.5 text-white" />
            </div>
          </div>
          <span className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest">Add Story</span>
        </button>
      )}

      {/* Vendor bubbles */}
      {vendors.map(({ vendor, items }) => {
        const logoUrl = vendor.user_id?.branding?.logo || vendor.user_id?.avatar;
        const hasUnviewed = items.some(s => !s.isViewed);
        const storeName = vendor.store_name || 'Store';
        const displayName = storeName.length > 9 ? storeName.slice(0, 8) + '…' : storeName;

        return (
          <StoryBubble
            key={vendor._id}
            logoUrl={logoUrl}
            storeName={storeName}
            displayName={displayName}
            hasUnviewed={hasUnviewed}
            onTap={() => {
              const others = statuses.filter(s => s.vendor_id?._id !== vendor._id);
              onSelect([...items, ...others]);
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * StoryBubble — individual story avatar.
 * BlurUpImage gives WhatsApp-style blur-up: taps work instantly,
 * blurred placeholder appears immediately, sharp fades in.
 */
function StoryBubble({ logoUrl, storeName, displayName, hasUnviewed, onTap }) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform duration-100"
    >
      <div className="relative">
        {/* Gradient ring */}
        <div
          className={`size-[60px] md:size-[66px] rounded-full p-[2.5px] transition-opacity duration-300 ${
            hasUnviewed
              ? 'bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-400 shadow-[0_0_12px_rgba(var(--accent-rgb,139,92,246),0.35)]'
              : 'bg-[var(--glass-border)] opacity-40 group-hover:opacity-60'
          }`}
        >
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--bg-primary)]">
            {logoUrl ? (
              <BlurUpImage
                src={logoUrl}
                alt={storeName}
                priority="high"
                className="w-full h-full rounded-full"
                imgClassName={!hasUnviewed ? 'grayscale group-hover:grayscale-0 transition-all duration-300' : 'group-hover:scale-110 transition-transform duration-300'}
                objectFit="cover"
              />
            ) : (
              // Fallback letter avatar — always instant
              <div className="w-full h-full flex items-center justify-center text-base font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">
                {storeName[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Unread dot */}
        {hasUnviewed && (
          <div className="absolute top-0 right-0 size-3.5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] shadow-sm" />
        )}
      </div>

      <span className="text-[9px] font-black text-[var(--text-primary)] truncate w-14 md:w-16 text-center tracking-tight group-hover:text-[var(--accent)] transition-colors">
        {displayName}
      </span>
    </button>
  );
}
