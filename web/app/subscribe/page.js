"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, BadgeCheck, Check, CreditCard, Loader2, LockKeyhole,
  ShieldCheck, Smartphone, Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

const ROLE_LABELS = {
  customer: 'Customer',
  vendor: 'Vendor',
  logistics: 'Logistics',
  admin: 'Admin',
};

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const user = useAuthStore((state) => state.user);
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);
  const role = searchParams.get('role') || user?.role || 'vendor';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [method, setMethod] = useState('wallet');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = useMemo(
    () => (status?.plans || []).find((plan) => plan._id === selectedPlanId) || status?.plans?.[0],
    [status, selectedPlanId]
  );

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions/me', { params: { role }, skipClientCache: true });
      const next = res.data.data;
      setStatus(next);
      setSelectedPlanId((current) => current || next?.plans?.[0]?._id || null);
      if (next?.active && next?.required) {
        toast.success(t('subscription.activeToast', 'Subscription active.'));
      }
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
    if (method === 'eversend' && !phone.trim()) {
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
        redirect_url: `${window.location.origin}/wallet/verify?gateway=eversend&type=subscription&role=${encodeURIComponent(role)}`,
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
        router.push(`/wallet/verify?gateway=eversend&type=subscription&ref=${encodeURIComponent(ref)}`);
      } else {
        toast.success(t('subscription.requestSent', 'Payment request sent.'));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.paymentFailed', 'Subscription payment failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadyActive = status?.active && status?.required;
  const roleLabel = ROLE_LABELS[role] || role;

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] px-4 py-5 pb-28 text-[var(--text-primary)] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
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

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <LockKeyhole className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t('subscription.title', 'Activate your workspace')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--text-secondary)]">
                  {t('subscription.description', 'This role requires an active package before dashboard tools can be used. Your subscription is checked securely on the server.')}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
              </div>
            ) : isAlreadyActive ? (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <BadgeCheck className="mb-4 size-10 text-emerald-500" />
                <h2 className="text-xl font-bold">{t('subscription.alreadyActive', 'Your subscription is active')}</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {t('subscription.alreadyActiveDetail', 'You can continue to your dashboard and use your role features.')}
                </p>
                <button
                  type="button"
                  onClick={() => router.replace(role === 'vendor' ? '/vendor/dashboard' : role === 'logistics' ? '/logistics/dashboard' : '/profile')}
                  className="mt-5 rounded-2xl bg-[var(--text-primary)] px-5 py-3 text-sm font-bold text-[var(--bg-primary)]"
                >
                  {t('subscription.continueDashboard', 'Continue')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {(status?.plans || []).map((plan) => (
                  <button
                    key={plan._id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan._id)}
                    className={`w-full rounded-3xl border p-5 text-left transition active:scale-[0.99] ${
                      selectedPlan?._id === plan._id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">{plan.name}</h2>
                        <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{Number(plan.price || 0).toLocaleString()}</p>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{plan.currency}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(plan.features || []).map((feature) => (
                        <span key={feature} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-primary)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                          <Check className="size-3 text-emerald-500" />
                          {feature}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!loading && !isAlreadyActive && selectedPlan && (
            <aside className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">{t('subscription.payTitle', 'Payment')}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t('subscription.payDetail', 'Choose the method that is easiest for you.')}
              </p>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setMethod('wallet')}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'wallet' ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)]'}`}
                >
                  <Wallet className="size-5 text-[var(--accent)]" />
                  <div>
                    <p className="text-sm font-bold">{t('subscription.wallet', 'Aura Wallet')}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{Number(user?.wallet_balance || 0).toLocaleString()} XAF</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('eversend')}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'eversend' ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)]'}`}
                >
                  <Smartphone className="size-5 text-[var(--accent)]" />
                  <div>
                    <p className="text-sm font-bold">{t('subscription.mobileMoney', 'Mobile money / card')}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{t('subscription.collectionFee', 'Collection fee is added only for external collection.')}</p>
                  </div>
                </button>
              </div>

              {method === 'eversend' && (
                <label className="mt-4 block">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">{t('subscription.phone', 'Phone number')}</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="651188134"
                    className="mt-2 h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 !text-base font-semibold outline-none focus:border-[var(--accent)]"
                  />
                </label>
              )}

              <div className="mt-6 rounded-3xl bg-[var(--bg-secondary)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--text-secondary)]">{selectedPlan.name}</span>
                  <strong>{Number(selectedPlan.price || 0).toLocaleString()} {selectedPlan.currency}</strong>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  {t('subscription.secureCheck', 'Access is checked server-side on every gated request.')}
                </div>
              </div>

              <button
                type="button"
                onClick={pay}
                disabled={submitting}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                {t('subscription.activateButton', 'Activate package')}
              </button>
            </aside>
          )}
        </section>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-secondary)]" />}>
      <SubscribeContent />
    </Suspense>
  );
}
