"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { MOBILE_MONEY_PROVIDERS } from '@/lib/formatting';

const ROLE_LABELS = {
  customer: 'Customer',
  vendor: 'Vendor',
  logistics: 'Logistics',
  admin: 'Admin',
};

const planKicker = (plan, t) => {
  const slug = String(plan?.slug || '').toLowerCase();
  if (slug.includes('standard')) return t('subscription.kicker.standard', 'Growing seller');
  if (slug.includes('business')) return t('subscription.kicker.business', 'Established business');
  if (slug.includes('power')) return t('subscription.kicker.power', 'Large operation');
  return t('subscription.kicker.welcome', 'Just starting out');
};

const planDuration = (plan, t) => {
  if (plan?.contact_required) return t('subscription.duration.custom', 'Custom price - 6-12 month deal');
  const days = Number(plan?.duration_days || 0);
  if (days >= 85 && days <= 95) return t('subscription.duration.threeMonths', 'Pay once - valid for 3 months');
  if (days >= 55 && days <= 65) return t('subscription.duration.twoMonths', 'Pay once - valid for 2 months');
  if (days >= 25 && days <= 35) return t('subscription.duration.oneMonth', 'Pay once - valid for 1 month');
  if (days > 0) return t('subscription.duration.days', 'Pay once - valid for {days} days', { days });
  if (plan?.billing_cycle === 'monthly') return t('subscription.monthly', 'Monthly package');
  if (plan?.billing_cycle === 'yearly') return t('subscription.yearly', 'Yearly package');
  return t('subscription.oneTime', 'Pay once');
};

const planTranslationKey = (plan, suffix) => {
  const slug = String(plan?.slug || '')
    .toLowerCase()
    .replace(/^vendor-/, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `subscription.plan.${slug}.${suffix}`;
};

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, label } = useLanguage();
  const user = useAuthStore((state) => state.user);
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);
  const role = searchParams.get('role') || user?.role || 'vendor';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [method, setMethod] = useState('payunit');
  const [phone, setPhone] = useState(user?.phone || '');
  const [provider, setProvider] = useState('CM_MTNMOMO');
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = useMemo(
    () => (status?.plans || []).find((plan) => plan._id === selectedPlanId) || status?.plans?.[0],
    [status, selectedPlanId]
  );

  const activeSubscription = status?.subscription || null;
  const activePlan = activeSubscription?.plan_id || null;
  const activePlanId = String(activePlan?._id || activeSubscription?.plan_id || '');

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions/me', { params: { role }, skipClientCache: true });
      const next = res.data.data;
      setStatus(next);
      const currentPlanId = next?.subscription?.plan_id?._id || next?.subscription?.plan_id;
      setSelectedPlanId((current) => current || currentPlanId || next?.plans?.[0]?._id || null);
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.loadFailed', 'Could not load subscription.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.replace('/login?from=subscribe');
      return;
    }
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, role]);

  const pay = async () => {
    if (!selectedPlan) return;
    if (selectedPlan.contact_required) {
      router.push('/contact');
      return;
    }
    if (['payunit', 'eversend'].includes(method) && !phone.trim()) {
      toast.error(t('subscription.phoneRequired', 'Phone number is required.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/subscriptions/initialize', {
        plan_id: selectedPlan._id,
        role,
        payment_method: method,
        currency: selectedPlan.currency || 'XAF',
        phone,
        country: 'CM',
        provider: method === 'payunit' ? provider : undefined,
        redirect_url: `${window.location.origin}/wallet/verify?gateway=${method}&type=subscription&role=${encodeURIComponent(role)}`,
      });

      if (method === 'wallet') {
        await refreshWalletBalance?.();
        toast.success(res.data.message || t('subscription.activated', 'Subscription activated.'));
        await loadStatus();
        router.replace(role === 'vendor' ? '/vendor/dashboard' : role === 'logistics' ? '/logistics/dashboard' : '/profile');
        return;
      }

      const ref = res.data?.data?.reference;
      if (ref) {
        router.push(`/wallet/verify?gateway=${method}&type=subscription&ref=${encodeURIComponent(ref)}`);
      } else {
        toast.success(t('subscription.requestSent', 'Payment request sent.'));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.paymentFailed', 'Subscription payment failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadyActive = status?.subscribed && status?.required;
  const roleLabel = label(ROLE_LABELS[role] || role);
  const isContactPlan = Boolean(selectedPlan?.contact_required);
  const sidebarRole = ['admin', 'vendor', 'logistics', 'customer'].includes(user?.role)
    ? user.role
    : role;

  const content = (
    <div className="min-h-screen w-full bg-[var(--bg-secondary)] px-2 py-5 pb-28 text-[var(--text-primary)] sm:px-4 lg:px-6">
      <div className="flex w-full flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex size-11 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] shadow-sm transition active:scale-95"
            aria-label={t('common.back', 'Back')}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)]">
            {roleLabel} {t('subscription.access', 'access')}
          </div>
        </div>

        <section className="grid w-full gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3 shadow-sm sm:p-5 lg:p-7">
            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
              </div>
            ) : (
              <>
              {isAlreadyActive && (
              <div className="mb-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <BadgeCheck className="mb-4 size-10 text-emerald-500" />
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{t('subscription.alreadyActive', 'Your subscription is active')}</h2>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
                      {t('subscription.activePlanDetail', 'Current package: {plan}', {
                        plan: activePlan ? t(planTranslationKey(activePlan, 'name'), activePlan.name) : t('subscription.plan', 'Plan'),
                      })}
                    </p>
                    {activeSubscription?.expires_at && (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {t('subscription.expiresOn', 'Expires on {date}', {
                          date: new Date(activeSubscription.expires_at).toLocaleDateString(),
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.replace(role === 'vendor' ? '/vendor/dashboard' : role === 'logistics' ? '/logistics/dashboard' : '/profile')}
                    className="rounded-2xl bg-[var(--text-primary)] px-5 py-3 text-sm font-bold text-[var(--bg-primary)]"
                  >
                    {t('subscription.continueDashboard', 'Continue')}
                  </button>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {t('subscription.updateRoomDetail', 'You can keep your current package or choose another one below to update your access.')}
                </p>
              </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(status?.plans || []).map((plan) => (
                  (() => {
                    const isCurrentPlan = activePlanId && String(plan._id) === activePlanId;
                    const isSelectedPlan = selectedPlan?._id === plan._id;
                    return (
                  <button
                    key={plan._id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan._id)}
                    className={`relative flex min-h-[330px] w-full flex-col rounded-3xl border p-5 text-left transition active:scale-[0.99] ${
                      isSelectedPlan
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : isCurrentPlan
                          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-sm shadow-emerald-500/10'
                        : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {isCurrentPlan && (
                      <span className="absolute left-4 top-4 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                        {t('subscription.currentPlan', 'Current plan')}
                      </span>
                    )}
                    {String(plan.slug || '').includes('standard') && (
                      <span className={`absolute right-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-bold text-white ${isCurrentPlan ? 'top-12' : ''}`}>
                        {t('subscription.mostPopular', 'Most popular')}
                      </span>
                    )}
                    <div className={`min-w-0 pr-20 ${isCurrentPlan ? 'pt-8' : ''}`}>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">{planKicker(plan, t)}</p>
                      <h2 className="mt-1 text-xl font-bold">{t(planTranslationKey(plan, 'name'), plan.name)}</h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-secondary)]">{t(planTranslationKey(plan, 'description'), plan.description)}</p>
                    </div>
                    <div className="mt-5">
                      {plan.contact_required ? (
                        <p className="text-2xl font-black">{t('subscription.talkToUs', 'Talk to us')}</p>
                      ) : (
                        <p className="text-2xl font-black">{plan.currency} {Number(plan.price || 0).toLocaleString()}</p>
                      )}
                      <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">{planDuration(plan, t)}</p>
                    </div>
                    <div className="mt-5 space-y-2">
                      {(plan.features || []).map((feature, featureIndex) => {
                        const featureText = typeof feature === 'string' ? feature : (feature?.label || feature?.key || '');
                        if (!featureText) return null;
                        return (
                          <span key={featureIndex} className="flex items-start gap-2 text-[12px] font-semibold leading-5 text-[var(--text-secondary)]">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                            <span>{t(planTranslationKey(plan, `feature${featureIndex + 1}`), featureText)}</span>
                          </span>
                        );
                      })}
                    </div>
                    <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-black text-[var(--accent)]">
                      {isCurrentPlan
                        ? t('subscription.keepCurrent', 'Current package')
                        : isAlreadyActive
                          ? t('subscription.updatePackage', 'Update package')
                          : plan.contact_required
                            ? t('subscription.contactUs', 'Contact us')
                            : t('subscription.getStarted', 'Get started')}
                      <span aria-hidden="true">-&gt;</span>
                    </span>
                  </button>
                    );
                  })()
                ))}
              </div>
              </>
            )}
          </div>

          {!loading && selectedPlan && (
            <aside className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm sm:p-6 2xl:sticky 2xl:top-24 2xl:self-start">
              <h2 className="text-lg font-bold">
                {isAlreadyActive ? t('subscription.updateTitle', 'Update package') : t('subscription.payTitle', isContactPlan ? 'Contact' : 'Payment')}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {isAlreadyActive
                  ? t('subscription.updateDetail', 'Choose another package to extend or upgrade your subscription.')
                  : isContactPlan
                  ? t('subscription.contactDetail', 'This package is handled directly by support so the offer can match your operation.')
                  : t('subscription.payDetail', 'Choose the method that is easiest for you.')}
              </p>

              {isContactPlan ? (
                <div className="mt-5 rounded-3xl bg-[var(--bg-secondary)] p-4">
                  <MessageCircle className="mb-3 size-6 text-[var(--accent)]" />
                  <p className="text-sm font-bold">{t(planTranslationKey(selectedPlan, 'name'), selectedPlan.name)}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-secondary)]">
                    {t('subscription.powerSellerHelp', 'Talk to Auradime support for custom pricing, homepage placement, API access, and account management.')}
                  </p>
                  <Link
                    href="/contact"
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-bold text-white"
                  >
                    {t('subscription.contactUs', 'Contact us')}
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-5 space-y-3">
                    <button
                      type="button"
                      onClick={() => setMethod('wallet')}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'wallet' ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)]'}`}
                    >
                      <Wallet className="size-5 text-[var(--accent)]" />
                      <div>
                        <p className="text-sm font-bold">{t('subscription.wallet', 'Aura Wallet')}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{Number(walletBalance ?? user?.wallet_balance ?? 0).toLocaleString()} XAF</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('payunit')}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'payunit' ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)]'}`}
                    >
                      <Smartphone className="size-5 text-[var(--accent)]" />
                      <div>
                        <p className="text-sm font-bold">{t('subscription.payunitTitle', 'PayUnit - primary Cameroon')}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{t('subscription.payunitHelp', 'Primary Cameroon collection for MTN Mobile Money and Orange Money.')}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('eversend')}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'eversend' ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)]'}`}
                    >
                      <Smartphone className="size-5 text-[var(--accent)]" />
                      <div>
                        <p className="text-sm font-bold">{t('subscription.eversendTitle', 'Eversend - multi-country')}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{t('subscription.eversendHelp', 'Multi-country mobile money and card collection where available.')}</p>
                      </div>
                    </button>
                  </div>

                  {['payunit', 'eversend'].includes(method) && (
                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <span className="text-xs font-bold text-[var(--text-secondary)]">{t('subscription.phone', 'Phone number')}</span>
                        <input
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="651188134"
                          className="mt-2 h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 text-[13px] placeholder:text-[11px] placeholder:font-normal font-semibold outline-none focus:border-[var(--accent)]"
                        />
                      </label>
                      
                      {method === 'payunit' && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-[var(--text-secondary)]">{t('subscription.provider', 'Network provider')}</span>
                          <div className="grid grid-cols-2 gap-3">
                            {MOBILE_MONEY_PROVIDERS.map(node => (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => setProvider(node.id)}
                                className={`h-11 rounded-2xl border font-bold text-xs tracking-tight transition-all ${provider === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-60 hover:opacity-100'}`}
                              >
                                {node.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 rounded-3xl bg-[var(--bg-secondary)] p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[var(--text-secondary)]">{t(planTranslationKey(selectedPlan, 'name'), selectedPlan.name)}</span>
                      <strong>{Number(selectedPlan.price || 0).toLocaleString()} {selectedPlan.currency}</strong>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">{planDuration(selectedPlan, t)}</p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      {t('subscription.secureCheck', 'Access is checked server-side on every gated request.')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={pay}
                    disabled={submitting || (activePlanId && String(selectedPlan._id) === activePlanId)}
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {activePlanId && String(selectedPlan._id) === activePlanId
                      ? t('subscription.alreadyCurrent', 'Already active')
                      : isAlreadyActive
                        ? t('subscription.updatePackage', 'Update package')
                        : t('subscription.activateButton', 'Activate package')}
                  </button>
                </>
              )}
            </aside>
          )}
        </section>
      </div>
    </div>
  );

  if (!user) return content;

  return (
    <DashboardLayout role={sidebarRole} hideFooter>
      {content}
    </DashboardLayout>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-secondary)]" />}>
      <SubscribeContent />
    </Suspense>
  );
}
