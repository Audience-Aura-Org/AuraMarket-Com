"use client";
import { useRef, useState, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import BlurUpImage from '@/components/common/BlurUpImage';
import MediaThumbnail from '@/components/common/MediaThumbnail';
import { buildStatusSequences } from '@/components/status/statusSequences';

/**
 * StatusRow — WhatsApp-style horizontal story bubble row.
 * Each bubble shows the vendor's LATEST story thumbnail as a preview ring.
 * Bigger avatars, isolated horizontal scroll (doesn't fight vertical page scroll).
 */
export default function StatusRow({ statuses = [], onSelect, onAdd, isVendor }) {
  const scrollRef = useRef(null);
  const [repliedVendorIds, setRepliedVendorIds] = useState(new Set());

  // Listen for global reply events
  useEffect(() => {
    const handleReply = (e) => {
      const vendorId = e.detail?.sender_id?.vendor_id || e.detail?.sender_id?._id;
      if (vendorId) {
        setRepliedVendorIds(prev => new Set([...prev, vendorId]));
      }
    };
    window.addEventListener('aura_vendor_reply', handleReply);
    return () => window.removeEventListener('aura_vendor_reply', handleReply);
  }, []);

  const vendors = buildStatusSequences(statuses);

  if (vendors.length === 0 && !isVendor) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-end gap-4 overflow-x-auto no-scrollbar py-4 px-5"
      style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x' }}
    >
      {/* Add Story CTA — vendors only */}
      {isVendor && (
        <button
          onClick={onAdd}
          className="flex flex-col items-center gap-2 shrink-0 group active:scale-95 transition-transform duration-100"
        >
          <div className="relative">
            <div className="size-[78px] md:size-[86px] rounded-full p-[2.5px] bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-500 shadow-lg">
              <div className="w-full h-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center">
                <Plus className="size-7 text-[var(--accent)] group-hover:rotate-90 transition-transform duration-200" />
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center shadow-md">
              <Sparkles className="size-3 text-white" />
            </div>
          </div>
          <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight">Add Story</span>
        </button>
      )}

      {/* Vendor story bubbles */}
      {vendors.map(({ vendor, items, latestStory, firstUnviewed, hasUnviewed }) => {
        const logoUrl     = vendor.user_id?.branding?.logo || vendor.user_id?.avatar;
        const storeName   = vendor.store_name || 'Store';
        const displayName = storeName.length > 10 ? storeName.slice(0, 9) + '…' : storeName;
        const previewUrl  = latestStory?.type === 'image' || latestStory?.type === 'video'
          ? latestStory.thumbnail_url || latestStory.content_url
          : null;

        return (
          <StoryBubble
            key={vendor._id}
            logoUrl={logoUrl}
            previewUrl={previewUrl}
            storeName={storeName}
            displayName={displayName}
            hasUnviewed={hasUnviewed}
            hasReply={repliedVendorIds.has(vendor._id)}
            onTap={() => {
              // Clear reply highlight on tap
              if (repliedVendorIds.has(vendor._id)) {
                setRepliedVendorIds(prev => {
                  const next = new Set(prev);
                  next.delete(vendor._id);
                  return next;
                });
              }
              // Resume at the oldest unviewed story, otherwise open the latest one.
              const startId  = (firstUnviewed || latestStory)?._id;
              onSelect(statuses, startId);
            }}
          />
        );
      })}
    </div>
  );
}

function StoryBubble({ logoUrl, previewUrl, storeName, displayName, hasUnviewed, hasReply, onTap }) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center gap-2 shrink-0 group active:scale-95 transition-transform duration-100"
    >
      <div className="relative">
        {/* Outer gradient ring */}
        <div
          className={`size-[78px] md:size-[86px] rounded-full p-[2.5px] transition-all duration-300 relative ${
            hasReply
              ? 'bg-gradient-to-tr from-emerald-400 via-emerald-500 to-teal-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse'
              : hasUnviewed
                ? 'bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-400 shadow-[0_0_16px_rgba(139,92,246,0.4)]'
                : 'bg-[var(--glass-border)] opacity-50 group-hover:opacity-70'
          }`}
        >
          {/* Inner circle — story preview as background + logo on top */}
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--bg-primary)] relative bg-black">
            {/* Latest story thumbnail as background */}
            {previewUrl && (
              <div className="absolute inset-0">
                <MediaThumbnail
                  src={previewUrl}
                  alt=""
                  priority="high"
                  className="w-full h-full"
                  objectFit="cover"
                  imgClassName={`opacity-50 ${!hasUnviewed ? 'grayscale' : ''} group-hover:opacity-70 group-hover:scale-110 transition-all duration-500`}
                />
              </div>
            )}

            {/* Vendor logo — centered on top of preview */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-9 md:size-10 rounded-full overflow-hidden border-2 border-white/30 shadow-xl bg-black">
                {logoUrl ? (
                  <BlurUpImage
                    src={logoUrl}
                    alt={storeName}
                    priority="high"
                    className="w-full h-full rounded-full"
                    imgClassName={`${!hasUnviewed ? 'grayscale group-hover:grayscale-0' : ''} transition-all duration-300`}
                    objectFit="cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm  font-bold text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">
                    {storeName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Unread indicator dot */}
        {hasUnviewed && (
          <div className="absolute top-0.5 right-0.5 size-4 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] shadow-md" />
        )}
      </div>

      <span className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] truncate w-[74px] md:w-[82px] text-center tracking-tight group-hover:text-[var(--accent)] transition-colors">
        {displayName}
      </span>
    </button>
  );
}
