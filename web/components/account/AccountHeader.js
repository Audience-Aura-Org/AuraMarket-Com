"use client";

import { ArrowLeft, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function AccountHeader({ profileBranding, canUseBanner, onBannerUpload }) {
  const router = useRouter();
  const { user } = useAuthStore();

  const displayName = user?.name || 'Aura User';
  const avatarSrc = profileBranding?.logo || user?.branding?.logo || user?.avatar;
  const bannerSrc = profileBranding?.banner || user?.branding?.banner;
  const storeName = user?.branding?.store_name || user?.store_name;
  const bio = user?.branding?.description || user?.store_description || null;

  return (
    <div className="relative bg-[var(--bg-primary)]">
      {/* ── Banner ── */}
      <div className="relative h-40 sm:h-52 overflow-hidden bg-gradient-to-br from-[var(--accent)] via-indigo-600 to-purple-700">
        {bannerSrc && (
          <img
            src={bannerSrc}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/60" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 size-9 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/50 transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Banner upload — vendors / logistics only */}
        {canUseBanner && onBannerUpload && (
          <label className="absolute top-4 right-4 size-9 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/50 transition-all cursor-pointer active:scale-95">
            <Camera className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onBannerUpload(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {/* ── Avatar + identity — overlaps banner ── */}
      <div className="flex flex-col items-center -mt-10 pb-5 px-4">
        {/* Circular avatar */}
        <div className="size-20 sm:size-24 rounded-full overflow-hidden border-4 border-[var(--bg-primary)] shadow-xl bg-[var(--bg-secondary)] shrink-0">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full flex items-center justify-center text-2xl font-black text-[var(--accent)] bg-[var(--accent)]/10">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <h1 className="mt-3 text-[18px] sm:text-[20px] font-black text-[var(--text-primary)] tracking-tight text-center leading-tight">
          {storeName || displayName}
        </h1>

        {/* Role chip */}
        <span className="mt-1.5 px-3 py-0.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-bold uppercase tracking-widest">
          {user?.role || 'user'}
        </span>

        {/* Bio / store description */}
        {bio && (
          <p className="mt-2 text-[12px] sm:text-[13px] text-[var(--text-secondary)] text-center max-w-xs leading-relaxed">
            {bio}
          </p>
        )}
      </div>
    </div>
  );
}
