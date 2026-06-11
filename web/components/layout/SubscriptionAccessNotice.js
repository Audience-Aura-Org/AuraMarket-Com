"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/services/api';

export default function SubscriptionAccessNotice({ disabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState(null);
  const [hidden, setHidden] = useState(false);

  const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
  const isAuthRoute =
    normalizedPath === '/' ||
    normalizedPath.startsWith('/auth') ||
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
    normalizedPath === '/register' ||
    normalizedPath === '/onboarding';
  const isImmersiveChat = normalizedPath === '/chat' || normalizedPath === '/messages';

  useEffect(() => {
    const handleSubscriptionRequired = (event) => {
      setNotice(event.detail?.data || event.detail || null);
      setHidden(false);
    };

    window.addEventListener('aura:subscription-required', handleSubscriptionRequired);
    return () => window.removeEventListener('aura:subscription-required', handleSubscriptionRequired);
  }, []);

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
        if (data?.required && (!data.subscribed || data.grace || data.limited)) {
          setNotice(data);
        } else {
          setNotice(null);
          setHidden(false);
        }
      } catch {
        if (!cancelled) setNotice(null);
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [disabled, user?._id, user?.role, normalizedPath, isAuthRoute, isImmersiveChat]);

  if (disabled || !notice?.required || isAuthRoute || isImmersiveChat || normalizedPath === '/subscribe') {
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
        shell: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950 dark:text-amber-50',
        icon: 'bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:ring-amber-500/35',
        rail: 'bg-amber-500',
        action: 'bg-amber-500 hover:bg-amber-600',
        soft: 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50',
      }
    : {
        shell: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/35 dark:bg-rose-950 dark:text-rose-50',
        icon: 'bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-900 dark:text-rose-100 dark:ring-rose-500/35',
        rail: 'bg-rose-500',
        action: 'bg-rose-500 hover:bg-rose-600',
        soft: 'bg-rose-200 text-rose-950 dark:bg-rose-800 dark:text-rose-50',
      };

  return (
    <div className="w-full border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/65 px-2 py-2 sm:px-3">
      <div className={`mx-auto flex max-w-[1600px] overflow-hidden rounded-2xl border shadow-sm backdrop-blur-xl ${severity.shell}`}>
        <div className={`w-1 shrink-0 ${severity.rail}`} />
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3">
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 sm:size-9 ${severity.icon}`}>
            <Icon className="size-4 sm:size-4.5" />
          </div>
        <button
          type="button"
          onClick={() => setHidden((value) => !value)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={!hidden}
        >
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[11px] font-black uppercase tracking-wide sm:text-xs">{title}</p>
            <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide sm:inline-flex ${severity.soft}`}>
              {isGrace ? t('subscription.noticeWarning', 'Action needed') : t('subscription.noticeCritical', 'Restricted')}
            </span>
          </div>
          {!hidden && (
            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 opacity-80 sm:text-xs sm:leading-5">{detail}</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => setHidden((value) => !value)}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-current/15 text-current/70 transition hover:bg-white/20 active:scale-95 sm:hidden"
          aria-label={hidden ? t('common.show', 'Show') : t('common.hide', 'Hide')}
        >
          {hidden ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={() => router.push(`/subscribe?role=${encodeURIComponent(role)}`)}
          className={`h-9 shrink-0 rounded-xl px-4 text-xs font-black text-white shadow-sm transition active:scale-95 ${severity.action}`}
        >
          {t('subscription.subscribeCta', 'Subscribe')}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="h-9 shrink-0 rounded-xl border border-current/20 px-3 text-xs font-bold transition hover:bg-white/20 active:scale-95"
        >
          {t('common.hide', 'Hide')}
        </button>
        </div>
        </div>
        {!hidden && (
          <div className="flex border-t border-current/10 px-2.5 pb-2 sm:hidden">
            <button
              type="button"
              onClick={() => router.push(`/subscribe?role=${encodeURIComponent(role)}`)}
              className={`h-9 flex-1 rounded-xl px-3 text-xs font-black text-white shadow-sm transition active:scale-95 ${severity.action}`}
            >
              {t('subscription.subscribeCta', 'Subscribe')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
