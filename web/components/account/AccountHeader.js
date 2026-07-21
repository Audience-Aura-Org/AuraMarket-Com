"use client";

import { ArrowLeft, Camera, BadgeCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function AccountHeader({ profileBranding, canUseBanner, onBannerUpload, storeName, storeDescription }) {
  const router = useRouter();
  const { user } = useAuthStore();

  const displayName = user?.name || 'Aura User';
  const avatarSrc = profileBranding?.logo || user?.branding?.logo || user?.avatar;
  const bannerSrc = profileBranding?.banner || user?.branding?.banner;
  const isVerified =
    user?.kyc?.status === 'approved' ||
    user?.verification_status === 'approved' ||
    user?.verification_status === 'verified';

  const subtitle = storeName || user?.branding?.store_name || null;

  return (
    <div className="bg-[var(--bg-primary)]">
      {/* ── Banner ── */}
      <div className="relative h-36 sm:h-44 overflow-hidden bg-gradient-to-br from-[var(--accent)] via-indigo-600 to-purple-700">
        {bannerSrc ? (
          <img src={bannerSrc} alt="" className="absolute inset-0 size-full object-cover" />
        ) : !canUseBanner ? (
          /* Customer gradient with subtle noise overlay */
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/90 via-indigo-500/80 to-purple-600/90" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50 pointer-events-none" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 size-9 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/50 transition-all active:scale-95 z-10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Banner upload — vendors/logistics only */}
        {onBannerUpload && canUseBanner && (
          <label className="absolute top-4 right-4 size-9 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/50 transition-all cursor-pointer active:scale-95 z-10">
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

      {/* ── Avatar + info ── */}
      <div className="px-4 pb-4 border-b border-[var(--glass-border)]">
        {/* Avatar — overlaps banner with negative margin */}
        <div className="-mt-[2.75rem] mb-3">
          <div className="size-[72px] sm:size-20 rounded-full border-[3px] border-[var(--bg-primary)] shadow-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center text-2xl font-black text-[var(--accent)] bg-[var(--accent)]/10">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name + verified badge */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <h1 className="text-[19px] font-black text-[var(--text-primary)] truncate leading-tight">{displayName}</h1>
          {isVerified && (
            <BadgeCheck className="size-5 shrink-0 fill-blue-500 text-white" />
          )}
        </div>

        {/* Subtitle: store name or role */}
        <p className="text-[12px] font-semibold text-[var(--text-secondary)] capitalize leading-tight">
          {subtitle ? subtitle : `${user?.role || 'user'} account`}
        </p>

        {/* Store description / bio */}
        {storeDescription && (
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]/75 leading-relaxed line-clamp-2">
            {storeDescription}
          </p>
        )}
      </div>
    </div>
  );
}
