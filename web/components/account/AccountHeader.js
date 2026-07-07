"use client";

import { ArrowLeft, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function AccountHeader({ title = "Account Settings", profileBranding, canUseBanner, onBannerUpload }) {
  const router = useRouter();
  const { user } = useAuthStore();

  const displayName = user?.name || 'Aura User';
  const avatarSrc = profileBranding?.logo || user?.branding?.logo || user?.avatar;
  const bannerSrc = profileBranding?.banner || user?.branding?.banner;

  return (
    <div className="sticky top-0 z-50 lg:top-0 max-lg:top-14">
      {/* Hero Banner Layer — vendors and logistics only */}
      {canUseBanner && (
        <div className="relative h-28 md:h-32 overflow-hidden bg-gradient-to-br from-[var(--accent)] via-indigo-600 to-purple-700">
          {bannerSrc && (
            <img
              src={bannerSrc}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />

          {/* Back button overlay */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 size-9 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/50 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Banner upload */}
          {onBannerUpload && (
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
      )}

      {/* Customer header — single compact row with back + avatar + name */}
      {!canUseBanner && (
        <div className="relative overflow-hidden border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/7 to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="size-9 flex items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="size-9 rounded-xl overflow-hidden border border-[var(--glass-border)] shrink-0 bg-[var(--bg-secondary)]">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-[13px] font-bold text-[var(--accent)] bg-[var(--accent)]/10">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">{displayName}</p>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] capitalize opacity-60 leading-tight">{user?.role || 'user'} account</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-bold uppercase tracking-wide">
              {user?.role || 'user'}
            </span>
          </div>
        </div>
      )}

      {/* Name bar — shown below vendor/logistics banner */}
      {canUseBanner && (
        <div className="bg-[var(--bg-primary)]/95 backdrop-blur-2xl border-b border-[var(--glass-border)] px-4 py-2.5 flex items-center gap-3">
          <div className="size-8 rounded-xl overflow-hidden border border-[var(--glass-border)] shrink-0 bg-[var(--bg-secondary)]">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center text-sm font-bold text-[var(--accent)] bg-[var(--accent)]/10">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">{displayName}</p>
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] capitalize opacity-60 leading-tight">{user?.role || 'user'} account</p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-bold uppercase tracking-wide">
            {user?.role || 'user'}
          </span>
        </div>
      )}
    </div>
  );
}
