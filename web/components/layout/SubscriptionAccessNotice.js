"use client";

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, Clock3, ShieldCheck, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/services/api';

const HIDE_MS = 6 * 60 * 60 * 1000;
const hideKeyFor = (userId, type) => `aura_notice_hidden:${userId || 'guest'}:${type}`;

export default function SubscriptionAccessNotice({ disabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const user = useAuthStore((state) => state.user);

  const [subNotice, setSubNotice] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState({});

  const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
  const isAuthRoute =
    normalizedPath === '/' ||
    normalizedPath.startsWith('/auth') ||
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
    normalizedPath === '/register' ||
    normalizedPath === '/onboarding';
  const isImmersiveChat = normalizedPath === '/chat' || normalizedPath === '/messages';
  const isSubscribePage = normalizedPath === '/subscribe';

  /* ── Subscription check ─────────────────────────────────────── */
  useEffect(() => {
    const handleEvent = (e) => setSubNotice(e.detail?.data || e.detail || null);
    window.addEventListener('aura:subscription-required', handleEvent);
    return () => window.removeEventListener('aura:subscription-required', handleEvent);
  }, [user?._id]);

  useEffect(() => {
    if (disabled || !user?._id || !user?.role || user.role === 'admin' || isAuthRoute || isImmersiveChat || isSubscribePage) {
      setSubNotice(null);
      return;
    }
    let cancelled = false;
    api.get('/subscriptions/me', { params: { role: user.role }, skipClientCache: true, silent: true })
      .then((res) => { if (!cancelled) setSubNotice(res.data?.data || null); })
      .catch(() => { if (!cancelled) setSubNotice(null); });
    return () => { cancelled = true; };
  }, [disabled, user?._id, user?.role, normalizedPath, isAuthRoute, isImmersiveChat, isSubscribePage]);

  /* ── Build notice list ──────────────────────────────────────── */
  const notices = [];

  // 1. Subscription grace / limited
  const subRequired = subNotice?.required && !subNotice?.subscribed && (subNotice?.grace || subNotice?.limited);
  if (subRequired) {
    const role = subNotice.role || user?.role || 'vendor';
    const isGrace = subNotice.access_state === 'grace' || subNotice.grace;
    const isVendorRole = role === 'vendor';
    notices.push({
      id: 'subscription',
      Icon: isGrace ? Clock3 : AlertTriangle,
      title: isGrace
        ? t('subscription.graceTitle', 'Subscription grace active')
        : t('subscription.limitedTitle', 'Limited access mode'),
      badge: isGrace ? t('subscription.noticeWarning', 'Action needed') : t('subscription.noticeCritical', 'Restricted'),
      detail: isGrace
        ? (isVendorRole
            ? t('subscription.vendorGraceInline', 'Your vendor tools are available during grace. Activate a package to keep selling without interruption.')
            : t('subscription.graceDetail', 'You can keep using your workspace during this grace period. Activate a package before it ends.'))
        : t('subscription.limitedDetail', 'Subscription-gated actions are paused until you activate a package.'),
      ctaLabel: t('subscription.subscribeCta', 'Subscribe'),
      ctaAction: () => router.push(`/subscribe?role=${encodeURIComponent(role)}`),
      colors: isGrace
        ? { shell: 'border-amber-500/20 bg-amber-500/5', wash: 'from-amber-500/10', icon: 'bg-amber-500/10 text-amber-400 border-amber-500/20', cta: 'bg-amber-500 shadow-amber-500/20', badge: 'bg-amber-500/15 text-amber-500' }
        : { shell: 'border-rose-500/20 bg-rose-500/5', wash: 'from-rose-500/10', icon: 'bg-rose-500/10 text-rose-400 border-rose-500/20', cta: 'bg-rose-500 shadow-rose-500/20', badge: 'bg-rose-500/15 text-rose-500' },
    });
  }

  // 2. Verification / KYC pending
  const kycStatus = user?.kyc?.status || user?.verification_status;
  const verificationPending = kycStatus === 'pending' || kycStatus === 'submitted' || kycStatus === 'under_review';
  if (verificationPending && !isAuthRoute && !isImmersiveChat) {
    notices.push({
      id: 'verification',
      Icon: ShieldCheck,
      title: t('verification.pendingTitle', 'Verification pending'),
      badge: t('subscription.noticeWarning', 'Action needed'),
      detail: t('verification.pendingDetail', 'Your vendor tools are available during grace. Activate a package to keep selling without interruption.'),
      ctaLabel: t('verification.viewStatus', 'Open verification'),
      ctaAction: () => router.push('/profile?tab=kyc'),
      colors: {
        shell: 'border-amber-500/20 bg-amber-500/5',
        wash: 'from-amber-500/10',
        icon: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        cta: 'bg-amber-500 shadow-amber-500/20',
        badge: 'bg-amber-500/15 text-amber-500',
      },
    });
  }

  /* ── Dismissal ──────────────────────────────────────────────── */
  const isDismissed = useCallback((id) => {
    if (dismissed[id]) return true;
    const until = Number(window.localStorage?.getItem(hideKeyFor(user?._id, id)) || 0);
    return until > Date.now();
  }, [dismissed, user?._id]);

  const visibleNotices = notices.filter((n) => !isDismissed(n.id));

  const dismiss = (id) => {
    window.localStorage?.setItem(hideKeyFor(user?._id, id), String(Date.now() + HIDE_MS));
    setDismissed((p) => ({ ...p, [id]: true }));
  };

  // Auto-advance carousel every 6s when multiple notices
  useEffect(() => {
    if (visibleNotices.length <= 1) return;
    const timer = setInterval(() => setActiveIndex((i) => (i + 1) % visibleNotices.length), 6000);
    return () => clearInterval(timer);
  }, [visibleNotices.length]);

  if (disabled || visibleNotices.length === 0 || isAuthRoute || isImmersiveChat || isSubscribePage) return null;

  const safeIndex = activeIndex % visibleNotices.length;
  const notice = visibleNotices[safeIndex];
  const { Icon, title, badge, detail, ctaLabel, ctaAction, colors } = notice;
  const multi = visibleNotices.length > 1;

  return (
    <div className="w-full border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/65 px-2 py-2 sm:px-3">
      <div className={`relative mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 overflow-hidden rounded-2xl border p-3 shadow-xl backdrop-blur-2xl sm:flex-row sm:gap-5 sm:p-4 ${colors.shell}`}>
        {/* Colour wash */}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${colors.wash} to-transparent`} />

        {/* Icon + text */}
        <div className="relative flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg sm:size-12 ${colors.icon}`}>
            <Icon className="size-5 sm:size-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-bold tracking-tight sm:text-base">{title}</p>
              <span className={`hidden rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide sm:inline-flex ${colors.badge}`}>
                {badge}
              </span>
            </div>
            <p className="line-clamp-2 max-w-2xl text-[11px] font-medium leading-relaxed tracking-tight text-[var(--text-secondary)] opacity-70 sm:text-xs">
              {detail}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="relative flex w-full shrink-0 items-center gap-2 sm:w-auto">
          {/* Carousel dots + nav */}
          {multi && (
            <div className="flex items-center gap-1.5 mr-1">
              <button onClick={() => setActiveIndex((i) => (i - 1 + visibleNotices.length) % visibleNotices.length)}
                className="size-6 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 flex items-center justify-center hover:bg-[var(--bg-secondary)] transition">
                <ChevronLeft className="size-3" />
              </button>
              {visibleNotices.map((_, i) => (
                <button key={i} onClick={() => setActiveIndex(i)}
                  className={`size-1.5 rounded-full transition-all ${i === safeIndex ? 'bg-[var(--text-primary)] scale-125' : 'bg-[var(--glass-border)]'}`} />
              ))}
              <button onClick={() => setActiveIndex((i) => (i + 1) % visibleNotices.length)}
                className="size-6 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 flex items-center justify-center hover:bg-[var(--bg-secondary)] transition">
                <ChevronRight className="size-3" />
              </button>
            </div>
          )}

          <button type="button" onClick={ctaAction}
            className={`flex h-10 flex-1 items-center justify-center rounded-xl px-5 text-xs font-bold tracking-tight text-white shadow-xl transition active:scale-95 sm:flex-none sm:px-7 ${colors.cta}`}>
            {ctaLabel}
          </button>
          <button type="button" onClick={() => dismiss(notice.id)}
            className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 px-3 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-secondary)] active:scale-95">
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
