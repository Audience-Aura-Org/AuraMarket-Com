"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Heart, MapPin, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Store,
  LayoutGrid, Check, Search, SkipForward, Globe,
  Phone, Sparkles, Zap, Star, ChevronRight, ShieldCheck, Plus, Truck,
  Utensils, Download,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useLanguage } from '@/context/LanguageContext';

const STEPS = [
  { id: 'location', title: 'Your Location', subtitle: 'City, zone & contact', icon: MapPin, color: 'emerald' },
  { id: 'vendors', title: 'Follow Vendors', subtitle: 'Pick 2+ stores you love', icon: Users, color: 'blue' },
  { id: 'done', title: 'All Set!', subtitle: 'Enter the marketplace', icon: CheckCircle2, color: 'accent' },
];

const VENDOR_STEPS = [
  { id: 'profile', title: 'Your Brand', subtitle: 'Name, phone & description', icon: Store, color: 'amber' },
  { id: 'location', title: 'Pickup Base', subtitle: 'City & zone for logistics', icon: MapPin, color: 'emerald' },
  { id: 'done', title: 'Go Live!', subtitle: 'Launch your store', icon: Sparkles, color: 'accent' },
];

const LOGISTICS_STEPS = [
  { id: 'profile', title: 'Carrier Profile', subtitle: 'Company, phone & fleet', icon: Truck, color: 'amber' },
  { id: 'regions', title: 'Service Regions', subtitle: 'Pick your operating cities', icon: MapPin, color: 'emerald' },
  { id: 'done', title: 'Ready to Deliver', subtitle: 'Enter logistics dashboard', icon: Sparkles, color: 'accent' },
];

const VEHICLE_TYPES = ['motorcycle', 'car', 'van', 'truck'];
const SUBSCRIPTION_AFTER_ONBOARDING_KEY = 'aura_show_subscription_after_onboarding';

const COLOR_MAP = {
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  accent: { bg: 'bg-[var(--accent)]/15', text: 'text-[var(--accent)]', border: 'border-[var(--accent)]/30', glow: 'shadow-[var(--accent)]/20' },
};

export default function OnboardingFlow() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // UI state
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [quartierSearch, setQuartierSearch] = useState('');
  const [fetching, setFetching] = useState(true);
  const [syncing, setSyncing] = useState(null);

  // Data
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);

  // Selections
  const [followedVendors, setFollowedVendors] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [location, setLocation] = useState({ city: '', zone: '', quartier: '', address_description: '' });
  const [phone, setPhone] = useState('');
  const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(30);
  const [vendorProfile, setVendorProfile] = useState({ store_name: '', description: '' });
  const [vendorType, setVendorType] = useState('retail');
  const [logisticsProfile, setLogisticsProfile] = useState({
    company_name: '',
    service_regions: [],
    vehicle_types: ['motorcycle'],
  });

  const isVendor = user?.role === 'vendor';
  const isLogistics = user?.role === 'logistics';
  const STEPS_ACTIVE = isLogistics ? LOGISTICS_STEPS : isVendor ? VENDOR_STEPS : STEPS;
  const currentStepMeta = STEPS_ACTIVE[step];
  const colors = COLOR_MAP[currentStepMeta?.color || 'accent'];
  const subscriptionGuide = isVendor
    ? {
        title: t('onboarding.vendorSubscriptionTitle'),
        detail: t('onboarding.vendorSubscriptionDetail'),
        cta: t('subscription.viewPackages'),
      }
    : isLogistics
      ? {
          title: t('onboarding.logisticsSubscriptionTitle'),
          detail: t('onboarding.logisticsSubscriptionDetail'),
          cta: t('subscription.viewPackages'),
        }
      : null;

  // Pre-fill from existing user data
  useEffect(() => {
    if (!user) return;
    if (user.liked_categories?.length > 0) setSelectedCategories(user.liked_categories.map(c => c._id || c));
    if (user.onboarding_location) {
      const ol = user.onboarding_location;
      // Backward compat: old data stored district name in `quartier`; new model has `zone` + `quartier`
      const zone = ol.zone || (!ol.zone && ol.quartier ? ol.quartier : '');
      const quartier = ol.zone ? (ol.quartier || '') : '';
      setLocation({ city: ol.city || '', zone, quartier, address_description: ol.address_description || '' });
    }
    if (user.phone) setPhone(user.phone);
    // Read vendor_type intent stored during signup
    try {
      const storedType = sessionStorage.getItem('aura_vendor_type');
      if (storedType) setVendorType(storedType);
    } catch {}
  }, [user]);

  // Initial fast fetch — vendors (TOP) + categories + follows only (no zones)
  useEffect(() => {
    if (!user) return;

    // Eject admins immediately. Logistics now completes setup here.
    // Vendors only get ejected if they have already onboarded AND are not forcing onboarding
    const role = user.role?.toLowerCase();
    if (role === 'admin') {
      console.warn('[Onboarding] Professional role detected, ejecting to dashboard:', role);
      router.replace('/admin/dashboard');
      return;
    }

    if (role === 'logistics' && user.onboarded) {
      router.replace('/logistics/dashboard');
      return;
    }

    if (role === 'logistics') {
      setFetching(false);
      return;
    }

    if (role === 'vendor' && user.onboarded) {
       // Optional: Add a check if they are explicitly here to "edit" or if they are lost
       console.log('[Onboarding] Vendor already onboarded, allowing stay or redirecting to dashboard if appropriate');
       // For now, let's keep the ejection but make it clear
       // router.replace('/vendor/dashboard'); 
       // return;
    }

    if (role === 'customer' && user.onboarded) {
      router.replace('/shop');
      return;
    }

    const fetchInitData = async () => {
      try {
        const [vRes, cRes, fRes] = await Promise.all([
          api.get('/vendors?limit=40&sort=-rating'),
          api.get('/categories'),
          api.get('/users/followed-vendors'),
        ]);

        const vendorList = vRes.data.data?.stores || [];
        const categoryList = cRes.data.data || [];
        const follows = fRes.data.data?.follows?.map(f => (f.vendor_id?._id || f.vendor_id).toString()) || [];

        setVendors(vendorList);
        setCategories(categoryList);
        setFollowedVendors(follows);

        if (isVendor && user.onboarded) {
          try {
            const vpRes = await api.get('/vendors/me');
            if (vpRes.data.success && vpRes.data.data.vendor) {
              const v = vpRes.data.data.vendor;
              setVendorProfile({ store_name: v.store_name || '', description: v.description || '' });
              if (v.phone) setPhone(v.phone);
              if (v.vendor_type) setVendorType(v.vendor_type);
            }
          } catch (e) {}
        }

        // Auto-ahead: if all data already collected, skip onboarding
        const hasFollows = follows.length >= 2;
        const hasLocation = !!user.onboarding_location?.city;
        const hasPhone = !!user.phone;
        if (!isVendor && !isLogistics && hasFollows && hasLocation && hasPhone) {
          router.replace('/shop');
        }
      } catch (err) {
        toast.error('Failed to load onboarding data.');
      } finally {
        setFetching(false);
      }
    };

    fetchInitData();
  }, [user, isVendor, isLogistics, router]);

  // Defer zones fetch until relevant step
  useEffect(() => {
    const locationStep = isLogistics ? 1 : isVendor ? 1 : 0;
    if (step === locationStep && zones.length === 0 && !zonesLoading) {
      setZonesLoading(true);
      api.get('/logistics/zones')
        .then(res => setZones(res.data.data?.zones || []))
        .catch(() => toast.error('Failed to load zones.'))
        .finally(() => setZonesLoading(false));
    }
  }, [step, zones.length, zonesLoading, isVendor, isLogistics]);

  const handleToggleFollow = useCallback(async (vId) => {
    const isFollowing = followedVendors.includes(vId);
    
    // Optimistic update
    setFollowedVendors(p => isFollowing ? p.filter(id => id !== vId) : [...p, vId]);
    setSyncing(vId);

    try {
      if (isFollowing) {
        await api.delete(`/vendors/${vId}/follow`);
      } else {
        try {
          await api.post(`/vendors/${vId}/follow`);
        } catch (err) {
          if (err.response?.status !== 400) throw err;
        }
      }
    } catch (err) {
      toast.error('Action failed.');
      // Revert optimistic update
      setFollowedVendors(p => isFollowing ? [...p, vId] : p.filter(id => id !== vId));
    } finally {
      setSyncing(null);
    }
  }, [followedVendors]);

  const dismissKeyboard = () => {
    if (typeof document !== 'undefined') {
      const activeEl = document.activeElement;
      if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
    }
  };

  const goNext = () => {
    dismissKeyboard();
    if (isVendor) {
      if (step === 0 && (!vendorProfile.store_name || !vendorProfile.description || !phone))
        return toast.error('Store name, description and phone are required.');
      if (step === 1 && (!location.city || !location.address_description))
        return toast.error('City and store pickup address details are required.');
    } else if (isLogistics) {
      if (step === 0 && (!logisticsProfile.company_name || !phone || logisticsProfile.vehicle_types.length === 0))
        return toast.error('Company name, phone and fleet type are required.');
      if (step === 1 && logisticsProfile.service_regions.length < 1)
        return toast.error('Select at least 1 service region.');
    } else {
      // Customer steps: Location (0) -> Vendors (1) -> done (2)
      if (step === 0 && (!location.city || !phone))
        return toast.error('City and phone are required.');
      if (step === 1 && followedVendors.length < 2) 
        return toast.error('Follow at least 2 vendors.');
    }
    setSearch('');
    setStep(s => s + 1);
  };

  const goBack = () => { dismissKeyboard(); setSearch(''); setStep(s => s - 1); };
  const skip = () => { dismissKeyboard(); sessionStorage.setItem('onboarding_skipped', 'true'); router.push('/shop'); };

  const finish = async () => {
    dismissKeyboard();
    setLoading(true);
    const consumeSubscriptionIntent = (role) => {
      try {
        const raw = sessionStorage.getItem(SUBSCRIPTION_AFTER_ONBOARDING_KEY);
        const intent = raw ? JSON.parse(raw) : null;
        if (intent?.role === role) {
          sessionStorage.removeItem(SUBSCRIPTION_AFTER_ONBOARDING_KEY);
          return true;
        }
      } catch {}
      return false;
    };
    try {
      if (isVendor) {
        const res = await api.post('/vendors/onboard', {
          store_name: vendorProfile.store_name,
          description: vendorProfile.description,
          categories: selectedCategories,
          location,
          phone,
          vendor_type: vendorType || 'retail',
        });
        try { sessionStorage.removeItem('aura_vendor_type'); } catch {}
        if (res.data.success) {
          if (res.data.data?.user) updateUser(res.data.data.user);
          if (consumeSubscriptionIntent('vendor')) {
            router.push('/subscribe?role=vendor');
            return;
          }
          router.push('/vendor/dashboard');
        }
      } else if (isLogistics) {
        const res = await api.post('/logistics/onboard', {
          company_name: logisticsProfile.company_name,
          contact_email: user.email,
          contact_phone: phone,
          service_regions: logisticsProfile.service_regions,
          vehicle_types: logisticsProfile.vehicle_types,
        });
        if (res.data.success) {
          if (res.data.data?.user) updateUser(res.data.data.user);
          if (consumeSubscriptionIntent('logistics')) {
            router.push('/subscribe?role=logistics');
            return;
          }
          router.push('/logistics/dashboard');
        }
      } else {
        const res = await api.patch('/users/onboarding', {
          liked_categories: selectedCategories,
          location,
          phone,
          onboarded: true,
        });
        if (res.data.success) {
          updateUser(res.data.data.user);
          router.push('/shop');
        }
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Onboarding could not be completed. Please try again.';
      console.error('[Onboarding] Finish failed:', message, err.response?.data || err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredVendors = vendors
    .filter(v => !search || v.store_name?.toLowerCase().includes(search.toLowerCase()));

  const filteredCategories = categories
    .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  
  const categoriesToShow = filteredCategories.slice(0, visibleCategoriesCount);
  const hasMoreCategories = filteredCategories.length > visibleCategoriesCount;

  // Dropdown-search filtered list (separate from the grid filter)
  const categoryDropdownResults = categorySearch.trim()
    ? categories.filter(c => c.name?.toLowerCase().includes(categorySearch.toLowerCase())).slice(0, 8)
    : [];

  const getZoneName = (zone) => String(zone?.name || zone?.label || zone?.title || '').trim();
  const getZoneParentName = (zone) => String(
    zone?.parent_id?.name ||
    zone?.parent?.name ||
    zone?.parent_name ||
    zone?.region_name ||
    zone?.region ||
    zone?.city ||
    ''
  ).trim();

  const cities = useMemo(() => {
    const cityMap = new Map();
    zones.forEach((zone) => {
      const type = String(zone?.type || '').toLowerCase();
      const name = getZoneName(zone);
      if ((type === 'region' || type === 'city') && name) {
        cityMap.set(name, { ...zone, name });
      }
    });

    if (cityMap.size === 0) {
      zones.forEach((zone) => {
        const parentName = getZoneParentName(zone);
        if (parentName) cityMap.set(parentName, { _id: parentName, name: parentName, type: 'region' });
      });
    }

    return Array.from(cityMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [zones]);

  const quartiers = useMemo(() => {
    if (!location.city) return [];

    return zones
      .filter((zone) => {
        const type = String(zone?.type || '').toLowerCase();
        const name = getZoneName(zone);
        // Include district, quartier, and neighbourhood-type zones
        if (!name || (type && !['district', 'quartier', 'zone', 'neighbourhood', 'neighborhood'].includes(type))) return false;

        const parentName = getZoneParentName(zone);
        return parentName === location.city || zone?.city === location.city || zone?.region === location.city;
      })
      .map((zone) => ({ ...zone, name: getZoneName(zone) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [zones, location.city]);

  // District zone selected by the user (needed to filter sub-quartiers)
  const selectedDistrictZone = useMemo(() => {
    if (!location.zone) return null;
    return quartiers.find(z => z.name === location.zone) || null;
  }, [quartiers, location.zone]);

  // Sub-quartiers: zones whose parent_id matches the selected district
  const subQuartiers = useMemo(() => {
    if (!selectedDistrictZone) return [];
    const districtId = selectedDistrictZone._id?.toString();
    if (!districtId) return [];
    return zones
      .filter(z => {
        const parentId = (z.parent_id?._id || z.parent_id)?.toString();
        return parentId === districtId;
      })
      .map(z => ({ ...z, name: getZoneName(z) }))
      .filter(z => z.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [zones, selectedDistrictZone]);

  const isLastStep = step === STEPS_ACTIVE.length - 1;

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (fetching || !mounted) {
    return <LoadingSpinner fullScreen />;
  }

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative md:pt-0">
      {/* Ambient glows */}
      <div className={`fixed top-0 right-0 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] rounded-full blur-[100px] sm:blur-[120px] -z-10 pointer-events-none opacity-25 sm:opacity-35 transition-all duration-700 ${colors.bg}`} />
      <div className={`fixed bottom-0 left-0 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full blur-[80px] sm:blur-[100px] -z-10 pointer-events-none opacity-15 sm:opacity-25 transition-all duration-700 ${colors.bg}`} />

      {/* Header / Step Progress */}
      <header className="sticky top-0 z-20 shrink-0 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 px-3 sm:px-4 md:px-6 md:py-5">
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 px-3 py-2.5 shadow-lg backdrop-blur-2xl sm:rounded-[1.5rem] sm:px-5">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center p-1.5 shrink-0">
              <img src="/icon-512.png" className="w-full h-auto" alt="" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[13px] font-black text-[var(--text-primary)] tracking-tight">Auradime</span>
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 tracking-wide">Setup</span>
            </div>
          </div>

          {/* Step Pills — numbered circles on desktop, thin bars on mobile */}
          <div className="hidden sm:flex items-center gap-0.5 sm:px-4 md:border-x md:border-[var(--glass-border)] md:py-0.5">
            {STEPS_ACTIVE.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className="flex items-center gap-0.5">
                  <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500 shrink-0 ${
                    active ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/40 scale-110'
                    : done ? 'bg-emerald-500 text-white'
                    : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40'
                  }`}>
                    {done ? <Check className="size-3" /> : <span>{i + 1}</span>}
                  </div>
                  {active && (
                    <span className="text-[10px] font-bold text-[var(--accent)] pl-1 pr-1 whitespace-nowrap">{s.title}</span>
                  )}
                  {i < STEPS_ACTIVE.length - 1 && (
                    <div className={`w-5 h-px mx-0.5 rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-[var(--glass-border)]'}`} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Mobile: thin progress bars at bottom of header */}
          <div className="absolute inset-x-4 bottom-0 translate-y-full flex items-center gap-1 sm:hidden pt-1 pb-0.5">
            {STEPS_ACTIVE.map((_, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className={`flex-1 h-[3px] rounded-full transition-all duration-500 ${
                  active ? 'bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]' : done ? 'bg-emerald-500/70' : 'bg-[var(--glass-border)]'
                }`} />
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isLastStep && !isVendor && !isLogistics && (
              <button
                onClick={skip}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 hover:opacity-100 hover:text-[var(--accent)] transition-all"
              >
                Skip <SkipForward className="size-3" />
              </button>
            )}
          </div>
        </div>
      </header>


      {subscriptionGuide && !isLastStep && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-2 md:px-6 md:pb-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-[var(--accent)]/20 bg-[var(--bg-primary)]/80 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between md:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Star className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)]">{subscriptionGuide.title}</p>
                <p className="mt-1 max-w-3xl text-[12px] font-medium leading-relaxed text-[var(--text-secondary)]">
                  {subscriptionGuide.detail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/subscribe?role=${user?.role || 'vendor'}`)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-4 py-2.5 text-[12px] font-bold text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-white"
            >
              {subscriptionGuide.cta}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-3 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(10rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(11rem+env(safe-area-inset-bottom,0px))] sm:px-5 md:space-y-7 md:px-6 md:py-5">
          {/* ── Step: Categories (Disabled) ── */}
          {false && (
            <div className="space-y-4 max-w-6xl mx-auto w-full">

              {/* Search + Dropdown */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={e => { setCategorySearch(e.target.value); setCategoryDropdownOpen(true); setSearch(e.target.value); }}
                    onFocus={() => setCategoryDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCategoryDropdownOpen(false), 150)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 py-3.5 text-[13px] font-semibold outline-none focus:border-[var(--accent)]/60 transition-all shadow-inner placeholder:text-[11px] placeholder:font-normal placeholder:opacity-30"
                  />
                  {/* Dropdown results — one per line full width */}
                  <AnimatePresence>
                    {categoryDropdownOpen && categoryDropdownResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] backdrop-blur-2xl shadow-2xl overflow-hidden"
                      >
                        {categoryDropdownResults.map((cat, idx) => {
                          const sel = selectedCategories.includes(cat._id);
                          return (
                            <div key={cat._id}>
                              {idx > 0 && <div className="h-px bg-[var(--glass-border)] mx-4" />}
                              <button
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                  setSelectedCategories(p => sel ? p.filter(id => id !== cat._id) : [...p, cat._id]);
                                  setCategorySearch('');
                                  setSearch('');
                                  setCategoryDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-[13px] font-semibold transition-colors ${
                                  sel
                                    ? 'bg-[var(--accent)]/8 text-[var(--accent)]'
                                    : 'hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                }`}
                              >
                                <div className={`size-7 rounded-xl flex items-center justify-center shrink-0 border ${
                                  sel
                                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                                    : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                                }`}>
                                  {sel ? <Check className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
                                </div>
                                <span className="flex-1">{cat.name}</span>
                                {sel && (
                                  <span className="text-[10px] font-bold text-[var(--accent)] opacity-70 shrink-0">✓ Selected</span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Selected count badge */}
                <div className="shrink-0 flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-[12px] font-bold text-rose-400">
                  <Heart className="size-3.5" />
                  {selectedCategories.length}/2+
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedCategories.length / 2) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-rose-400 shrink-0">{selectedCategories.length} selected</span>
              </div>

              {/* Category grid — 3 columns on all screen sizes */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
                {categoriesToShow.map(cat => {
                  const sel = selectedCategories.includes(cat._id);
                  return (
                    <button
                      key={cat._id}
                      onClick={() => setSelectedCategories(p => sel ? p.filter(id => id !== cat._id) : [...p, cat._id])}
                      className={`group relative flex min-h-[72px] sm:min-h-[82px] md:min-h-[96px] items-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 md:p-4 text-left transition-all duration-300 border ${
                        sel
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40 shadow-lg shadow-[var(--accent)]/10'
                          : 'bg-[var(--bg-primary)]/70 backdrop-blur-md border-[var(--glass-border)] hover:border-[var(--accent)]/20 hover:bg-[var(--bg-primary)]/90'
                      }`}
                    >
                      <div className={`size-8 sm:size-9 md:size-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
                        sel
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                          : 'bg-white/5 border-white/10 text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 group-hover:border-[var(--accent)]/30'
                      }`}>
                        <LayoutGrid className="size-3.5 sm:size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                        <span className={`line-clamp-2 text-[11px] sm:text-xs md:text-[13px] font-bold leading-snug tracking-tight transition-colors ${
                          sel ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                        }`}>{cat.name}</span>
                      </div>
                      {sel && (
                        <div className="absolute top-2 right-2 size-4 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg shrink-0">
                          <Check className="size-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* See More Pagination */}
              {hasMoreCategories && !search && (
                <div className="pt-4 flex justify-center">
                  <button
                    onClick={() => setVisibleCategoriesCount(p => p + 20)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] font-semibold tracking-tight text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-all shadow-sm"
                  >
                    Show more <ChevronRight className="size-3 text-[var(--accent)]" />
                  </button>
                </div>
              )}

              {filteredCategories.length === 0 && (
                <p className="text-center text-sm opacity-40 py-12">No categories match your search...</p>
              )}
            </div>
          )}

          {/* ── Step: Location (Customers: Step 0, Vendors: Step 1) ── */}
          {((!isVendor && !isLogistics && step === 0) || (isVendor && step === 1)) && (
            <div className="mx-auto w-full max-w-2xl space-y-4">

              {/* Customer-only: phone field */}
              {!isVendor && (
                <div className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm overflow-hidden group">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                    <div className="size-7 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
                      <Phone className="size-3.5 text-white" />
                    </div>
                    <span className="text-[12px] font-semibold text-[var(--text-secondary)] font-[Poppins]">Contact Number</span>
                  </div>
                  <div className="relative flex items-center px-1">
                    <input
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-transparent px-4 py-3.5 text-[15px] font-bold outline-none placeholder:text-[var(--text-secondary)]/30 text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}

              {/* City Picker Card */}
              <div className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm overflow-hidden">
                {/* Card header strip */}
                <div className="bg-emerald-500 px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                      <MapPin className="size-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-white/70 font-[Poppins]">
                        {isVendor ? 'Store Pickup City' : 'Your City'}
                      </p>
                      <p className="text-[14px] font-bold text-white leading-none font-[Poppins]">
                        {location.city || 'Choose a city'}
                      </p>
                    </div>
                  </div>
                  {location.city && (
                    <div className="size-6 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="size-3.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {zonesLoading ? (
                    <div className="flex items-center gap-2 py-3 text-[var(--text-secondary)]">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-[12px] font-semibold">Loading cities...</span>
                    </div>
                  ) : cities.length === 0 ? (
                    <p className="text-[12px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">No cities available yet.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search cities..."
                          value={citySearch}
                          onChange={e => setCitySearch(e.target.value)}
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-9 pr-3 py-2.5 text-[12px] font-semibold outline-none focus:border-emerald-500 transition-all placeholder:text-[var(--text-secondary)]/40"
                        />
                      </div>
                      {(() => {
                        const filtered = cities.filter(z => !citySearch || z.name.toLowerCase().includes(citySearch.toLowerCase()));
                        return filtered.length === 0 ? (
                          <p className="text-[11px] text-[var(--text-secondary)] font-medium py-1">No cities match "{citySearch}"</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {filtered.map((z) => {
                              const active = location.city === z.name;
                              return (
                                <button
                                  key={z._id || z.id || z.name}
                                  type="button"
                                  onClick={() => { setLocation(p => ({ ...p, city: z.name, zone: '', quartier: '' })); setCitySearch(''); }}
                                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all active:scale-[0.96] ${
                                    active
                                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/25'
                                      : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-primary)] hover:border-emerald-400 hover:bg-[var(--bg-primary)]'
                                  }`}
                                >
                                  <MapPin className={`size-3.5 shrink-0 ${active ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                                  <span className="flex-1 text-[12px] font-semibold font-[Poppins] truncate">{z.name}</span>
                                  {active && <Check className="size-3.5 text-white shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Zone Picker */}
              <AnimatePresence mode="wait">
                {location.city && (
                  <motion.div
                    key="zone-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm overflow-hidden"
                  >
                    <div className="bg-indigo-500 px-4 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                          <Globe className="size-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-white/70 font-[Poppins]">District / Zone <span className="text-white/40">(optional)</span></p>
                          <p className="text-[14px] font-bold text-white leading-none font-[Poppins]">
                            {location.zone || `Districts in ${location.city}`}
                          </p>
                        </div>
                      </div>
                      {location.zone && (
                        <div className="size-6 rounded-full bg-white/20 flex items-center justify-center">
                          <Check className="size-3.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {zonesLoading ? (
                        <div className="flex items-center gap-2 py-3 text-[var(--text-secondary)]">
                          <Loader2 className="size-4 animate-spin" />
                          <span className="text-[12px] font-semibold">Loading zones...</span>
                        </div>
                      ) : quartiers.length === 0 ? (
                        <p className="text-[12px] font-semibold text-amber-600">No zones found for {location.city}.</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)] pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Search zones..."
                              value={zoneSearch}
                              onChange={e => setZoneSearch(e.target.value)}
                              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-9 pr-3 py-2.5 text-[12px] font-semibold outline-none focus:border-indigo-500 transition-all placeholder:text-[var(--text-secondary)]/40"
                            />
                          </div>
                          {(() => {
                            const filtered = quartiers.filter(z => !zoneSearch || z.name.toLowerCase().includes(zoneSearch.toLowerCase()));
                            return filtered.length === 0 ? (
                              <p className="text-[11px] text-[var(--text-secondary)] font-medium py-1">No zones match "{zoneSearch}"</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {filtered.map((z) => {
                                  const active = location.zone === z.name;
                                  return (
                                    <button
                                      key={z._id || z.id || z.name}
                                      type="button"
                                      disabled={zonesLoading}
                                      onClick={() => { setLocation(p => ({ ...p, zone: z.name, quartier: '' })); setZoneSearch(''); setQuartierSearch(''); }}
                                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all active:scale-[0.96] disabled:opacity-40 ${
                                        active
                                          ? 'bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-500/25'
                                          : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-primary)] hover:border-indigo-400 hover:bg-[var(--bg-primary)]'
                                      }`}
                                    >
                                      <Globe className={`size-3.5 shrink-0 ${active ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                                      <span className="flex-1 text-[12px] font-semibold font-[Poppins] truncate">{z.name}</span>
                                      {active && <Check className="size-3.5 text-white shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quartier Picker */}
              <AnimatePresence mode="wait">
                {location.zone && subQuartiers.length > 0 && (
                  <motion.div
                    key="quartier-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm overflow-hidden"
                  >
                    <div className="bg-purple-500 px-4 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                          <MapPin className="size-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-white/70 font-[Poppins]">Quartier <span className="text-white/40">(optional)</span></p>
                          <p className="text-[14px] font-bold text-white leading-none font-[Poppins]">
                            {location.quartier || `Quartiers in ${location.zone}`}
                          </p>
                        </div>
                      </div>
                      {location.quartier && (
                        <div className="size-6 rounded-full bg-white/20 flex items-center justify-center">
                          <Check className="size-3.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search quartiers..."
                          value={quartierSearch}
                          onChange={e => setQuartierSearch(e.target.value)}
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-9 pr-3 py-2.5 text-[12px] font-semibold outline-none focus:border-purple-500 transition-all placeholder:text-[var(--text-secondary)]/40"
                        />
                      </div>
                      {(() => {
                        const filtered = subQuartiers.filter(z => !quartierSearch || z.name.toLowerCase().includes(quartierSearch.toLowerCase()));
                        return filtered.length === 0 ? (
                          <p className="text-[11px] text-[var(--text-secondary)] font-medium py-1">No quartiers match "{quartierSearch}"</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {filtered.map((z) => {
                              const active = location.quartier === z.name;
                              return (
                                <button
                                  key={z._id || z.id || z.name}
                                  type="button"
                                  onClick={() => { setLocation(p => ({ ...p, quartier: z.name })); setQuartierSearch(''); }}
                                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all active:scale-[0.96] ${
                                    active
                                      ? 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-500/25'
                                      : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-primary)] hover:border-purple-400 hover:bg-[var(--bg-primary)]'
                                  }`}
                                >
                                  <MapPin className={`size-3.5 shrink-0 ${active ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                                  <span className="flex-1 text-[12px] font-semibold font-[Poppins] truncate">{z.name}</span>
                                  {active && <Check className="size-3.5 text-white shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Address Notes */}
              <AnimatePresence mode="wait">
                {location.city && (
                  <motion.div
                    key="address-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, delay: 0.05, ease: 'easeOut' }}
                    className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm overflow-hidden group focus-within:border-[var(--accent)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                      <div className="size-7 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
                        <MapPin className="size-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-[var(--text-secondary)] font-[Poppins]">
                          {isVendor ? 'Pickup address notes' : 'Address notes'}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] opacity-50 font-medium">Landmarks, floor, gate...</p>
                      </div>
                    </div>
                    <textarea
                      placeholder={isVendor ? "e.g. Opposite Total Station, 2nd floor, gate #4..." : "e.g. Door #5, blue building near the market..."}
                      value={location.address_description}
                      onChange={e => setLocation(p => ({ ...p, address_description: e.target.value }))}
                      rows={3}
                      className="w-full bg-transparent px-4 py-3.5 text-[13px] font-medium outline-none resize-none placeholder:text-[var(--text-secondary)]/30 text-[var(--text-primary)] leading-relaxed"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Step: Vendors (Customers Step 1) ── */}
          {!isVendor && !isLogistics && step === 1 && (
             <div className="space-y-4">
               {/* Search Vendors */}
               <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                 <input
                   type="text"
                   placeholder="Search vendors..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-3 text-[13px] placeholder:text-[11px] placeholder:font-normal outline-none focus:border-[var(--accent)]/60 transition-all shadow-inner"
                 />
               </div>

               {/* Progress indicator */}
               <div className="flex items-center gap-3 px-1">
                 <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                   <div
                     className="h-full bg-blue-500 rounded-full transition-all duration-500"
                     style={{ width: `${Math.min(100, (followedVendors.length / 2) * 100)}%` }}
                   />
                 </div>
                 <span className="text-[11px] lg:text-[12px]  font-semibold text-blue-400 shrink-0">
                   {followedVendors.length}/2 Selected
                 </span>
               </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredVendors.slice(0, 20).map(v => {
                    const isFollowing = followedVendors.includes(v._id);
                    const isSyncing = syncing === v._id;
                    return (
                      <div 
                        key={v._id} 
                        className={`group flex items-center gap-3 p-3.5 rounded-[1.5rem] border transition-all duration-300 cursor-pointer ${isFollowing ? 'bg-blue-500/5 border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.1)]' : 'bg-[var(--bg-primary)]/40 backdrop-blur-md border-white/5 hover:border-blue-500/20 hover:bg-[var(--bg-primary)]/60'}`}
                        onClick={() => !isSyncing && handleToggleFollow(v._id)}
                     >
                       <div className={`size-10 rounded-xl overflow-hidden border transition-all duration-300 shrink-0 shadow-inner ${isFollowing ? 'border-blue-500/30' : 'border-white/10 opacity-60 group-hover:opacity-100 group-hover:border-blue-500/20'}`}>
                         {v.user_id?.branding?.logo || v.user_id?.avatar
                           ? <img src={v.user_id?.branding?.logo || v.user_id?.avatar} className="size-full object-cover" alt="" />
                           : <div className="size-full flex items-center justify-center text-[var(--accent)] font-bold text-lg">{v.store_name?.[0]}</div>
                         }
                       </div>
                       <div className="flex flex-col min-w-0 text-left">
                         <div className="flex items-center gap-1.5">
                           <span className={`text-[13px] font-bold tracking-tight transition-colors ${isFollowing ? 'text-blue-500' : 'text-[var(--text-primary)]'}`}>{v.store_name}</span>
                           {v.verified && <div className="size-3 rounded-full bg-blue-500 flex items-center justify-center"><div className="size-1 rounded-full bg-white" /></div>}
                         </div>
                         <span className="text-[10px] font-medium opacity-40 truncate">{v.description || 'Verified Aura Vendor'}</span>
                       </div>
                       <div className="ml-auto">
                         <div className={`size-6 rounded-lg border flex items-center justify-center transition-all duration-300 ${isFollowing ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'border-white/10 text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 group-hover:border-blue-500/30'}`}>
                           {isSyncing ? <Loader2 className="size-3 animate-spin" /> : isFollowing ? <div className="size-1.5 rounded-full bg-white" /> : <Plus className="size-3.5" />}
                         </div>
                       </div>
                     </div>
                    );
                  })}
                </div>
               {vendors.length === 0 && <p className="text-center text-sm opacity-40 py-12">Connecting to vendor matrix...</p>}
             </div>
          )}

          {/* ── Step: Vendor Profile (Vendors Step 0) ── */}
          {isVendor && step === 0 && (
            <div className="mx-auto w-full max-w-2xl space-y-4">

              {/* Brand Identity Hero Card */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-[var(--bg-primary)]/80 backdrop-blur-2xl shadow-2xl p-6">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/60 via-[var(--accent)]/80 to-indigo-500/60 rounded-t-3xl" />
                <div className="absolute -top-10 -right-10 size-40 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />

                {/* Avatar + header row */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative shrink-0">
                    <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-500/25 to-[var(--accent)]/25 border border-amber-500/30 flex items-center justify-center shadow-xl shadow-amber-500/10">
                      {vendorProfile.store_name ? (
                        <span className="text-2xl font-black text-amber-400 leading-none">
                          {vendorProfile.store_name[0].toUpperCase()}
                        </span>
                      ) : (
                        <Store className="size-7 text-amber-400/60" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)] flex items-center justify-center shadow">
                      <Check className="size-2.5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-amber-400 font-[Poppins]">Brand Identity</p>
                    <p className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5 leading-tight truncate font-[Poppins]">
                      {vendorProfile.store_name || 'Your Store Name'}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] opacity-40 font-medium mt-0.5 font-[Poppins]">Complete your profile below</p>
                  </div>
                </div>

                {/* Store Name Field */}
                <div className="group space-y-1.5">
                  <label className="text-[12px] font-semibold text-[var(--text-secondary)] opacity-60 group-focus-within:text-amber-400 group-focus-within:opacity-100 transition-all duration-200 block font-[Poppins]">
                    Store Name
                  </label>
                  <div className="relative flex items-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 group-focus-within:border-amber-500/50 group-focus-within:bg-[var(--bg-primary)]/80 transition-all duration-300">
                    <Store className="absolute left-4 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:text-amber-400 group-focus-within:opacity-80 transition-all duration-200 shrink-0" />
                    <input
                      type="text"
                      placeholder="e.g. Aura Fashion House"
                      value={vendorProfile.store_name}
                      onChange={e => setVendorProfile(p => ({ ...p, store_name: e.target.value }))}
                      className="w-full bg-transparent pl-11 pr-4 py-3.5 text-[15px] font-bold outline-none placeholder:text-[var(--text-secondary)]/20 text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Phone Field */}
                <div className="mt-3 group space-y-1.5">
                  <label className="text-[12px] font-semibold text-[var(--text-secondary)] opacity-60 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all duration-200 block font-[Poppins]">
                    Support Phone
                  </label>
                  <div className="relative flex items-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 group-focus-within:border-[var(--accent)]/50 group-focus-within:bg-[var(--bg-primary)]/80 transition-all duration-300">
                    <Phone className="absolute left-4 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:text-[var(--accent)] group-focus-within:opacity-80 transition-all duration-200 shrink-0" />
                    <input
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-transparent pl-11 pr-4 py-3.5 text-[15px] font-bold outline-none placeholder:text-[var(--text-secondary)]/20 text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Brand Story Card */}
              <div className="relative group overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-2xl shadow-xl p-5 sm:p-6 transition-all duration-300 focus-within:border-[var(--accent)]/40">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent rounded-t-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-[12px] font-semibold text-[var(--text-secondary)] opacity-60 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all duration-200 block font-[Poppins]">
                      Brand Story
                    </label>
                    <p className="text-[11px] text-[var(--text-secondary)] opacity-40 mt-0.5 font-medium">What makes your store stand out?</p>
                  </div>
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30 group-focus-within:opacity-60 transition-opacity">
                    {vendorProfile.description?.length || 0}/300
                  </div>
                </div>
                <textarea
                  placeholder="Tell buyers what makes your store unique — your specialty, quality promise, or story behind the brand..."
                  value={vendorProfile.description}
                  onChange={e => setVendorProfile(p => ({ ...p, description: e.target.value.slice(0, 300) }))}
                  rows={4}
                  className="w-full bg-transparent text-[13px] font-medium outline-none resize-none placeholder:text-[11px] placeholder:font-normal placeholder:opacity-20 text-[var(--text-primary)] leading-relaxed min-h-[100px]"
                />
              </div>

              {/* Store Type Card */}
              <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-[var(--bg-primary)]/80 backdrop-blur-2xl shadow-xl p-5 sm:p-6">
                <div className="mb-4">
                  <p className="text-[12px] font-semibold text-orange-500 font-[Poppins]">Store Type</p>
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-0.5 font-medium">This unlocks the right tools for your business</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'retail',     label: 'Retail',      sub: 'Products & goods',   Icon: Store,     color: 'amber'  },
                    { value: 'restaurant', label: 'Restaurant',  sub: 'Food & dining',       Icon: Utensils,  color: 'orange' },
                    { value: 'digital',    label: 'Digital',     sub: 'Downloads & services', Icon: Download,  color: 'blue'   },
                  ].map(({ value, label, sub, Icon, color }) => {
                    const selected = vendorType === value;
                    const colorMap = {
                      amber:  { border: 'border-amber-500/50',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  ring: 'shadow-amber-500/20'  },
                      orange: { border: 'border-orange-500/50', bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'shadow-orange-500/20' },
                      blue:   { border: 'border-blue-500/50',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   ring: 'shadow-blue-500/20'   },
                    };
                    const c = colorMap[color];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setVendorType(value)}
                        className={`relative flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 text-center transition-all active:scale-[0.97] ${
                          selected
                            ? `${c.border} ${c.bg} shadow-lg ${c.ring}`
                            : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 hover:border-[var(--glass-border)]/80'
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 size-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="size-2.5 text-white" />
                          </div>
                        )}
                        <div className={`size-10 rounded-xl border flex items-center justify-center transition-all ${
                          selected ? `${c.bg} ${c.border}` : 'bg-[var(--bg-primary)] border-[var(--glass-border)]'
                        }`}>
                          <Icon className={`size-5 ${selected ? c.text : 'text-[var(--text-secondary)] opacity-40'}`} />
                        </div>
                        <div>
                          <p className={`text-[12px] font-bold font-[Poppins] ${selected ? c.text : 'text-[var(--text-primary)]'}`}>{label}</p>
                          <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-50 mt-0.5 leading-tight">{sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


          {/* ── Step 3: Classy / All Set ── */}
          {isLogistics && step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto w-full">
              <div className="space-y-5">
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                  <div className="relative p-4 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                    <label className="text-[12px] font-semibold text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] mb-2 block transition-colors duration-200 opacity-80 font-[Poppins]">Company Name</label>
                    <div className="relative flex items-center">
                      <Truck className="absolute left-3 size-5 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                      <input
                        type="text"
                        placeholder="e.g. Auradime Express"
                        value={logisticsProfile.company_name}
                        onChange={e => setLogisticsProfile(p => ({ ...p, company_name: e.target.value }))}
                        className="w-full bg-transparent pl-11 pr-3 py-1.5 text-[13px] font-bold outline-none placeholder:text-[11px] placeholder:font-normal placeholder:opacity-30"
                      />
                    </div>
                  </div>
                </div>

                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                  <div className="relative p-4 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                    <label className="text-[12px] font-semibold text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] mb-2 block transition-colors duration-200 opacity-80 font-[Poppins]">Dispatch Phone</label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 size-5 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                      <input
                        type="tel"
                        placeholder="+237 6XX XXX XXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-transparent pl-11 pr-3 py-1.5 text-[13px] font-bold outline-none placeholder:text-[11px] placeholder:font-normal placeholder:opacity-30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-[var(--text-secondary)] opacity-60 px-1 font-[Poppins]">Fleet type</p>
                <div className="grid grid-cols-2 gap-3">
                  {VEHICLE_TYPES.map(type => {
                    const selected = logisticsProfile.vehicle_types.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLogisticsProfile(p => ({
                          ...p,
                          vehicle_types: selected
                            ? p.vehicle_types.filter(item => item !== type)
                            : [...p.vehicle_types, type],
                        }))}
                        className={`p-4 rounded-2xl border text-left transition-all ${selected ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-[var(--bg-primary)]/40 border-white/10 text-[var(--text-secondary)] hover:border-amber-500/30'}`}
                      >
                        <span className="block text-sm font-bold font-[Poppins]">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                        <span className="block text-[10px] opacity-50 mt-1 font-[Poppins]">Available for delivery</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {isLogistics && step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                <input
                  type="text"
                  placeholder="Filter service regions..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-3 text-[13px] placeholder:text-[11px] placeholder:font-normal outline-none focus:border-[var(--accent)]/60 transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {(search ? cities.filter(z => z.name?.toLowerCase().includes(search.toLowerCase())) : cities).map(region => {
                  const selected = logisticsProfile.service_regions.includes(region.name);
                  return (
                    <button
                      key={region._id}
                      type="button"
                      onClick={() => setLogisticsProfile(p => ({
                        ...p,
                        service_regions: selected
                          ? p.service_regions.filter(item => item !== region.name)
                          : [...p.service_regions, region.name],
                      }))}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selected ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-[var(--bg-primary)]/40 border-white/10 text-[var(--text-primary)] hover:border-emerald-500/30'}`}
                    >
                      <span className="text-sm font-bold">{region.name}</span>
                      {selected ? <Check className="size-4" /> : <MapPin className="size-4 opacity-30" />}
                    </button>
                  );
                })}
              </div>

              {zonesLoading && (
                <div className="flex items-center justify-center gap-3 py-8 text-xs font-bold opacity-50">
                  <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                  Loading service regions...
                </div>
              )}
            </div>
          )}

          {isLastStep && (
            <div className="max-w-md mx-auto text-center py-6 space-y-8">

              {/* Hero — big animated icon */}
              <div className="flex flex-col items-center gap-5">
                <div className="relative flex items-center justify-center">
                  <div className="absolute size-36 rounded-full bg-[var(--accent)]/5 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute size-28 rounded-full bg-gradient-to-br from-[var(--accent)]/10 to-blue-500/10 border border-[var(--accent)]/10" />
                  <div className="relative size-20 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-blue-500/20 border border-[var(--accent)]/30 flex items-center justify-center shadow-2xl shadow-[var(--accent)]/20">
                    {isVendor ? <Store className="size-9 text-[var(--accent)]" /> : isLogistics ? <Truck className="size-9 text-[var(--accent)]" /> : <ShieldCheck className="size-9 text-[var(--accent)]" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight leading-none">
                    {isVendor ? 'Store is Live!' : isLogistics ? 'Ready to Deliver!' : 'You\'re All Set!'}
                  </h1>
                  <p className="text-[12px] font-medium text-[var(--text-secondary)] opacity-50 font-[Poppins]">Everything synced perfectly</p>
                </div>
              </div>

              {/* Summary cards */}
              <div className="space-y-2.5 text-left">
                {[
                  {
                    icon: isLogistics ? Truck : isVendor ? Store : Users,
                    color: 'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20',
                    label: 'Identity',
                    value: isLogistics ? logisticsProfile.company_name : isVendor ? vendorProfile.store_name : `${followedVendors.length} vendors followed`,
                  },
                  {
                    icon: MapPin,
                    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    label: 'Location',
                    value: isLogistics
                      ? `${logisticsProfile.service_regions.length} region${logisticsProfile.service_regions.length !== 1 ? 's' : ''}`
                      : [location.city, location.zone, location.quartier].filter(Boolean).join(' › ') || 'Global',
                  },
                  ...(!isLogistics ? [{
                    icon: Phone,
                    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                    label: 'Contact',
                    value: phone || 'Not set',
                  }] : []),
                ].map(({ icon: Icon, color, label, value }) => (
                  <div key={label} className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] backdrop-blur-xl">
                    <div className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-50 font-[Poppins]">{label}</p>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate mt-0.5 font-[Poppins]">{value}</p>
                    </div>
                    <div className="size-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Check className="size-3 text-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-2">
                <button
                  onClick={finish}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-black text-[14px] tracking-tight shadow-2xl shadow-[var(--accent)]/25 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-white border border-white/10"
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #2563eb 100%)' }}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <>Enter Auradime <ArrowRight className="size-4" /></>}
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Navigation Footer */}
      {!isLastStep && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          <div className="pointer-events-auto bg-[var(--bg-primary)]/85 backdrop-blur-2xl border-t border-[var(--glass-border)] shadow-[0_-12px_40px_rgba(0,0,0,0.2)] px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-4 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <div className="max-w-md mx-auto flex items-center gap-3">
              {step > 0 && (
                <button
                  onClick={goBack}
                  className="size-12 shrink-0 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 transition-all active:scale-95"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <button
                onClick={goNext}
                className="flex-1 py-3.5 rounded-2xl font-black text-[13px] tracking-tight flex items-center justify-center gap-2 transition-all shadow-xl shadow-[var(--accent)]/20 border border-white/10 hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #2563eb 100%)', color: 'white' }}
              >
                {step === STEPS_ACTIVE.length - 2 ? 'Review & Finish' : 'Continue'}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

