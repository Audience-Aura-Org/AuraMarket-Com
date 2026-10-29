"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle2, Truck, AlertTriangle, ToggleRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
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

// Rollout switches (PlatformSettings.features, see backend utils/featureFlags.js), in
// the recommended order of turning them on. All start off.
const FEATURES = [
  { key: 'location_picker', label: 'Map pin when choosing addresses', hint: 'Customers search their quartier and drop a pin on a map for the exact spot. Prices still follow the district list.' },
  { key: 'tracking_links', label: 'Secure tracking links', hint: 'Agencies share a private tracking link (e.g. over WhatsApp) instead of a guessable code.' },
  { key: 'agency_packages', label: 'Agencies add their own packages', hint: 'Delivery agencies register packages from walk-in customers and send them a tracking link.' },
  { key: 'rider_accounts', label: 'Rider accounts', hint: 'Agencies invite riders by email; riders get the Rider page to go online and take deliveries.' },
  { key: 'live_tracking', label: 'Live rider location for customers', hint: 'While a delivery is under way, the sender, recipient and tracking-link holder see the rider move on a map.' },
  { key: 'auto_rider_dispatch', mode: true, label: 'Automatic rider assignment', hint: 'Offers each delivery to the nearest free rider, then the next one on decline or timeout. Shadow: only records who it would pick (see Manifests) while agencies still assign by hand.' },
  { key: 'payment_triggered_dispatch', label: 'Dispatch as soon as it is paid', hint: 'With automatic assignment on, a delivery goes to a rider the moment it is paid instead of within 30 seconds.' },
  { key: 'whatsapp_notifications', label: 'WhatsApp notifications', hint: 'Sends order, payment, delivery and security updates on WhatsApp to users who opted in. Turn on only once the message templates show Active in WhatsApp Manager.', warn: true },
  { key: 'auto_agency_dispatch', mode: true, label: 'Automatic agency choice', hint: 'Not built yet (only needed with several agencies). Leave off.', disabled: true },
  { key: 'enhanced_chat', label: 'Enhanced chat', hint: 'Reserved. Chat replies and the faster inbox are already live for everyone. Leave off.', disabled: true },
];
const MODES = [['off', 'Off'], ['shadow', 'Shadow'], ['on', 'On']];

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState(null);
  const [firms, setFirms] = useState([]);
  const [features, setFeatures] = useState({});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !authLoading && user?.role !== 'admin') {
      router.replace('/admin/dashboard');
    }
  }, [mounted, authLoading, user, router]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    Promise.all([
      api.get('/admin/settings'),
      api.get('/admin/logistics/firms'),
    ])
      .then(([settingsRes, firmsRes]) => {
        if (settingsRes.data.success) {
          setS(settingsRes.data.data.settings);
          setFeatures(settingsRes.data.data.settings?.features || {});
        }
        if (firmsRes.data.success) setFirms(firmsRes.data.data.firms || []);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [user?.role]);

  const field = (key) => ({
    value: s?.[key] ?? '',
    onChange: (v) => setS(prev => ({ ...prev, [key]: v })),
  });

  const save = async () => {
    setSaving(true);
    try {
      // Only known switches are sent: the server refuses unknown ones.
      const flags = Object.fromEntries(FEATURES.map((f) => [f.key, f.mode ? (['off', 'shadow', 'on'].includes(features[f.key]) ? features[f.key] : 'off') : features[f.key] === true]));
      const res = await api.patch('/admin/settings', { ...s, features: flags });
      if (res.data.success) {
        setS(res.data.data.settings);
        setFeatures(res.data.data.settings?.features || flags);
        toast.success('Settings saved');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = (firmId) => {
    const ids = [...(s?.p2p_logistics_provider_ids || [])];
    const idx = ids.indexOf(firmId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(firmId);
    setS(prev => ({ ...prev, p2p_logistics_provider_ids: ids }));
  };

  const setWeightMultiplier = (tier, value) => {
    setS(prev => ({
      ...prev,
      p2p_weight_multipliers: {
        ...(prev?.p2p_weight_multipliers || {}),
        [tier]: value,
      },
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
    </div>
  );

  const verifiedFirms = firms.filter(f => f.is_verified);

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

      {/* ── Feature rollout ── */}
      <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 space-y-3">
        <div>
          <h2 className="text-[12px] font-bold text-emerald-500 tracking-widest uppercase flex items-center gap-2">
            <ToggleRight className="size-3.5" /> Features
          </h2>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Turn new features on one at a time, top to bottom. Press Save to apply.</p>
        </div>
        <ul className="divide-y divide-[var(--glass-border)]">
          {FEATURES.map((f) => {
            const value = features[f.key];
            const on = f.mode ? value === 'on' || value === 'shadow' : value === true;
            return (
              <li key={f.key} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${f.disabled ? 'opacity-50' : ''}`}>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                    {f.label}
                    {f.warn && <AlertTriangle className="size-3.5 text-amber-500" aria-label="Check before turning on" />}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{f.hint}</p>
                </div>
                {f.mode ? (
                  <div className="flex shrink-0 rounded-xl bg-[var(--bg-secondary)] p-1" role="radiogroup" aria-label={f.label}>
                    {MODES.map(([m, label]) => (
                      <button key={m} type="button" role="radio" aria-checked={(value || 'off') === m} disabled={f.disabled}
                        onClick={() => setFeatures((prev) => ({ ...prev, [f.key]: m }))}
                        className={`min-h-9 rounded-lg px-3 text-[11px] font-semibold ${(value || 'off') === m ? (m === 'on' ? 'bg-emerald-600 text-white' : m === 'shadow' ? 'bg-amber-500 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm') : 'text-[var(--text-secondary)]'}`}>{label}</button>
                    ))}
                  </div>
                ) : (
                  <button type="button" role="switch" aria-checked={on} aria-label={f.label} disabled={f.disabled}
                    onClick={() => setFeatures((prev) => ({ ...prev, [f.key]: !on }))}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-[var(--bg-secondary)] ring-1 ring-[var(--glass-border)]'}`}>
                    <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

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

        <Field label="Withdrawal Maintenance Mode" hint="When enabled, all new withdrawal requests are blocked with a maintenance message. Existing pending requests remain in the admin queue.">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s?.withdrawals_maintenance_mode || false}
              onChange={e => setS(prev => ({ ...prev, withdrawals_maintenance_mode: e.target.checked }))}
              className="accent-red-500 size-4"
            />
            <span className={`text-[12px] font-semibold flex items-center gap-1.5 ${s?.withdrawals_maintenance_mode ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
              {s?.withdrawals_maintenance_mode && <AlertTriangle className="size-3.5" />}
              {s?.withdrawals_maintenance_mode ? 'Withdrawals Paused' : 'Withdrawals Active'}
            </span>
          </label>
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

      {/* ── P2P Delivery ── */}
      <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 space-y-4">
        <h2 className="text-[12px] font-bold text-blue-400 tracking-widest uppercase flex items-center gap-2">
          <Truck className="size-3.5" /> P2P Pickup & Delivery
        </h2>

        <Field label="Enable P2P Delivery" hint="Allow users to book person-to-person deliveries on the platform.">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s?.p2p_enabled || false}
              onChange={e => setS(prev => ({ ...prev, p2p_enabled: e.target.checked }))}
              className="accent-[var(--accent)] size-4"
            />
            <span className={`text-[12px] font-semibold ${s?.p2p_enabled ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`}>
              {s?.p2p_enabled ? 'Active' : 'Disabled'}
            </span>
          </label>
        </Field>

        <Field label="Enabled Providers" hint="Select logistics firms that can handle P2P deliveries. Users will see all enabled providers and choose one.">
          {verifiedFirms.length === 0 ? (
            <p className="text-[11px] text-[var(--text-secondary)] opacity-60 italic">No verified logistics firms found.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 p-3">
              {verifiedFirms.map(f => (
                <label
                  key={f._id}
                  className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-xl transition-all ${
                    (s?.p2p_logistics_provider_ids || []).includes(f._id)
                      ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                      : 'hover:bg-[var(--bg-secondary)] border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={(s?.p2p_logistics_provider_ids || []).includes(f._id)}
                    onChange={() => toggleProvider(f._id)}
                    className="accent-[var(--accent)] size-4 shrink-0"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    {f.logo ? (
                      <img src={f.logo} className="size-7 rounded-lg object-cover shrink-0" alt="" />
                    ) : (
                      <div className="size-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] text-[10px] font-bold shrink-0">
                        {f.company_name?.[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{f.company_name}</p>
                      {f.vehicle_types?.length > 0 && (
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">{f.vehicle_types.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="P2P Commission (%)" hint="Platform cut on each P2P delivery.">
            <NumInput min={0} max={100} step={0.5} {...field('p2p_commission_percent')} />
          </Field>
          <Field label="Cancellation Fee (XAF)" hint="Charged when cancelling after rider dispatch.">
            <NumInput min={0} {...field('p2p_cancellation_fee')} />
          </Field>
        </div>

        <Field label="KYC Threshold (XAF)" hint="Declared value above this requires a verified account.">
          <NumInput min={0} {...field('p2p_kyc_threshold')} />
        </Field>

        <Field label="Weight Multipliers" hint="Price multipliers applied based on package weight tier.">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Light (&lt; 5 kg)</label>
              <NumInput min={0} step={0.1} value={s?.p2p_weight_multipliers?.light ?? 1} onChange={v => setWeightMultiplier('light', v)} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Medium (5–15 kg)</label>
              <NumInput min={0} step={0.1} value={s?.p2p_weight_multipliers?.medium ?? 1.3} onChange={v => setWeightMultiplier('medium', v)} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Heavy (15–30 kg)</label>
              <NumInput min={0} step={0.1} value={s?.p2p_weight_multipliers?.heavy ?? 1.8} onChange={v => setWeightMultiplier('heavy', v)} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Extra Heavy (30+ kg)</label>
              <NumInput min={0} step={0.1} value={s?.p2p_weight_multipliers?.extra_heavy ?? 2.5} onChange={v => setWeightMultiplier('extra_heavy', v)} />
            </div>
          </div>
        </Field>
      </section>
    </div>
  );
}
