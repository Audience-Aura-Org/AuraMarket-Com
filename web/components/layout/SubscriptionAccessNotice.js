"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

  const severityClass = isGrace
    ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  const actionClass = isGrace ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className={`w-full border-b px-3 py-2 ${severityClass}`}>
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 sm:gap-3">
        <span className={`size-2 shrink-0 rounded-full ${isGrace ? 'bg-amber-500' : 'bg-rose-500'}`} />
        <button
          type="button"
          onClick={() => setHidden((value) => !value)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={!hidden}
        >
          <p className="truncate text-[11px] font-black uppercase tracking-wide sm:text-xs">{title}</p>
          {!hidden && (
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-4 opacity-90 sm:text-xs sm:leading-5">{detail}</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/subscribe?role=${encodeURIComponent(role)}`)}
          className={`h-8 shrink-0 rounded-xl px-3 text-[10px] font-bold text-white transition active:scale-95 sm:h-9 sm:px-4 sm:text-xs ${actionClass}`}
        >
          {t('subscription.subscribeCta', 'Subscribe')}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="h-8 shrink-0 rounded-xl border border-current/20 px-2 text-[10px] font-bold transition active:scale-95 sm:px-3 sm:text-xs"
        >
          {t('common.hide', 'Hide')}
        </button>
      </div>
    </div>
  );
}
