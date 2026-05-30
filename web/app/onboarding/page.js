"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Heart, MapPin, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Store, 
  LayoutGrid, Check, Search, SkipForward, Globe,
  Phone, Sparkles, Zap, Star, ChevronRight, ShieldCheck, Plus, Truck
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const STEPS = [
  { id: 'categories', title: 'Your Interests', subtitle: 'Pick 2+ categories', icon: Heart, color: 'rose' },
  { id: 'location', title: 'Your Location', subtitle: 'City, zone & contact', icon: MapPin, color: 'emerald' },
  { id: 'vendors', title: 'Follow Vendors', subtitle: 'Pick 2+ stores you love', icon: Users, color: 'blue' },
  { id: 'done', title: 'All Set!', subtitle: 'Enter the marketplace', icon: CheckCircle2, color: 'accent' },
];

const VENDOR_STEPS = [
  { id: 'profile', title: 'Your Brand', subtitle: 'Name, phone & description', icon: Store, color: 'amber' },
  { id: 'categories', title: 'Trade Sectors', subtitle: 'Pick 2+ categories', icon: LayoutGrid, color: 'rose' },
  { id: 'location', title: 'Pickup Base', subtitle: 'City & zone for logistics', icon: MapPin, color: 'emerald' },
  { id: 'done', title: 'Go Live!', subtitle: 'Launch your store', icon: Sparkles, color: 'accent' },
];

const LOGISTICS_STEPS = [
  { id: 'profile', title: 'Carrier Profile', subtitle: 'Company, phone & fleet', icon: Truck, color: 'amber' },
  { id: 'regions', title: 'Service Regions', subtitle: 'Pick your operating cities', icon: MapPin, color: 'emerald' },
  { id: 'done', title: 'Ready to Deliver', subtitle: 'Enter logistics dashboard', icon: Sparkles, color: 'accent' },
];

const VEHICLE_TYPES = ['motorcycle', 'car', 'van', 'truck'];

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
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // UI state
  const [search, setSearch] = useState('');
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
  const [location, setLocation] = useState({ city: '', quartier: '', address_description: '' });
  const [phone, setPhone] = useState('');
  const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(30);
  const [vendorProfile, setVendorProfile] = useState({ store_name: '', description: '' });
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

  // Pre-fill from existing user data
  useEffect(() => {
    if (!user) return;
    if (user.liked_categories?.length > 0) setSelectedCategories(user.liked_categories.map(c => c._id || c));
    if (user.onboarding_location) setLocation({ city: user.onboarding_location.city || '', quartier: user.onboarding_location.quartier || '', address_description: user.onboarding_location.address_description || '' });
    if (user.phone) setPhone(user.phone);
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
      router.replace('/discovery');
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

        if (isVendor) {
          try {
            const vpRes = await api.get('/vendors/me');
            if (vpRes.data.success && vpRes.data.data.vendor) {
              const v = vpRes.data.data.vendor;
              setVendorProfile({ store_name: v.store_name || '', description: v.description || '' });
              if (v.phone) setPhone(v.phone);
            }
          } catch (e) {}
        }

        // Auto-ahead: if all data already collected, skip onboarding
        const hasFollows = follows.length >= 2;
        const hasCategories = (user.liked_categories?.length || 0) >= 2;
        const hasLocation = !!user.onboarding_location?.city;
        const hasPhone = !!user.phone;
        if (!isVendor && !isLogistics && hasFollows && hasCategories && hasLocation && hasPhone) {
          router.replace('/discovery');
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
    const locationStep = isLogistics ? 1 : isVendor ? 2 : 1;
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
      if (step === 1 && selectedCategories.length < 2) 
        return toast.error('Select at least 2 categories.');
      if (step === 2 && (!location.city || !location.quartier)) 
        return toast.error('City and zone are required.');
    } else if (isLogistics) {
      if (step === 0 && (!logisticsProfile.company_name || !phone || logisticsProfile.vehicle_types.length === 0))
        return toast.error('Company name, phone and fleet type are required.');
      if (step === 1 && logisticsProfile.service_regions.length < 1)
        return toast.error('Select at least 1 service region.');
    } else {
      // Customer steps: Categories (0) -> Location (1) -> Vendors (2)
      if (step === 0 && selectedCategories.length < 2) 
        return toast.error('Pick at least 2 interests.');
      if (step === 1 && (!location.city || !location.quartier || !phone)) 
        return toast.error('City, zone and phone are required.');
      if (step === 2 && followedVendors.length < 2) 
        return toast.error('Follow at least 2 vendors.');
    }
    setSearch('');
    setStep(s => s + 1);
  };

  const goBack = () => { dismissKeyboard(); setSearch(''); setStep(s => s - 1); };
  const skip = () => { dismissKeyboard(); sessionStorage.setItem('onboarding_skipped', 'true'); router.push('/discovery'); };

  const finish = async () => {
    dismissKeyboard();
    setLoading(true);
    try {
      if (isVendor) {
        const res = await api.post('/vendors/onboard', {
          store_name: vendorProfile.store_name,
          description: vendorProfile.description,
          categories: selectedCategories,
          location,
          phone,
        });
        if (res.data.success) {
          if (res.data.data?.user) updateUser(res.data.data.user);
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
          const me = await api.get('/auth/me').catch(() => null);
          if (me?.data?.data?.user) updateUser(me.data.data.user);
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
          router.push('/discovery');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (fetching || !mounted) {
    return <LoadingSpinner fullScreen />;
  }

  const filteredVendors = vendors
    .filter(v => !search || v.store_name?.toLowerCase().includes(search.toLowerCase()));

  const filteredCategories = categories
    .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  
  const categoriesToShow = filteredCategories.slice(0, visibleCategoriesCount);
  const hasMoreCategories = filteredCategories.length > visibleCategoriesCount;

  const cities = zones.filter(z => z.type === 'region');
  const quartiers = zones.filter(z => z.type === 'quartier' && z.parent_id?.name === location.city);

  const isLastStep = step === STEPS_ACTIVE.length - 1;

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative">
      {/* Ambient glow */}
      <div className={`fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -z-10 pointer-events-none opacity-30 transition-all duration-700 ${colors.bg}`} />

      {/* Header / Step Progress */}
      <header className="shrink-0 sticky top-0 z-20 px-4 py-4 md:px-6 md:py-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between bg-[var(--bg-primary)]/40 backdrop-blur-2xl border border-[var(--glass-border)] rounded-[2rem] px-5 py-2.5 shadow-2xl">
          {/* Back / Logo */}
          <div className="flex items-center gap-4">
            {step > 0 ? (
              <button onClick={goBack} className="size-10 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/40 transition-all group">
                <ArrowLeft className="size-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all" />
              </button>
            ) : (
              <div className="size-10 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center p-2">
                <img src="/icon-512.png" className="w-full h-auto" alt="" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm  font-bold text-[var(--text-primary)]">Onboarding</span>
            </div>
          </div>

          {/* Step Pills (Integrated) */}
          <div className="hidden sm:flex items-center gap-2 px-4 border-x border-[var(--glass-border)]">
            {STEPS_ACTIVE.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${active ? 'w-10 bg-[var(--accent)] shadow-[0_0_15px_var(--accent)]' : done ? 'w-3 bg-emerald-500/60' : 'w-3 bg-[var(--glass-border)]'}`} />
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {!isLastStep && !isVendor && !isLogistics && (
              <button 
                onClick={skip} 
                className="px-3 py-1.5 rounded-lg text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] text-[var(--accent)] hover:opacity-70 transition-all flex items-center gap-1.5"
              >
                Skip <SkipForward className="size-3 opacity-60" />
              </button>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] lg:text-[12px]  font-semibold text-emerald-400 tracking-tight">
              Verified
            </div>
          </div>
        </div>
      </header>

      {/* Step Title */}
      <div className="shrink-0 pt-6 pb-5 px-4 md:pt-10 md:pb-8 md:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 md:gap-6">
            <div className={`size-12 md:size-16 rounded-xl md:rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center shadow-lg ${colors.glow}`}>
              {currentStepMeta && <currentStepMeta.icon className={`size-6 md:size-7 ${colors.text}`} />}
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight leading-tight">{currentStepMeta?.title}</h1>
              <p className={`text-[11px] md:text-sm font-semibold ${colors.text} opacity-80 leading-relaxed`}>{currentStepMeta?.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-6 md:px-6 md:py-5 md:space-y-8 pb-32">
          {/* ── Step: Categories (Customers: Step 0, Vendors: Step 1) ── */}
          {((!isVendor && !isLogistics && step === 0) || (isVendor && step === 1)) && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-[var(--accent)]/60 transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedCategories.length / 2) * 100)}%` }} />
                </div>
                <span className="text-[11px] lg:text-[12px]  font-semibold text-rose-400 shrink-0">{selectedCategories.length}/2 min</span>
              </div>

              {/* High-Density Rectangular Category Blocks */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {categoriesToShow.map(cat => {
                  const sel = selectedCategories.includes(cat._id);
                  return (
                    <button
                      key={cat._id}
                      onClick={() => setSelectedCategories(p => sel ? p.filter(id => id !== cat._id) : [...p, cat._id])}
                      className={`relative flex items-center gap-3 p-3.5 rounded-[1.5rem] border transition-all duration-300 group ${sel ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]' : 'bg-[var(--bg-primary)]/40 backdrop-blur-md border-white/5 hover:border-[var(--accent)]/20 hover:bg-[var(--bg-primary)]/60'}`}
                    >
                      <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${sel ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' : 'bg-white/5 border-white/10 text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 group-hover:border-[var(--accent)]/30'}`}>
                        <LayoutGrid className="size-5" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className={`text-[13px] font-bold tracking-tight transition-colors ${sel ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{cat.name}</span>
                        <span className="text-[10px] font-medium opacity-40 truncate">Explore {cat.name}</span>
                      </div>
                      {sel && (
                        <div className="ml-auto size-5 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                           <div className="size-1.5 rounded-full bg-white" />
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
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-all shadow-sm"
                  >
                    See more <ChevronRight className="size-3 text-[var(--accent)]" />
                  </button>
                </div>
              )}
              
              {filteredCategories.length === 0 && <p className="text-center text-sm opacity-40 py-12">No categories found in current matrix...</p>}
            </div>
          )}

          {/* ── Step: Location (Customers: Step 1, Vendors: Step 2) ── */}
          {((!isVendor && !isLogistics && step === 1) || (isVendor && step === 2)) && (
            <div className="space-y-4 max-w-md mx-auto w-full">
              {!isVendor && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                  <div className="relative p-4 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                    <label className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest mb-2 block">Primary Contact</label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-0 size-4 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                      <input
                        type="tel"
                        placeholder="+237 6XX XXX XXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-transparent pl-8 pr-2 py-1.5 text-sm font-semibold outline-none placeholder:text-[var(--text-secondary)]/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                <div className="relative p-4 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 block opacity-60">Base City</label>
                  {zonesLoading ? (
                    <div className="flex items-center gap-3 py-1">
                      <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                      <span className="text-xs font-bold opacity-40">Loading...</span>
                    </div>
                  ) : (
                    <div className="relative flex items-center">
                      <MapPin className="absolute left-0 size-4 text-[var(--text-secondary)] opacity-40 pointer-events-none group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                      <select
                        value={location.city}
                        onChange={e => setLocation(p => ({ ...p, city: e.target.value, quartier: '' }))}
                        className="w-full bg-transparent pl-8 pr-10 py-1.5 text-sm font-semibold outline-none appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[var(--bg-primary)]">Select city...</option>
                        {cities.map(z => <option key={z._id} value={z.name} className="bg-[var(--bg-primary)]">{z.name}</option>)}
                      </select>
                      <ChevronRight className="absolute right-0 size-3.5 opacity-20 rotate-90" />
                    </div>
                  )}
                </div>
              </div>

              {location.city && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                    <div className="relative p-4 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 block opacity-60">Neighbourhood / Zone</label>
                      <div className="relative flex items-center">
                        <Globe className="absolute left-0 size-4 text-[var(--text-secondary)] opacity-40 pointer-events-none group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                        <select
                          value={location.quartier}
                          disabled={zonesLoading}
                          onChange={e => setLocation(p => ({ ...p, quartier: e.target.value }))}
                          className="w-full bg-transparent pl-8 pr-10 py-1.5 text-sm font-semibold outline-none appearance-none cursor-pointer disabled:opacity-30"
                        >
                          <option value="" className="bg-[var(--bg-primary)]">Select zone...</option>
                          {quartiers.map(z => <option key={z._id} value={z.name} className="bg-[var(--bg-primary)]">{z.name}</option>)}
                        </select>
                        <ChevronRight className="absolute right-0 size-3.5 opacity-20 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                    <div className="relative p-4 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 block opacity-60">Address Details / Notes</label>
                      <textarea
                        placeholder={isVendor ? "e.g. Opposite Total Station, gate #4..." : "e.g. Door #5, blue building..."}
                        value={location.address_description}
                        onChange={e => setLocation(p => ({ ...p, address_description: e.target.value }))}
                        rows={3}
                        className="w-full bg-transparent py-1 text-sm font-semibold outline-none resize-none placeholder:text-[var(--text-secondary)]/20"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ── Step: Vendors (Customers Step 2) ── */}
          {!isVendor && !isLogistics && step === 2 && (
             <div className="space-y-4">
               {/* Search Vendors */}
               <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                 <input
                   type="text"
                   placeholder="Search vendors..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-[var(--accent)]/60 transition-all shadow-inner"
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

                <div className="space-y-3">
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
            <div className="space-y-5 max-w-md mx-auto">
              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                <div className="relative p-5 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest mb-3 block">Store Name</label>
                  <div className="relative flex items-center">
                    <Store className="absolute left-0 size-5 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                    <input
                      type="text"
                      placeholder="e.g. Aura Fashion"
                      value={vendorProfile.store_name}
                      onChange={e => setVendorProfile(p => ({ ...p, store_name: e.target.value }))}
                      className="w-full bg-transparent pl-10 pr-2 py-1 text-base font-bold outline-none placeholder:text-[var(--text-secondary)]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                <div className="relative p-5 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 block opacity-60">Support Contact</label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-0 size-5 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                    <input
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-2 py-1 text-base font-bold outline-none placeholder:text-[var(--text-secondary)]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                <div className="relative p-5 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 block opacity-60">Brand Description</label>
                  <textarea
                    placeholder="Tell buyers what makes your store unique..."
                    value={vendorProfile.description}
                    onChange={e => setVendorProfile(p => ({ ...p, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-transparent py-1 text-sm font-semibold outline-none resize-none placeholder:text-[var(--text-secondary)]/20"
                  />
                </div>
              </div>
            </div>
          )}


          {/* ── Step 3: Classy / All Set ── */}
          {isLogistics && step === 0 && (
            <div className="space-y-5 max-w-md mx-auto">
              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                <div className="relative p-5 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest mb-3 block">Company Name</label>
                  <div className="relative flex items-center">
                    <Truck className="absolute left-0 size-5 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                    <input
                      type="text"
                      placeholder="e.g. Auradime Express"
                      value={logisticsProfile.company_name}
                      onChange={e => setLogisticsProfile(p => ({ ...p, company_name: e.target.value }))}
                      className="w-full bg-transparent pl-10 pr-2 py-1 text-base font-bold outline-none placeholder:text-[var(--text-secondary)]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                <div className="relative p-5 rounded-2xl bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all group-focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 block opacity-60">Dispatch Phone</label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-0 size-5 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
                    <input
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-2 py-1 text-base font-bold outline-none placeholder:text-[var(--text-secondary)]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60 px-1">Fleet Type</p>
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
                        <span className="block text-sm font-bold capitalize">{type}</span>
                        <span className="block text-[10px] opacity-50 mt-1">Available for delivery</span>
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
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-[var(--accent)]/60 transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="space-y-12 max-w-md mx-auto text-center py-10">
              {/* Refined Header */}
              <div className="space-y-4">
                 <div className="relative size-16 rounded-full bg-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center mx-auto">
                    <div className="absolute inset-0 rounded-full border border-[var(--accent)]/40 animate-pulse scale-125" />
                    <ShieldCheck className="size-8 text-[var(--accent)]" />
                 </div>
                 <div className="space-y-1">
                    <h1 className="text-3xl font-light text-[var(--text-primary)] tracking-tight">Your Profile is Ready</h1>
                    <p className="text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-50 tracking-tight ">Everything syncronized perfectly</p>
                 </div>
              </div>

              {/* Elegant Summary Pills */}
              <div className="space-y-3 px-4">
                <div className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-white/5 backdrop-blur-xl transition-all hover:border-[var(--accent)]/20">
                   <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-[var(--accent)]/5 flex items-center justify-center text-[var(--accent)]">
                         {isLogistics ? <Truck className="size-5" /> : isVendor ? <Store className="size-5" /> : <Users className="size-5" />}
                      </div>
                      <div className="text-left">
                         <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-normal opacity-40">Primary Identity</p>
                         <p className="text-sm font-medium">{isLogistics ? logisticsProfile.company_name : isVendor ? vendorProfile.store_name : `${followedVendors.length} vendors followed`}</p>
                      </div>
                   </div>
                   <Check className="size-4 text-[var(--accent)] opacity-40" />
                </div>

                <div className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-white/5 backdrop-blur-xl transition-all hover:border-[var(--accent)]/20">
                   <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-[var(--accent)]/5 flex items-center justify-center text-[var(--accent)]">
                         {isLogistics ? <Truck className="size-5" /> : <Heart className="size-5" />}
                      </div>
                      <div className="text-left">
                         <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-normal opacity-40">{isLogistics ? 'Fleet Types' : 'Discovery Filters'}</p>
                         <p className="text-sm font-medium">{isLogistics ? logisticsProfile.vehicle_types.join(', ') : `${selectedCategories.length} categories selected`}</p>
                      </div>
                   </div>
                   <Check className="size-4 text-[var(--accent)] opacity-40" />
                </div>

                <div className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-white/5 backdrop-blur-xl transition-all hover:border-[var(--accent)]/20">
                   <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-[var(--accent)]/5 flex items-center justify-center text-[var(--accent)]">
                         <MapPin className="size-5" />
                      </div>
                      <div className="text-left">
                         <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-normal opacity-40">Service Zone</p>
                         <p className="text-sm font-medium">{isLogistics ? `${logisticsProfile.service_regions.length} regions selected` : `${location.city || 'Global'}${location.quartier ? `, ${location.quartier}` : ''}`}</p>
                      </div>
                   </div>
                   <Check className="size-4 text-[var(--accent)] opacity-40" />
                </div>
              </div>

              {/* Sophisticated Action */}
              <div className="pt-8 px-6 space-y-6">
                <button
                  onClick={finish}
                  disabled={loading}
                  className="w-full py-4 rounded-xl font-bold text-sm tracking-tight shadow-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-white"
                  style={{ background: 'linear-gradient(90deg, var(--accent) 0%, #2563eb 100%)' }}
                >
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : 'Enter Auradime'}
                  {!loading && <ArrowRight className="size-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

      {/* High-Density Navigation Footer  */}
      {!isLastStep && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-6 sm:p-8 pointer-events-none">
          <div className="max-w-md mx-auto flex items-center gap-4 pointer-events-auto">
            {/* Primary Action Button */}
            <button
              onClick={goNext}
              className="w-full py-3.5 rounded-xl font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-3 transition-all shadow-xl shadow-[var(--accent)]/15 border border-white/10 hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(90deg, var(--accent) 0%, #2563eb 100%)', color: 'white' }}
            >
              {step === STEPS_ACTIVE.length - 2 ? 'Final Review' : 'Continue'}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
