"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';

const ROLE_OPTIONS = ['customer', 'vendor', 'logistics'];
const STATUS_OPTIONS = ['all', 'active', 'pending', 'grace', 'limited', 'cancelled', 'refunded'];

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

const fieldClass = 'h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 !text-base font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]';

const money = (value, currency = 'XAF') => `${Number(value || 0).toLocaleString()} ${currency}`;
const shortDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AdminSubscriptionsPage() {
  const { t, label } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState({ plans: [], subscriptions: [], requirements: {}, grace_days: {}, stats: {} });
  const [planForm, setPlanForm] = useState(defaultPlan);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [manualActivation, setManualActivation] = useState({ user_id: '', plan_id: '', role: 'vendor', started_at: '', expires_at: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [query, setQuery] = useState('');

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

  const plans = overview.plans || [];
  const subscriptions = overview.subscriptions || [];
  const stats = overview.stats || {};
  const activePlansCount = plans.filter((plan) => plan.is_active).length;

  const filteredSubscriptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      const matchesRole = roleFilter === 'all' || sub.role === roleFilter;
      const user = sub.user_id || {};
      const plan = sub.plan_id || {};
      const haystack = [
        user.name,
        user.email,
        user.phone,
        plan.name,
        sub.role,
        sub.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && matchesRole && (!needle || haystack.includes(needle));
    });
  }, [query, roleFilter, statusFilter, subscriptions]);

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
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => document.getElementById('plan-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
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
      toast.error(t('subscription.manualRequired', 'User ID or Email and plan are required.'));
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
    <div className="min-h-screen bg-[var(--bg-secondary)] p-4 pb-28 text-[var(--text-primary)] sm:p-6 lg:p-8 md:pt-4" style={{ paddingTop: 'calc\(56px\ \+\ env\(safe-area-inset-top,\ 0px\)\)' }}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <header className="overflow-hidden rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <CreditCard className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                  {t('nav.subscriptions', 'Subscriptions')}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {t('subscription.adminTitle', 'Subscription Control')}
                </h1>
                <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-[var(--text-secondary)]">
                  {t('subscription.adminSubtitle', 'Manage role gates, packages, subscribers, and subscription revenue.')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-4 text-sm font-bold text-[var(--text-secondary)] transition active:scale-95"
              >
                <Plus className="size-4" />
                {t('subscription.newPlan', 'New plan')}
              </button>
              <button
                type="button"
                onClick={load}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-bold text-white transition active:scale-95"
              >
                <RefreshCw className="size-4" />
                {t('common.refresh', 'Refresh')}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Users} tone="accent" label={t('subscription.activeSubscribers', 'Active subscribers')} value={stats.active || 0} detail={`${stats.pending || 0} ${t('subscription.pending', 'pending payments')}`} />
          <Stat icon={WalletCards} tone="emerald" label={t('subscription.revenue', 'Subscription revenue')} value={money(stats.revenue)} detail={`${stats.completed_payments || 0} completed payments`} />
          <Stat icon={Sparkles} tone="amber" label={t('subscription.activePlans', 'Active plans')} value={activePlansCount} detail={`${plans.length} total packages`} />
          <Stat icon={ShieldCheck} tone="blue" label={t('subscription.graceUsers', 'Grace users')} value={stats.grace || 0} detail={`${stats.limited || 0} ${t('subscription.limitedUsers', 'limited users')}`} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <div className="space-y-5">
            <Panel
              title={t('subscription.roleRequirements', 'Role requirements')}
              description={t('subscription.roleRequirementsDetail', 'Admin is never gated. Toggle only roles that should pay before using role tools.')}
            >
              <div className="grid gap-3 md:grid-cols-3">
                {ROLE_OPTIONS.map((role) => (
                  <RoleGateCard
                    key={role}
                    role={role}
                    enabled={Boolean(overview.requirements?.[role])}
                    graceDays={overview.grace_days?.[role] ?? 0}
                    onToggle={() => toggleRequirement(role)}
                    onGraceChange={(value) => setOverview((current) => ({
                      ...current,
                      grace_days: {
                        ...(current.grace_days || {}),
                        [role]: value,
                      },
                    }))}
                    onGraceBlur={(value) => updateGraceDays(role, value)}
                    t={t}
                    label={label}
                  />
                ))}
              </div>
            </Panel>

            <Panel
              title={t('subscription.plans', 'Plans')}
              description="Create packages, hide inactive offers, and edit pricing without touching code."
              action={
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-3 text-xs font-bold text-[var(--text-secondary)]"
                >
                  <Plus className="size-4" />
                  {t('subscription.newPlan', 'New plan')}
                </button>
              }
            >
              {loading ? (
                <LoadingBlock />
              ) : plans.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan._id}
                      plan={plan}
                      onEdit={() => editPlan(plan)}
                      onToggle={() => togglePlanStatus(plan)}
                      t={t}
                      label={label}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="No packages yet" detail="Create your first subscription package from the plan studio." />
              )}
            </Panel>
          </div>

          <div className="space-y-5">
            <PlanStudio
              id="plan-studio"
              planForm={planForm}
              setPlanForm={setPlanForm}
              editingPlanId={editingPlanId}
              resetForm={resetForm}
              savePlan={savePlan}
              saving={saving}
              t={t}
              label={label}
            />

            <ManualActivationPanel
              manualActivation={manualActivation}
              setManualActivation={setManualActivation}
              plans={plans}
              activateManual={activateManual}
              t={t}
              label={label}
            />
          </div>
        </section>

        <Panel
          title={t('subscription.subscribers', 'Subscribers')}
          description={t('subscription.subscribersDetail', 'Recent subscription history and payment status.')}
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('common.search', 'Search')}
                  className="h-10 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] pl-9 pr-3 !text-base font-semibold outline-none focus:border-[var(--accent)]"
                />
              </div>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base font-semibold outline-none">
                <option value="all">{t('common.allRoles', 'All roles')}</option>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{label(role)}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 !text-base font-semibold outline-none">
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === 'all' ? t('common.all', 'All') : label(status)}</option>)}
              </select>
            </div>
          }
        >
          {loading ? (
            <LoadingBlock />
          ) : (
            <SubscriberTable
              subscriptions={filteredSubscriptions}
              updateSubscription={updateSubscription}
              t={t}
              label={label}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, description, action, children }) {
  return (
    <section className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-[var(--text-secondary)]">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon: Icon, label, value, detail, tone = 'accent' }) {
  const tones = {
    accent: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    blue: 'bg-blue-500/10 text-blue-600',
  };
  return (
    <div className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
      <div className={`mb-4 flex size-11 items-center justify-center rounded-2xl ${tones[tone] || tones.accent}`}>
        <Icon className="size-5" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{detail}</p>}
    </div>
  );
}

function RoleGateCard({ role, enabled, graceDays, onToggle, onGraceChange, onGraceBlur, t, label }) {
  return (
    <div className={`rounded-3xl border p-4 transition ${enabled ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold capitalize">{label(role)}</p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
            {enabled ? t('subscription.packageNeeded', 'Package needed') : t('subscription.access', 'access')}
          </p>
        </div>
        <button type="button" onClick={onToggle} className="shrink-0" aria-label={`Toggle ${role}`}>
          {enabled ? <ToggleRight className="size-8 text-[var(--accent)]" /> : <ToggleLeft className="size-8 text-[var(--text-secondary)]" />}
        </button>
      </div>
      <label className="mt-4 block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {t('subscription.graceDays', 'Grace days')}
        </span>
        <input
          type="number"
          min="0"
          value={graceDays}
          onChange={(event) => onGraceChange(event.target.value)}
          onBlur={(event) => onGraceBlur(event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 !text-base font-bold outline-none focus:border-[var(--accent)]"
        />
      </label>
    </div>
  );
}

function PlanCard({ plan, onEdit, onToggle, t, label }) {
  const features = plan.features || [];
  return (
    <article className="flex min-h-[260px] flex-col rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold leading-tight">{plan.name}</h3>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${plan.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
              {plan.is_active ? t('common.active', 'Active') : t('common.hidden', 'Hidden')}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-[var(--text-secondary)]">{plan.description}</p>
        </div>
        <button onClick={onEdit} className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          <Edit3 className="size-4" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--bg-primary)] p-3">
        <p className="text-2xl font-bold tracking-tight">{money(plan.price, plan.currency)}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-[var(--text-secondary)]">
          <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1">{label(plan.billing_cycle || 'one_time')}</span>
          {Number(plan.duration_days || 0) > 0 && <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1">{plan.duration_days} {t('subscription.days', 'days')}</span>}
          {plan.contact_required && <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1">{t('subscription.contactOnly', 'Contact-only package')}</span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(plan.roles || []).map((role) => (
          <span key={role} className="rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-2.5 py-1 text-[10px] font-bold capitalize text-[var(--text-secondary)]">
            {label(role)}
          </span>
        ))}
      </div>

      <ul className="mt-4 min-h-0 flex-1 space-y-2">
        {features.slice(0, 4).map((feature) => (
          <li key={feature} className="flex gap-2 text-xs font-medium leading-relaxed text-[var(--text-secondary)]">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            <span className="line-clamp-2">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onToggle}
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-xs font-bold text-[var(--text-primary)] transition active:scale-95"
      >
        {plan.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {plan.is_active ? t('subscription.hidePlan', 'Hide package') : t('subscription.activatePlan', 'Activate package')}
      </button>
    </article>
  );
}

function PlanStudio({ id, planForm, setPlanForm, editingPlanId, resetForm, savePlan, saving, t, label }) {
  return (
    <Panel
      title={editingPlanId ? t('subscription.editPlan', 'Edit plan') : t('subscription.newPlan', 'New plan')}
      description="Use this studio to control the public package copy, price, visibility, and eligible roles."
      action={editingPlanId && (
        <button onClick={resetForm} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-3 text-xs font-bold text-[var(--text-secondary)]">
          <RotateCcw className="size-4" />
          {t('common.cancel', 'Cancel')}
        </button>
      )}
    >
      <div id={id} className="grid gap-3">
        <input className={fieldClass} placeholder={t('subscription.planName', 'Plan name')} value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
        <textarea className={`${fieldClass} min-h-24 py-3`} placeholder={t('subscription.descriptionField', 'Description')} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input className={fieldClass} type="number" placeholder="500" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
          <select className={fieldClass} value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}>
            <option value="XAF">XAF</option>
          </select>
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
            className={`h-11 rounded-2xl border px-4 text-xs font-bold transition ${planForm.contact_required ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
          >
            {t('subscription.contactOnly', 'Contact-only package')}
          </button>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{t('common.roles', 'Roles')}</p>
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
                  className={`rounded-full border px-3 py-2 text-xs font-bold capitalize ${checked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
                >
                  {label(role)}
                </button>
              );
            })}
          </div>
        </div>
        <textarea className={`${fieldClass} min-h-28 py-3`} placeholder={t('subscription.featuresHelp', 'One feature per line')} value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} />
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
    </Panel>
  );
}

function ManualActivationPanel({ manualActivation, setManualActivation, plans, activateManual, t, label }) {
  return (
    <Panel
      title={t('subscription.manualActivation', 'Manual activation')}
      description={t('subscription.manualActivationDetail', 'Activate a package for a user by ID when support confirms payment or grants access.')}
    >
      <div className="grid gap-3">
        <input
          className={fieldClass}
          placeholder={t('subscription.userIdOrEmail', 'User ID or Email')}
          value={manualActivation.user_id}
          onChange={(e) => setManualActivation({ ...manualActivation, user_id: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            className={fieldClass}
            value={manualActivation.plan_id}
            onChange={(e) => setManualActivation({ ...manualActivation, plan_id: e.target.value })}
          >
            <option value="">{t('subscription.choosePlan', 'Choose plan')}</option>
            {plans.map((plan) => (
              <option key={plan._id} value={plan._id}>{plan.name}</option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={manualActivation.role}
            onChange={(e) => setManualActivation({ ...manualActivation, role: e.target.value })}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{label(role)}</option>
            ))}
          </select>
        </div>
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
    </Panel>
  );
}

function SubscriberTable({ subscriptions, updateSubscription, t, label }) {
  if (!subscriptions.length) {
    return <EmptyState title={t('subscription.noSubscribers', 'No subscribers yet.')} detail="Subscriptions will appear here when users pay or when an admin activates them manually." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="text-xs uppercase text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-3">{t('common.user', 'User')}</th>
            <th className="px-4 py-3">{t('subscription.plan', 'Plan')}</th>
            <th className="px-4 py-3">{t('common.status', 'Status')}</th>
            <th className="px-4 py-3">{t('common.amount', 'Amount')}</th>
            <th className="px-4 py-3">{t('subscription.expiryDate', 'Expiry date')}</th>
            <th className="px-4 py-3">{t('common.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const user = sub.user_id || {};
            const plan = sub.plan_id || {};
            const avatar = user.avatar || user.branding?.logo;
            return (
              <tr key={sub._id} className="border-t border-[var(--glass-border)] align-top">
                <td className="px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--accent)]/10 text-sm font-bold text-[var(--accent)]">
                      {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : (user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{user.name || t('common.unknown', 'Unknown')}</p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">{user.email || user.phone || '-'}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{label(sub.role || user.role || 'user')}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold">{plan.name || '-'}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{shortDate(sub.started_at)} - {shortDate(sub.expires_at)}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={sub.status} label={label} />
                </td>
                <td className="px-4 py-4 font-bold">{money(sub.amount_paid, sub.currency)}</td>
                <td className="px-4 py-4">
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
                    <CalendarClock className="size-4" />
                    {shortDate(sub.expires_at)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton icon={CheckCircle2} label={t('common.activate', 'Activate')} onClick={() => updateSubscription(sub._id, 'activate')} />
                    <ActionButton icon={XCircle} label={t('common.cancel', 'Cancel')} onClick={() => updateSubscription(sub._id, 'cancel')} />
                    <ActionButton danger icon={RotateCcw} label={t('common.refund', 'Refund')} onClick={() => updateSubscription(sub._id, 'refund')} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status, label }) {
  const tone = {
    active: 'bg-emerald-500/10 text-emerald-600',
    pending: 'bg-amber-500/10 text-amber-600',
    grace: 'bg-blue-500/10 text-blue-600',
    limited: 'bg-red-500/10 text-red-500',
    cancelled: 'bg-slate-500/10 text-slate-500',
    refunded: 'bg-purple-500/10 text-purple-600',
  }[status] || 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone}`}>
      {label(status || 'unknown')}
    </span>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition active:scale-95 ${danger ? 'border-red-500/20 text-red-500' : 'border-[var(--glass-border)] text-[var(--text-primary)]'}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-48 items-center justify-center rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]">
      <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
    </div>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)] p-8 text-center">
      <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
      {detail && <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-relaxed text-[var(--text-secondary)]">{detail}</p>}
    </div>
  );
}

