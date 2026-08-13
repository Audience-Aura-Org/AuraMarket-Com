"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-[var(--text-secondary)] tracking-tight mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[10px] text-[var(--text-secondary)] opacity-50">{hint}</p>}
  </div>
);

const NumInput = ({ value, onChange, min, max, step = 1 }) => (
  <input
    type="number"
    value={value}
    onChange={e => onChange(e.target.value)}
    min={min}
    max={max}
    step={step}
    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
  />
);

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get('/admin/settings')
      .then(res => { if (res.data.success) setS(res.data.data.settings); })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const field = (key) => ({
    value: s?.[key] ?? '',
    onChange: (v) => setS(prev => ({ ...prev, [key]: v })),
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/admin/settings', s);
      if (res.data.success) {
        setS(res.data.data.settings);
        toast.success('Settings saved');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Platform Settings</h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Changes take effect immediately — no deploy needed.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[12px] font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </button>
      </div>

      {/* ── Commission ── */}
      <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 space-y-4">
        <h2 className="text-[12px] font-bold text-[var(--accent)] tracking-widest uppercase">Commission</h2>
        <Field label="Commission rate (%)" hint="Platform cut on every retail order settlement.">
          <NumInput min={0} max={100} step={0.5} {...field('commission_rate')} />
        </Field>
        <Field label="Withdrawal fee (XAF)" hint="Fixed fee deducted from each withdrawal request.">
          <NumInput min={0} {...field('withdrawal_fee')} />
        </Field>
        <Field label="Minimum withdrawal amount (XAF)">
          <NumInput min={0} {...field('min_withdrawal_amount')} />
        </Field>
      </section>

      {/* ── Restaurant / Dine ── */}
      <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 space-y-4">
        <h2 className="text-[12px] font-bold text-orange-400 tracking-widest uppercase">Restaurant / Dine</h2>

        <Field
          label="Kitchen acceptance timeout (minutes)"
          hint="If a restaurant doesn't accept within this window the order is auto-cancelled and refunded."
        >
          <NumInput min={1} max={60} {...field('food_acceptance_timeout_minutes')} />
        </Field>

        <Field
          label="New-restaurant hold threshold (orders)"
          hint="Number of successfully delivered orders before a restaurant graduates to instant settlement. Currently: 5."
        >
          <NumInput min={0} {...field('new_restaurant_hold_order_count')} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Withdrawal gate — min orders"
            hint="Restaurant must have this many completed orders before first withdrawal."
          >
            <NumInput min={0} {...field('restaurant_min_withdrawal_orders')} />
          </Field>
          <Field
            label="Withdrawal gate — min days"
            hint="Restaurant account must be at least this many days old."
          >
            <NumInput min={0} {...field('restaurant_min_withdrawal_age_days')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Cancel-rate threshold (0–1)"
            hint="Restaurants above this cancel rate are auto-held. e.g. 0.25 = 25%."
          >
            <NumInput min={0} max={1} step={0.01} {...field('restaurant_cancel_rate_threshold')} />
          </Field>
          <Field
            label="Cancel-rate rolling window (days)"
            hint="How many days of order history the cancel-rate monitor looks at."
          >
            <NumInput min={1} {...field('restaurant_cancel_rate_window_days')} />
          </Field>
        </div>
      </section>
    </div>
  );
}
