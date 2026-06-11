"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, Clock3 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/services/api';

const HIDE_MS = 6 * 60 * 60 * 1000;
const hideKeyFor = (userId, role, state) => `aura_subscription_notice_hidden:${userId || 'guest'}:${role || 'role'}:${state || 'state'}`;

export default function SubscriptionAccessNotice({ disabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [hideKey, setHideKey] = useState(null);

  const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
  const isAuthRoute =
    normalizedPath === '/' ||
    normalizedPath.startsWith('/auth') ||
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
    normalizedPath === '/register' ||
    normalizedPath === '/onboarding';
  const isImmersiveChat = normalizedPath === '/chat' || normalizedPath === '/messages';

  const applyNotice = (data) => {
    if (!data?.required || data.subscribed || (!data.grace && !data.limited)) {
      setNotice(null);
      setHidden(false);
      setHideKey(null);
      return;
    }
    const role = data.role || user?.role;
    const state = data.access_state || (data.grace ? 'grace' : 'limited');
    const nextKey = hideKeyFor(user?._id, role, state);
    const hiddenUntil = Number(window.localStorage.getItem(nextKey) || 0);
    setNotice(data);
    setHideKey(nextKey);
    setHidden(hiddenUntil > Date.now());
  };

  useEffect(() => {
    const handleSubscriptionRequired = (event) => {
      applyNotice(event.detail?.data || event.detail || null);
    };

    window.addEventListener('aura:subscription-required', handleSubscriptionRequired);
    return () => window.removeEventListener('aura:subscription-required', handleSubscriptionRequired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.role]);

  useEffect(() => {
    let cancelled = false;
    const shouldCheck =
      !disabled &&
      user?._id &&
      user?.role &&
      user.role !== 'admin' &&
      !isAuthRoute &&
      !isImmersiveChat &&
      normalizedPath !== '/subscribe';

    if (!shouldCheck) {
      setNotice(null);
      setHideKey(null);
      return undefined;
    }

    const loadStatus = async () => {
      try {
        const res = await api.get('/subscriptions/me', {
          params: { role: user.role },
          skipClientCache: true,
          silent: true,
        });
        if (cancelled) return;
        const data = res.data?.data;
        applyNotice(data);
      } catch {
        if (!cancelled) setNotice(null);
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [disabled, user?._id, user?.role, normalizedPath, isAuthRoute, isImmersiveChat]);

  if (disabled || hidden || !notice?.required || isAuthRoute || isImmersiveChat || normalizedPath === '/subscribe') {
    return null;
  }

  const role = notice.role || user?.role || 'vendor';
  const isGrace = notice.access_state === 'grace' || notice.grace;
  const isVendor = role === 'vendor';
  const title = isGrace
    ? t('subscription.graceTitle', 'Subscription grace active')
    : t('subscription.limitedTitle', 'Limited access mode');
  const detail = isGrace
    ? (isVendor
        ? t('subscription.vendorGraceInline', 'Your vendor tools are available during grace. Activate a package to keep selling without interruption.')
        : t('subscription.graceDetail', 'You can keep using your workspace during this grace period. Activate a package before it ends to keep full access.'))
    : t('subscription.limitedDetail', 'You can still view your dashboard, but subscription-gated actions are paused until you activate a package.');

  const Icon = isGrace ? Clock3 : AlertTriangle;
  const severity = isGrace
    ? {
        shell: 'border-amber-500/15 bg-[var(--bg-primary)]/45 text-[var(--text-primary)]',
        wash: 'from-amber-500/10',
        icon: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10',
        action: 'bg-amber-500 shadow-amber-500/20 hover:opacity-90',
        soft: 'bg-amber-500/10 text-amber-600',
      }
    : {
        shell: 'border-rose-500/15 bg-[var(--bg-primary)]/45 text-[var(--text-primary)]',
        wash: 'from-rose-500/10',
        icon: 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10',
        action: 'bg-rose-500 shadow-rose-500/20 hover:opacity-90',
        soft: 'bg-rose-500/10 text-rose-600',
      };
  const hideNotice = () => {
    if (hideKey) {
      window.localStorage.setItem(hideKey, String(Date.now() + HIDE_MS));
    }
    setHidden(true);
  };

  return (
    <div className="w-full border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/65 px-2 py-2 sm:px-3">
      <div className={`relative mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 overflow-hidden rounded-2xl border p-3 shadow-xl backdrop-blur-2xl sm:flex-row sm:gap-5 sm:p-4 ${severity.shell}`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${severity.wash} to-transparent`} />
        <div className="relative flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg sm:size-12 ${severity.icon}`}>
            <Icon className="size-5 sm:size-5.5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-bold tracking-tight sm:text-base">{title}</p>
              <span className={`hidden rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide sm:inline-flex ${severity.soft}`}>
                {isGrace ? t('subscription.noticeWarning', 'Action needed') : t('subscription.noticeCritical', 'Restricted')}
              </span>
            </div>
            <p className="line-clamp-2 max-w-2xl text-[11px] font-medium leading-relaxed tracking-tight text-[var(--text-secondary)] opacity-70 sm:text-xs">
              {detail}
            </p>
          </div>
        </div>
        <div className="relative flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => router.push(`/subscribe?role=${encodeURIComponent(role)}`)}
            className={`flex h-10 flex-1 items-center justify-center rounded-xl px-5 text-xs font-bold tracking-tight text-white shadow-xl transition active:scale-95 sm:flex-none sm:px-7 ${severity.action}`}
          >
            {t('subscription.subscribeCta', 'Subscribe')}
          </button>
          <button
            type="button"
            onClick={hideNotice}
            className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 px-4 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-secondary)] active:scale-95"
          >
            {t('common.hide', 'Hide')}
          </button>
        </div>
      </div>
    </div>
  );
}
