"use client";

import { ArrowLeft, Camera, Share2, Users, ShieldCheck, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function AccountHeader({
  profileBranding,
  canUseBanner,
  onBannerUpload,
  storeName,
  storeDescription,
  followerCount = 0,
  rating = 0,
  onShare,
}) {
  const router = useRouter();
  const { user } = useAuthStore();

  const displayName = user?.name || 'Aura User';
  const avatarSrc = profileBranding?.logo || user?.branding?.logo || user?.avatar;
  const bannerSrc = profileBranding?.banner || user?.branding?.banner;
  const isVerified =
    user?.kyc?.status === 'approved' ||
    user?.verification_status === 'approved' ||
    user?.verification_status === 'verified';

  const headingName = storeName || user?.branding?.store_name || displayName;

  return (
    <div className="bg-[var(--bg-secondary)]">
      {/* ── Banner ── */}
      <div className="relative h-44 sm:h-60 w-full overflow-hidden">
        {bannerSrc ? (
          <img src={bannerSrc} className="w-full h-full object-cover brightness-[0.8]" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)] via-indigo-600 to-purple-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)]/20 to-transparent pointer-events-none" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 size-9 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/50 transition-all active:scale-95 z-10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Banner upload (vendors/logistics only) */}
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

      {/* ── Identity Card (overlaps banner) ── */}
      <div className="relative z-10 -mt-8 px-3 sm:px-5 lg:px-8 pb-1">
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-2xl shadow-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start">

            {/* Logo / Avatar */}
            <div className="size-20 sm:size-24 rounded-2xl border-2 border-[var(--bg-primary)] overflow-hidden shadow-lg shrink-0 bg-[var(--bg-secondary)]">
              {avatarSrc ? (
                <img src={avatarSrc} className="size-full object-cover" alt="" />
              ) : (
                <div className="size-full flex items-center justify-center text-2xl font-black text-[var(--accent)] bg-[var(--accent)]/10">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + stat chips */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-[18px] sm:text-xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                {headingName}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                {/* Followers — vendors only; regular users cannot be followed */}
                {user?.role === 'vendor' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)]">
                    <Users className="size-3 text-[var(--accent)]" />
                    {followerCount >= 1000
                      ? `${(followerCount / 1000).toFixed(1)}k`
                      : followerCount} followers
                  </span>
                )}

                {/* Rating (vendors only) */}
                {Number(rating) > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/15 text-[11px] font-semibold text-[var(--text-primary)]">
                    <Star className="size-3 text-[var(--accent)] fill-[var(--accent)]" />
                    {Number(rating).toFixed(1)}
                  </span>
                )}

                {/* Verified */}
                {isVerified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-[11px] font-semibold text-emerald-600">
                    <ShieldCheck className="size-3" />
                    Verified
                  </span>
                )}
              </div>

              {/* Store description / bio */}
              {storeDescription && (
                <p className="mt-2 text-[12px] text-[var(--text-secondary)]/75 leading-relaxed line-clamp-2 text-center sm:text-left">
                  {storeDescription}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-row sm:flex-col items-stretch gap-2 w-full sm:w-auto shrink-0 sm:min-w-[120px]">
              <button
                onClick={onShare}
                className="h-10 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all flex items-center justify-center gap-1.5 text-[11px] font-semibold flex-1 sm:flex-none"
              >
                Share
                <Share2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
