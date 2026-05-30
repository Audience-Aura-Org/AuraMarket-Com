"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Loader2,
  MapPin,
  Mail,
  Phone,
  LayoutGrid,
  ShoppingBag,
  Store,
  Truck,
  User,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';

const cleanEmail = (value) => value.trim().toLowerCase();
const inputClass = 'w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30';
const vehicleTypes = ['motorcycle', 'car', 'van', 'truck'];

export default function UnifiedAuth() {
  const router = useRouter();
  const { sendOtp, verifyOtp, rememberedEmail, hasHydrated, loading } = useAuthStore();
  const prefilledRef = useRef(false);

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState({ categories: [], vendors: [], zones: [] });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    role: 'customer',
    store_name: '',
    description: '',
    company_name: '',
    location: { city: '', quartier: '', address_description: '' },
    category_ids: [],
    followed_vendor_ids: [],
    service_regions: [],
    vehicle_types: ['motorcycle'],
  });

  useEffect(() => {
    if (hasHydrated && rememberedEmail && !prefilledRef.current) {
      prefilledRef.current = true;
      setEmail(rememberedEmail);
    }
  }, [hasHydrated, rememberedEmail]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step !== 'signup' || lookupLoading || lookup.categories.length > 0) return;
    setLookupLoading(true);
    Promise.allSettled([
      api.get('/categories'),
      api.get('/vendors?limit=24&sort=-rating'),
      api.get('/logistics/zones'),
    ]).then(([categoriesRes, vendorsRes, zonesRes]) => {
      setLookup({
        categories: categoriesRes.status === 'fulfilled' ? (categoriesRes.value.data.data || []) : [],
        vendors: vendorsRes.status === 'fulfilled' ? (vendorsRes.value.data.data?.stores || []) : [],
        zones: zonesRes.status === 'fulfilled' ? (zonesRes.value.data.data?.zones || []) : [],
      });
    }).finally(() => setLookupLoading(false));
  }, [step, lookupLoading, lookup.categories.length]);

  const redirectAfterAuth = (user) => {
    const role = user?.role?.toLowerCase();
    if (role === 'vendor') router.push('/vendor/dashboard');
    else if (role === 'admin') router.push('/admin/dashboard');
    else if (role === 'logistics') router.push('/logistics/dashboard');
    else if (user?.onboarded === false) router.push('/onboarding');
    else router.push('/discovery');
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    setError('');
    const nextEmail = cleanEmail(email);
    if (!nextEmail) return;

    const result = await sendOtp(nextEmail);
    if (!result.success) {
      setError(result.message);
      if (result.retryAfter) setResendIn(result.retryAfter);
      return;
    }

    setEmail(nextEmail);
    setOtp('');
    setResendIn(result.data?.resendAfterSeconds || 60);
    setStep('otp');
    toast.success('Verification code sent');
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError('');
    const result = await verifyOtp({ email, otp });

    if (!result.success) {
      setError(result.message);
      if (result.retryAfter) setResendIn(result.retryAfter);
      return;
    }

    if (result.signupRequired) {
      setSignupToken(result.signupToken);
      setStep('signup');
      return;
    }

    redirectAfterAuth(result.user);
  };

  const completeSignup = async (event) => {
    event.preventDefault();
    setError('');
    const role = profile.role;
    const location = profile.location;
    const requiresCategories = role === 'customer' || role === 'vendor';

    if (!profile.phone) return setError('Phone number is required.');
    if (requiresCategories && profile.category_ids.length < 2) return setError('Choose at least 2 categories.');
    if (role === 'customer' && lookup.vendors.length >= 2 && profile.followed_vendor_ids.length < 2) {
      return setError('Follow at least 2 vendors.');
    }
    if ((role === 'customer' || role === 'vendor') && (!location.city || !location.quartier)) {
      return setError('Choose your city and zone.');
    }
    if (role === 'vendor' && (!profile.store_name || !profile.description)) {
      return setError('Store name and description are required.');
    }
    if (role === 'logistics' && (!profile.company_name || profile.service_regions.length === 0 || profile.vehicle_types.length === 0)) {
      return setError('Company name, service regions and vehicle types are required.');
    }

    const result = await verifyOtp({
      signupToken,
      name: profile.name,
      phone: profile.phone ? profile.phone.replace(/[\s-]/g, '') : '',
      role: profile.role,
      onboarding: {
        store_name: profile.store_name,
        description: profile.description,
        company_name: profile.company_name,
        location: profile.location,
        category_ids: profile.category_ids,
        followed_vendor_ids: profile.followed_vendor_ids,
        service_regions: profile.service_regions,
        vehicle_types: profile.vehicle_types,
      },
    });

    if (!result.success) {
      setError(result.message);
      return;
    }

    redirectAfterAuth(result.user);
  };

  const updateProfile = (patch) => setProfile((current) => ({ ...current, ...patch }));

  const updateLocation = (patch) => {
    setProfile((current) => ({
      ...current,
      location: { ...current.location, ...patch },
    }));
  };

  const toggleArrayValue = (key, value, limit = 20) => {
    setProfile((current) => {
      const existing = current[key] || [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value].slice(0, limit);
      return { ...current, [key]: next };
    });
  };

  const cities = lookup.zones.filter((zone) => zone.type === 'region');
  const quartiers = lookup.zones.filter(
    (zone) => zone.type === 'quartier' && zone.parent_id?.name === profile.location.city
  );

  return (
    <div className="w-full max-w-[420px] mx-auto transition-all duration-700">
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[2rem] p-5 md:p-7 shadow-2xl relative max-h-[calc(100vh-3rem)] overflow-y-auto">
        <div className="flex justify-center gap-1 mb-6">
          {['email', 'otp', 'signup'].map((id) => (
            <div
              key={id}
              className={`h-1 rounded-full transition-all duration-500 ${
                step === id ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--accent)]/30'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={requestOtp}
              className="space-y-5"
            >
              <div className="text-center space-y-1">
                <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Welcome to Aura Dime</h1>
                <p className="text-[11px] text-[var(--text-secondary)] opacity-60">
                  Enter your email and we will send a verification code.
                </p>
              </div>

              <AuthField icon={Mail}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </AuthField>

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={loading} label="Send code" icon={ArrowRight} />
            </motion.form>
          )}

          {step === 'otp' && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={verifyCode}
              className="space-y-5"
            >
              <BackButton onClick={() => setStep('email')} label="Change email" />

              <div className="space-y-1">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">Check your email</h2>
                <p className="text-[11px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">{email}</p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 px-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/20"
              />

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={loading} label="Verify code" icon={CircleCheck} />

              <button
                type="button"
                onClick={requestOtp}
                disabled={loading || resendIn > 0}
                className="w-full py-3 rounded-2xl border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] disabled:opacity-45"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
            </motion.form>
          )}

          {step === 'signup' && (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={completeSignup}
              className="space-y-5"
            >
              <BackButton onClick={() => setStep('otp')} label="Back to code" />

              <div className="space-y-1">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">Complete your profile</h2>
                <p className="text-[11px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">{email}</p>
              </div>

              <AuthField icon={User}>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={profile.name}
                  onChange={(event) => updateProfile({ name: event.target.value })}
                  placeholder="Full name"
                  autoComplete="name"
                  className={inputClass}
                />
              </AuthField>

              <AuthField icon={Phone}>
                <input
                  type="tel"
                  required
                  value={profile.phone}
                  onChange={(event) => updateProfile({ phone: event.target.value })}
                  placeholder="Phone number"
                  autoComplete="tel"
                  className={inputClass}
                />
              </AuthField>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/50">Continue as</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['customer', ShoppingBag],
                    ['vendor', Store],
                    ['logistics', Truck],
                  ].map(([role, Icon]) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => updateProfile({ role })}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all ${
                        profile.role === role
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                          : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-semibold tracking-tighter capitalize">{role}</span>
                    </button>
                  ))}
                </div>
              </div>

              {lookupLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <Loader2 className="size-3.5 animate-spin" />
                  Preparing onboarding fields...
                </div>
              )}

              {profile.role === 'vendor' && (
                <div className="space-y-3">
                  <AuthField icon={Store}>
                    <input
                      type="text"
                      required
                      value={profile.store_name}
                      onChange={(event) => updateProfile({ store_name: event.target.value })}
                      placeholder="Store name"
                      className={inputClass}
                    />
                  </AuthField>
                  <textarea
                    required
                    value={profile.description}
                    onChange={(event) => updateProfile({ description: event.target.value })}
                    placeholder="Short store description"
                    rows={3}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all resize-none placeholder:text-[var(--text-secondary)]/30"
                  />
                </div>
              )}

              {profile.role === 'logistics' && (
                <div className="space-y-3">
                  <AuthField icon={Truck}>
                    <input
                      type="text"
                      required
                      value={profile.company_name}
                      onChange={(event) => updateProfile({ company_name: event.target.value })}
                      placeholder="Logistics company name"
                      className={inputClass}
                    />
                  </AuthField>
                  <MultiSelect
                    title="Service regions"
                    icon={MapPin}
                    items={cities.map((city) => ({ id: city.name, name: city.name }))}
                    selected={profile.service_regions}
                    onToggle={(value) => toggleArrayValue('service_regions', value, 20)}
                    emptyText="Regions will load automatically"
                  />
                  <MultiSelect
                    title="Vehicle types"
                    icon={Truck}
                    items={vehicleTypes.map((type) => ({ id: type, name: type }))}
                    selected={profile.vehicle_types}
                    onToggle={(value) => toggleArrayValue('vehicle_types', value, 4)}
                  />
                </div>
              )}

              {(profile.role === 'customer' || profile.role === 'vendor') && (
                <div className="space-y-3">
                  <MultiSelect
                    title={profile.role === 'vendor' ? 'Trade categories' : 'Interests'}
                    icon={LayoutGrid}
                    items={lookup.categories.slice(0, 18).map((category) => ({ id: category._id, name: category.name }))}
                    selected={profile.category_ids}
                    onToggle={(value) => toggleArrayValue('category_ids', value, 30)}
                    minLabel={`${profile.category_ids.length}/2 selected`}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <AuthField icon={MapPin}>
                      <select
                        required
                        value={profile.location.city}
                        onChange={(event) => updateLocation({ city: event.target.value, quartier: '' })}
                        className={inputClass}
                      >
                        <option value="">City</option>
                        {cities.map((city) => <option key={city._id} value={city.name}>{city.name}</option>)}
                      </select>
                    </AuthField>
                    <AuthField icon={MapPin}>
                      <select
                        required
                        value={profile.location.quartier}
                        onChange={(event) => updateLocation({ quartier: event.target.value })}
                        className={inputClass}
                      >
                        <option value="">Zone</option>
                        {quartiers.map((zone) => <option key={zone._id} value={zone.name}>{zone.name}</option>)}
                      </select>
                    </AuthField>
                  </div>

                  <textarea
                    value={profile.location.address_description}
                    onChange={(event) => updateLocation({ address_description: event.target.value })}
                    placeholder={profile.role === 'vendor' ? 'Pickup notes or nearest landmark' : 'Delivery notes or nearest landmark'}
                    rows={2}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all resize-none placeholder:text-[var(--text-secondary)]/30"
                  />
                </div>
              )}

              {profile.role === 'customer' && (
                <MultiSelect
                  title="Follow vendors"
                  icon={Users}
                  items={lookup.vendors.slice(0, 12).map((vendor) => ({ id: vendor._id, name: vendor.store_name }))}
                  selected={profile.followed_vendor_ids}
                  onToggle={(value) => toggleArrayValue('followed_vendor_ids', value, 20)}
                  minLabel={`${profile.followed_vendor_ids.length} followed`}
                  emptyText="Vendor suggestions will load automatically"
                />
              )}

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={loading} label="Enter Auradime" icon={ArrowRight} />
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MultiSelect({ title, icon: Icon, items, selected, onToggle, minLabel, emptyText = 'Nothing available yet' }) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/60">
          <Icon className="size-3.5 text-[var(--accent)]" />
          {title}
        </div>
        {minLabel && <span className="text-[10px] font-semibold text-[var(--accent)]">{minLabel}</span>}
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-center text-[11px] font-semibold text-[var(--text-secondary)]/50">{emptyText}</p>
      ) : (
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold capitalize transition-all ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)]'
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuthField({ icon: Icon, children }) {
  return (
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-colors group-focus-within:text-[var(--accent)]">
        <Icon className="w-5 h-5" />
      </div>
      {children}
    </div>
  );
}

function SubmitButton({ loading, label, icon: Icon }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-white font-semibold text-[12px] shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{label}</span><Icon className="w-4 h-4" /></>}
    </button>
  );
}

function BackButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all mb-2"
    >
      <ArrowLeft className="w-3 h-3" />
      {label}
    </button>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-semibold text-center">
      {message}
    </div>
  );
}
