"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, CreditCard, Edit3, Loader2, RefreshCw, Save,
  ShieldCheck, ToggleLeft, ToggleRight, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';

const ROLE_OPTIONS = ['customer', 'vendor', 'logistics'];

const defaultPlan = {
  name: '',
  description: '',
  price: 500,
  currency: 'XAF',
  billing_cycle: 'one_time',
  duration_days: '',
  contact_required: false,
  roles: ['vendor'],
  features: '',
  is_active: true,
};

const fieldClass = 'h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 !text-base font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]';

export default function AdminSubscriptionsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState({ plans: [], subscriptions: [], requirements: {}, stats: {} });
  const [planForm, setPlanForm] = useState(defaultPlan);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [manualActivation, setManualActivation] = useState({ user_id: '', plan_id: '', role: 'vendor', started_at: '', expires_at: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions/admin/overview', { skipClientCache: true });
      setOverview(res.data.data || {});
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.adminLoadFailed', 'Could not load subscriptions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = overview.stats || {};
  const activePlans = useMemo(() => (overview.plans || []).filter((plan) => plan.is_active), [overview.plans]);

  const saveRequirementSettings = async (requirements, graceDays = overview.grace_days || {}) => {
    setOverview((current) => ({ ...current, requirements, grace_days: graceDays }));
    try {
      const res = await api.patch('/subscriptions/admin/requirements', { requirements, grace_days: graceDays });
      setOverview((current) => ({
        ...current,
        requirements: res.data?.data?.requirements || requirements,
        grace_days: res.data?.data?.grace_days || graceDays,
      }));
      toast.success(t('subscription.requirementsSaved', 'Subscription requirements saved.'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.saveFailed', 'Could not save changes.'));
      load();
    }
  };

  const toggleRequirement = async (role) => {
    const next = {
      ...(overview.requirements || {}),
      [role]: !overview.requirements?.[role],
      admin: false,
    };
    await saveRequirementSettings(next);
  };

  const updateGraceDays = async (role, value) => {
    const graceDays = {
      ...(overview.grace_days || {}),
      [role]: Math.max(0, Number(value || 0)),
      admin: 0,
    };
    await saveRequirementSettings(overview.requirements || {}, graceDays);
  };

  const editPlan = (plan) => {
    setEditingPlanId(plan._id);
    setPlanForm({
      name: plan.name || '',
      description: plan.description || '',
      price: plan.price || 0,
      currency: plan.currency || 'XAF',
      billing_cycle: plan.billing_cycle || 'one_time',
      duration_days: plan.duration_days ?? '',
      contact_required: Boolean(plan.contact_required),
      roles: plan.roles || ['vendor'],
      features: (plan.features || []).join('\n'),
      is_active: plan.is_active !== false,
    });
  };

  const resetForm = () => {
    setEditingPlanId(null);
    setPlanForm(defaultPlan);
  };

  const savePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error(t('subscription.planNameRequired', 'Plan name is required.'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...planForm,
        price: Number(planForm.price || 0),
        duration_days: planForm.duration_days === '' ? null : Number(planForm.duration_days || 0),
        contact_required: Boolean(planForm.contact_required),
        features: String(planForm.features || '').split('\n').map((line) => line.trim()).filter(Boolean),
      };
      if (editingPlanId) {
        await api.patch(`/subscriptions/admin/plans/${editingPlanId}`, payload);
      } else {
        await api.post('/subscriptions/admin/plans', payload);
      }
      toast.success(t('subscription.planSaved', 'Plan saved.'));
      resetForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.saveFailed', 'Could not save changes.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePlanStatus = async (plan) => {
    try {
      await api.patch(`/subscriptions/admin/plans/${plan._id}`, {
        is_active: !plan.is_active,
      });
      toast.success(t('subscription.planSaved', 'Plan saved.'));
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.saveFailed', 'Could not save changes.'));
    }
  };

  const updateSubscription = async (id, action) => {
    try {
      await api.patch(`/subscriptions/admin/subscriptions/${id}`, { action });
      toast.success(t('subscription.subscriptionUpdated', 'Subscription updated.'));
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.saveFailed', 'Could not save changes.'));
    }
  };

  const activateManual = async () => {
    if (!manualActivation.user_id || !manualActivation.plan_id) {
      toast.error(t('subscription.manualRequired', 'User ID and plan are required.'));
      return;
    }
    try {
      await api.post('/subscriptions/admin/subscriptions/activate', manualActivation);
      toast.success(t('subscription.subscriptionUpdated', 'Subscription updated.'));
      setManualActivation({ user_id: '', plan_id: '', role: 'vendor', started_at: '', expires_at: '' });
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || t('subscription.saveFailed', 'Could not save changes.'));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] p-4 pb-28 text-[var(--text-primary)] sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <CreditCard className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('subscription.adminTitle', 'Subscription Control')}</h1>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {t('subscription.adminSubtitle', 'Manage role gates, packages, subscribers, and subscription revenue.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-4 text-sm font-bold text-[var(--text-secondary)] transition active:scale-95"
          >
            <RefreshCw className="size-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} label={t('subscription.activeSubscribers', 'Active subscribers')} value={stats.active || 0} />
          <Stat icon={CreditCard} label={t('subscription.revenue', 'Subscription revenue')} value={`${Number(stats.revenue || 0).toLocaleString()} XAF`} />
          <Stat icon={ShieldCheck} label={t('subscription.graceUsers', 'Grace users')} value={stats.grace || 0} />
          <Stat icon={BadgeCheck} label={t('subscription.limitedUsers', 'Limited users')} value={stats.limited || 0} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
              <h2 className="text-lg font-bold">{t('subscription.roleRequirements', 'Role requirements')}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t('subscription.roleRequirementsDetail', 'Admin is never gated. Toggle only roles that should pay before using role tools.')}
              </p>
              <div className="mt-5 space-y-3">
                {ROLE_OPTIONS.map((role) => {
                  const enabled = Boolean(overview.requirements?.[role]);
                  return (
                    <div
                      key={role}
                      className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="capitalize font-bold">{role}</span>
                        <button type="button" onClick={() => toggleRequirement(role)} className="shrink-0">
                          {enabled ? <ToggleRight className="size-7 text-[var(--accent)]" /> : <ToggleLeft className="size-7 text-[var(--text-secondary)]" />}
                        </button>
                      </div>
                      <label className="mt-3 block">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t('subscription.graceDays', 'Grace days')}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={overview.grace_days?.[role] ?? 0}
                          onChange={(event) => setOverview((current) => ({
                            ...current,
                            grace_days: {
                              ...(current.grace_days || {}),
                              [role]: event.target.value,
                            },
                          }))}
                          onBlur={(event) => updateGraceDays(role, event.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 !text-base font-bold outline-none focus:border-[var(--accent)]"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">{editingPlanId ? t('subscription.editPlan', 'Edit plan') : t('subscription.newPlan', 'New plan')}</h2>
                {editingPlanId && (
                  <button onClick={resetForm} className="text-xs font-bold text-[var(--accent)]">{t('common.cancel', 'Cancel')}</button>
                )}
              </div>
              <div className="space-y-3">
                <input className={fieldClass} placeholder={t('subscription.planName', 'Plan name')} value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
                <textarea className={`${fieldClass} min-h-20 py-3`} placeholder={t('subscription.descriptionField', 'Description')} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className={fieldClass} type="number" placeholder="500" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
                  <select className={fieldClass} value={planForm.billing_cycle} onChange={(e) => setPlanForm({ ...planForm, billing_cycle: e.target.value })}>
                    <option value="one_time">{t('subscription.oneTime', 'One-time')}</option>
                    <option value="monthly">{t('subscription.monthly', 'Monthly')}</option>
                    <option value="yearly">{t('subscription.yearly', 'Yearly')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    placeholder={t('subscription.durationDays', 'Duration days')}
                    value={planForm.duration_days}
                    onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setPlanForm((current) => ({ ...current, contact_required: !current.contact_required }))}
                    className={`h-12 rounded-2xl border px-4 text-xs font-bold transition ${planForm.contact_required ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
                  >
                    {t('subscription.contactOnly', 'Contact-only package')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => {
                    const checked = planForm.roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setPlanForm((current) => ({
                          ...current,
                          roles: checked ? current.roles.filter((item) => item !== role) : [...current.roles, role],
                        }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${checked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
                <textarea className={`${fieldClass} min-h-24 py-3`} placeholder={t('subscription.featuresHelp', 'One feature per line')} value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} />
                <button
                  type="button"
                  onClick={savePlan}
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t('subscription.savePlan', 'Save plan')}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
              <h2 className="text-lg font-bold">{t('subscription.manualActivation', 'Manual activation')}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subscription.manualActivationDetail', 'Activate a package for a user by ID when support confirms payment or grants access.')}</p>
              <div className="mt-4 space-y-3">
                <input
                  className={fieldClass}
                  placeholder={t('subscription.userId', 'User ID')}
                  value={manualActivation.user_id}
                  onChange={(e) => setManualActivation({ ...manualActivation, user_id: e.target.value })}
                />
                <select
                  className={fieldClass}
                  value={manualActivation.plan_id}
                  onChange={(e) => setManualActivation({ ...manualActivation, plan_id: e.target.value })}
                >
                  <option value="">{t('subscription.choosePlan', 'Choose plan')}</option>
                  {(overview.plans || []).map((plan) => (
                    <option key={plan._id} value={plan._id}>{plan.name}</option>
                  ))}
                </select>
                <select
                  className={fieldClass}
                  value={manualActivation.role}
                  onChange={(e) => setManualActivation({ ...manualActivation, role: e.target.value })}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t('subscription.startDate', 'Start date')}
                    </span>
                    <input
                      className={fieldClass}
                      type="date"
                      value={manualActivation.started_at}
                      onChange={(e) => setManualActivation({ ...manualActivation, started_at: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t('subscription.expiryDate', 'Expiry date')}
                    </span>
                    <input
                      className={fieldClass}
                      type="date"
                      value={manualActivation.expires_at}
                      onChange={(e) => setManualActivation({ ...manualActivation, expires_at: e.target.value })}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={activateManual}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/10 text-sm font-bold text-[var(--accent)]"
                >
                  <BadgeCheck className="size-4" />
                  {t('subscription.activateUser', 'Activate user')}
                </button>
              </div>
            </div>
          </aside>

          <main className="space-y-5">
            <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
              <h2 className="text-lg font-bold">{t('subscription.plans', 'Plans')}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(overview.plans || []).map((plan) => (
                  <div key={plan._id} className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{plan.name}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{plan.description}</p>
                      </div>
                      <button onClick={() => editPlan(plan)} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)]">
                        <Edit3 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <strong>{Number(plan.price || 0).toLocaleString()} {plan.currency}</strong>
                      <button
                        type="button"
                        onClick={() => togglePlanStatus(plan)}
                        className={`rounded-full px-2 py-1 text-[10px] font-bold transition active:scale-95 ${plan.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}
                        title={plan.is_active ? t('subscription.hidePlan', 'Hide package') : t('subscription.activatePlan', 'Activate package')}
                      >
                        {plan.is_active ? t('common.active', 'Active') : t('common.hidden', 'Hidden')}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-[var(--text-secondary)]">
                      {Number(plan.duration_days || 0) > 0 && <span>{plan.duration_days} {t('subscription.days', 'days')}</span>}
                      {plan.contact_required && <span>{t('subscription.contactOnly', 'Contact-only package')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
              <div className="border-b border-[var(--glass-border)] p-5">
                <h2 className="text-lg font-bold">{t('subscription.subscribers', 'Subscribers')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('subscription.subscribersDetail', 'Recent subscription history and payment status.')}</p>
              </div>
              {loading ? (
                <div className="flex h-56 items-center justify-center">
                  <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-5 py-4">{t('common.user', 'User')}</th>
                        <th className="px-5 py-4">{t('subscription.plan', 'Plan')}</th>
                        <th className="px-5 py-4">{t('common.role', 'Role')}</th>
                        <th className="px-5 py-4">{t('common.status', 'Status')}</th>
                        <th className="px-5 py-4">{t('common.amount', 'Amount')}</th>
                        <th className="px-5 py-4">{t('common.actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.subscriptions || []).map((sub) => (
                        <tr key={sub._id} className="border-t border-[var(--glass-border)]">
                          <td className="px-5 py-4">
                            <p className="font-bold">{sub.user_id?.name || t('common.unknown', 'Unknown')}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{sub.user_id?.email || '-'}</p>
                          </td>
                          <td className="px-5 py-4">{sub.plan_id?.name || '-'}</td>
                          <td className="px-5 py-4 capitalize">{sub.role}</td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-bold capitalize">{sub.status}</span>
                          </td>
                          <td className="px-5 py-4 font-bold">{Number(sub.amount_paid || 0).toLocaleString()} {sub.currency}</td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => updateSubscription(sub._id, 'activate')} className="rounded-xl border border-[var(--glass-border)] px-3 py-2 text-xs font-bold">{t('common.activate', 'Activate')}</button>
                              <button onClick={() => updateSubscription(sub._id, 'cancel')} className="rounded-xl border border-[var(--glass-border)] px-3 py-2 text-xs font-bold">{t('common.cancel', 'Cancel')}</button>
                              <button onClick={() => updateSubscription(sub._id, 'refund')} className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-bold text-red-500">{t('common.refund', 'Refund')}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(overview.subscriptions || []).length === 0 && (
                    <div className="p-10 text-center text-sm text-[var(--text-secondary)]">{t('subscription.noSubscribers', 'No subscribers yet.')}</div>
                  )}
                </div>
              )}
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
      <Icon className="mb-4 size-5 text-[var(--accent)]" />
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
