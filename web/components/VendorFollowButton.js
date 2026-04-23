"use client";

import { useFollow } from '@/hooks/useFollow';
import { Check } from 'lucide-react';

/**
 * VendorFollowButton
 * A dynamic, state-synchronized follow button for vendors.
 * Handles API calls and global store updates via the useFollow hook.
 */
export default function VendorFollowButton({ vendorId, className = "" }) {
  const { isFollowing, toggleFollow, loading } = useFollow(vendorId);
  
  if (!vendorId) return null;

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow();
      }}
      disabled={loading}
      className={`px-6 h-10 md:h-11 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-none ${
        isFollowing 
        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20' 
        : 'bg-[var(--accent)] text-white hover:brightness-110 shadow-lg shadow-[var(--accent)]/20 border border-[var(--accent)]'
      } ${className}`}
    >
      {isFollowing ? (
        <>
          <Check className="size-3" />
          Following
        </>
      ) : '+ Follow'}
    </button>
  );
}
