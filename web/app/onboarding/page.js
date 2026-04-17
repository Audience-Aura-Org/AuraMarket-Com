"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Heart, MapPin, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Store, 
  LayoutGrid, Check, Search, SkipForward, Globe,
  Phone, Sparkles, Zap, Star
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 'vendors', title: 'Follow Vendors', subtitle: 'Pick 2+ stores you love', icon: Users, color: 'blue' },
  { id: 'categories', title: 'Your Interests', subtitle: 'Pick 2+ categories', icon: Heart, color: 'rose' },
  { id: 'location', title: 'Your Location', subtitle: 'City, zone & contact', icon: MapPin, color: 'emerald' },
  { id: 'done', title: 'All Set!', subtitle: 'Enter the marketplace', icon: CheckCircle2, color: 'accent' },
];

const VENDOR_STEPS = [
  { id: 'profile', title: 'Your Brand', subtitle: 'Name, phone & description', icon: Store, color: 'amber' },
  { id: 'categories', title: 'Trade Sectors', subtitle: 'Pick 2+ categories', icon: LayoutGrid, color: 'rose' },
  { id: 'location', title: 'Pickup Base', subtitle: 'City & zone for logistics', icon: MapPin, color: 'emerald' },
  { id: 'done', title: 'Go Live!', subtitle: 'Launch your store', icon: Sparkles, color: 'accent' },
];

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
  const [vendorProfile, setVendorProfile] = useState({ store_name: '', description: '' });

  const isVendor = user?.role === 'vendor';
  const STEPS_ACTIVE = isVendor ? VENDOR_STEPS : STEPS;
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

    // Eject non-customer roles immediately
    const role = user.role?.toLowerCase();
    if (role === 'admin' || role === 'vendor' || role === 'logistics') {
      console.warn('[Onboarding] Non-customer detected, ejecting to dashboard:', role);
      const dashboard = role === 'admin' ? '/admin/dashboard' : role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard';
      router.replace(dashboard);
      return;
    }

    if (user.onboarded) {
      router.replace('/discovery');
      return;
    }

    const fetchInitData = async () => {
      try {
        const [vRes, cRes, fRes] = await Promise.all([
          api.get('/vendors?limit=40&sort=-rating'),
          api.get('/categories?lite=true'),
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
        if (!isVendor && hasFollows && hasCategories && hasLocation && hasPhone) {
          router.replace('/discovery');
        }
      } catch (err) {
        toast.error('Failed to load onboarding data.');
      } finally {
        setFetching(false);
      }
    };

    fetchInitData();
  }, [user, isVendor, router]);

  // Defer zones fetch until step 2 (Location)
  useEffect(() => {
    if (step === 2 && zones.length === 0 && !zonesLoading) {
      setZonesLoading(true);
      api.get('/logistics/zones')
        .then(res => setZones(res.data.data?.zones || []))
        .catch(() => toast.error('Failed to load zones.'))
        .finally(() => setZonesLoading(false));
    }
  }, [step, zones.length, zonesLoading]);

  const handleToggleFollow = useCallback(async (vId) => {
    const isFollowing = followedVendors.includes(vId);
    setSyncing(vId);
    try {
      if (isFollowing) {
        await api.delete(`/vendors/${vId}/follow`);
        setFollowedVendors(p => p.filter(id => id !== vId));
      } else {
        try {
          await api.post(`/vendors/${vId}/follow`);
          setFollowedVendors(p => [...p, vId]);
        } catch (err) {
          if (err.response?.status === 400) setFollowedVendors(p => [...new Set([...p, vId])]);
          else throw err;
        }
      }
    } catch (err) {
      toast.error('Action failed.');
    } finally {
      setSyncing(null);
    }
  }, [followedVendors]);

  const goNext = () => {
    if (isVendor && step === 0) {
      if (!vendorProfile.store_name || !vendorProfile.description || !phone)
        return toast.error('Store name, description and phone are required.');
    } else if (!isVendor && step === 0) {
      if (followedVendors.length < 2) return toast.error('Follow at least 2 vendors.');
    }
    if (step === 1 && selectedCategories.length < 2) return toast.error('Select at least 2 categories.');
    if (step === 2 && (!location.city || !location.quartier)) return toast.error('City and zone are required.');
    setSearch('');
    setStep(s => s + 1);
  };

  const goBack = () => { setSearch(''); setStep(s => s - 1); };
  const skip = () => { sessionStorage.setItem('onboarding_skipped', 'true'); router.push('/discovery'); };

  const finish = async () => {
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
    return (
      <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
        {mounted && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated background elements */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[var(--accent)]/5 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] animate-pulse delay-700" />
          </div>
        )}

        <div className="flex flex-col items-center gap-8 relative z-10">
          <div className="relative group">
            {/* Logo container */}
            <div className="size-24 rounded-[32px] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:scale-110">
               <img src="/logo-black.png" className="w-12 h-auto opacity-90" alt="Aura" />
            </div>
            
            {mounted && (
              <>
                {/* Spinning/Pulse rings */}
                <div className="absolute -inset-4 rounded-[40px] border border-[var(--accent)]/10 animate-[spin_8s_linear_infinite]" />
                <div className="absolute -inset-8 rounded-[48px] border border-[var(--accent)]/5 animate-[spin_12s_linear_infinite_reverse]" />
                <div className="absolute -inset-2 rounded-[36px] border-2 border-[var(--accent)]/20 animate-ping opacity-20" />
              </>
            )}
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-[0.2em]">
              Calibrating <span className="text-[var(--accent)]">Aura</span>
            </h2>
            <div className="flex flex-col items-center gap-1">
               <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-40">Synchronizing with Matrix nodes</p>
               <div className="w-32 h-1 bg-[var(--bg-primary)] rounded-full mt-2 overflow-hidden border border-[var(--glass-border)]">
                  {mounted ? (
                    <motion.div 
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-full h-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" 
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--accent)]/20 animate-pulse" />
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredVendors = vendors
    .filter(v => !search || v.store_name?.toLowerCase().includes(search.toLowerCase()));

  const filteredCategories = categories
    .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));

  const cities = zones.filter(z => z.type === 'region');
  const quartiers = zones.filter(z => z.type === 'quartier' && z.parent_id?.name === location.city);

  const isLastStep = step === STEPS_ACTIVE.length - 1;

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col">
      {/* Ambient glow */}
      <div className={`fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -z-0 opacity-30 transition-all duration-700 ${colors.bg}`} />

      {/* Header / Step Progress */}
      <header className="shrink-0 sticky top-0 z-20 px-6 py-6">
        <div className="max-w-[95%] mx-auto flex items-center justify-between bg-[var(--bg-primary)]/40 backdrop-blur-2xl border border-[var(--glass-border)] rounded-[2.5rem] px-6 py-3 shadow-2xl">
          {/* Back / Logo */}
          <div className="flex items-center gap-4">
            {step > 0 ? (
              <button onClick={goBack} className="size-10 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/40 transition-all group">
                <ArrowLeft className="size-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all" />
              </button>
            ) : (
              <div className="size-10 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center p-2">
                <img src="/logo-black.png" className="w-full h-auto opacity-90" alt="" />
              </div>
            )}
            <div className="flex flex-col">
               <span className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Onboarding</span>
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

          {/* Skip / Actions */}
          <div className="flex items-center gap-2">
            {!isLastStep && step < 3 ? (
              <button 
                onClick={skip} 
                className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 group"
              >
                Skip <SkipForward className="size-3 opacity-40 group-hover:opacity-100 transition-all" />
              </button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                Safe Hub
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Step Title */}
      <div className="shrink-0 pt-8 pb-6 px-6">
        <div className="max-w-[95%] mx-auto">
          <div className="flex items-center gap-4">
            <div className={`size-14 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center shadow-lg ${colors.glow}`}>
              {currentStepMeta && <currentStepMeta.icon className={`size-6 ${colors.text}`} />}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">{currentStepMeta?.title}</h1>
              <p className={`text-[10px] md:text-xs font-bold ${colors.text} opacity-80`}>{currentStepMeta?.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-36">
        <div className="max-w-[95%] mx-auto">

          {/* ── Step 0: Vendors (Customers) / Brand Profile (Vendors) ── */}
          {step === 0 && (
            <div className="space-y-4">
              {isVendor ? (
                <div className="space-y-4 max-w-md">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>Store Name</label>
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                      <input
                        type="text"
                        placeholder="e.g. Aura Fashion"
                        value={vendorProfile.store_name}
                        onChange={e => setVendorProfile(p => ({ ...p, store_name: e.target.value }))}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl pl-12 pr-5 py-4 text-sm font-semibold outline-none focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold tracking-tight ${colors.text}`}>Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                      <input
                        type="tel"
                        placeholder="+237 6XX XXX XXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl pl-12 pr-5 py-4 text-sm font-semibold outline-none focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>Brand Description</label>
                    <textarea
                      placeholder="Tell buyers what makes your store unique..."
                      value={vendorProfile.description}
                      onChange={e => setVendorProfile(p => ({ ...p, description: e.target.value }))}
                      rows={4}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-sm font-semibold outline-none focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all resize-none"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Search Vendors */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                    <input
                      type="text"
                      placeholder="Search vendors..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl pl-12 pr-5 py-3.5 text-sm outline-none focus:border-[var(--accent)]/60 transition-all"
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
                    <span className="text-[10px] font-black text-blue-400 shrink-0">
                      {followedVendors.length}/2 min
                    </span>
                  </div>

                  {/* Vendor Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredVendors.slice(0, 20).map(v => {
                      const isFollowing = followedVendors.includes(v._id);
                      const isSyncing = syncing === v._id;
                      return (
                        <div key={v._id} className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isFollowing ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:border-[var(--accent)]/30'}`}
                          onClick={() => !isSyncing && handleToggleFollow(v._id)}>
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="size-12 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0">
                              {v.user_id?.branding?.logo || v.user_id?.avatar
                                ? <img src={v.user_id?.branding?.logo || v.user_id?.avatar} className="size-full object-cover" alt="" />
                                : <div className="size-full flex items-center justify-center"><Store className="size-5 opacity-20" /></div>
                              }
                            </div>
                            <div className="flex flex-col min-w-0">
                               <h3 className="text-sm font-black text-[var(--text-primary)] truncate">{v.store_name || 'Verified Vendor'}</h3>
                               <p className="text-[10px] text-[var(--text-secondary)] font-bold opacity-60">Vendor Node</p>
                            </div>
                          </div>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); !isSyncing && handleToggleFollow(v._id); }}
                            className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-tight transition-all flex items-center justify-center gap-1.5 shrink-0 ${isFollowing ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'}`}
                          >
                            {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : isFollowing ? <Check className="size-3.5" /> : <Users className="size-3.5" />}
                            {isFollowing ? 'Followed' : 'Follow'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {vendors.length === 0 && <p className="text-center text-sm opacity-40 py-12">No vendors yet — you can come back later.</p>}
                </>
              )}
            </div>
          )}

          {/* ── Step 1: Categories ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl pl-12 pr-5 py-3.5 text-sm outline-none focus:border-[var(--accent)]/60 transition-all"
                />
              </div>

              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedCategories.length / 2) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-black text-rose-400 shrink-0">{selectedCategories.length}/2 min</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredCategories.map(cat => {
                  const sel = selectedCategories.includes(cat._id);
                  return (
                    <button
                      key={cat._id}
                      onClick={() => setSelectedCategories(p => sel ? p.filter(id => id !== cat._id) : [...p, cat._id])}
                      className={`relative p-4 rounded-2xl border text-left transition-all group ${sel ? 'bg-rose-500/10 border-rose-500/40' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:border-rose-500/30'}`}
                    >
                      {sel && (
                        <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-rose-500 flex items-center justify-center">
                          <Check className="size-3 text-white" />
                        </div>
                      )}
                      <LayoutGrid className={`size-5 md:size-6 mb-2 ${sel ? 'text-rose-400' : 'text-[var(--text-secondary)] opacity-40'}`} />
                      <p className="text-[11px] md:text-xs font-medium leading-tight">{cat.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 2: Location + Phone (Premium Redesign) ── */}
          {step === 2 && (
            <div className="space-y-4 w-full">
              {!isVendor && (
                <div className="p-5 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl transition-all group focus-within:border-[var(--accent)]/40">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.15em] mb-3 block opacity-50">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-0 top-1/2 -translate-y-1/2 size-5 text-[var(--accent)]" />
                    <input
                      type="tel"
                      placeholder="+237 6XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-2 py-2 text-base font-black outline-none placeholder:text-[var(--text-secondary)]/20"
                    />
                  </div>
                </div>
              )}

              <div className="p-5 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl transition-all focus-within:border-[var(--accent)]/40">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.15em] mb-3 block opacity-50">City</label>
                {zonesLoading ? (
                  <div className="flex items-center gap-3 py-2">
                    <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
                    <span className="text-sm font-bold opacity-40 italic">Syncing nodes...</span>
                  </div>
                ) : (
                  <div className="relative">
                    <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 size-5 text-[var(--accent)] pointer-events-none" />
                    <select
                      value={location.city}
                      onChange={e => setLocation(p => ({ ...p, city: e.target.value, quartier: '' }))}
                      className="w-full bg-transparent pl-10 pr-10 py-2 text-base font-black outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Select city...</option>
                      {cities.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                    </select>
                    <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 size-4 opacity-20 rotate-90" />
                  </div>
                )}
              </div>

              {location.city && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-5 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl transition-all focus-within:border-[var(--accent)]/40"
                >
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.15em] mb-3 block opacity-50">Neighbourhood / Zone</label>
                  <div className="relative">
                    <Globe className="absolute left-0 top-1/2 -translate-y-1/2 size-5 text-[var(--accent)] pointer-events-none" />
                    <select
                      value={location.quartier}
                      disabled={zonesLoading}
                      onChange={e => setLocation(p => ({ ...p, quartier: e.target.value }))}
                      className="w-full bg-transparent pl-10 pr-10 py-2 text-base font-black outline-none appearance-none cursor-pointer disabled:opacity-30"
                    >
                      <option value="">Select zone...</option>
                      {quartiers.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                    </select>
                    <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 size-4 opacity-20 rotate-90" />
                  </div>
                </motion.div>
              )}

              <div className="p-5 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl transition-all focus-within:border-[var(--accent)]/40">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.15em] mb-3 block opacity-50">
                  {isVendor ? 'Pickup Details' : 'Address Notes'}
                </label>
                <textarea
                  placeholder={isVendor ? "e.g. Next to Total Station, gate #4..." : "e.g. Door #5, blue building..."}
                  value={location.address_description}
                  onChange={e => setLocation(p => ({ ...p, address_description: e.target.value }))}
                  rows={3}
                  className="w-full bg-transparent py-1 text-sm font-bold outline-none resize-none placeholder:text-[var(--text-secondary)]/20"
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Summary / Done ── */}
          {step === 3 && (
            <div className="space-y-4 max-w-md">
              <div className="flex items-center gap-5">
                <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                  <img src="/logo-black.png" alt="Aura" className="size-6 object-contain grayscale brightness-200" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black text-[var(--accent)] tracking-tight leading-none">Onboarding</h1>
                </div>
              </div>
              <div className="p-6 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] space-y-5">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                    {isVendor ? <Store className="size-5 text-[var(--accent)]" /> : <Users className="size-5 text-[var(--accent)]" />}
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">{isVendor ? 'Store Name' : 'Vendors Followed'}</p>
                    <p className="font-black text-base capitalize">{isVendor ? vendorProfile.store_name : `${followedVendors.length} stores`}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <Heart className="size-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Categories</p>
                    <p className="font-black text-base">{selectedCategories.length} selected</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <MapPin className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Location</p>
                    <p className="font-black text-base">{location.city || '—'}{location.quartier ? `, ${location.quartier}` : ''}</p>
                  </div>
                </div>

                {phone && (
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Phone className="size-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Contact</p>
                      <p className="font-black text-base">{phone}</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={finish}
                disabled={loading}
                className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-[var(--accent)] to-blue-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-[var(--accent)]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 border border-white/20"
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : isVendor && <Sparkles className="size-5" />}
                {loading ? 'Finalizing Setup...' : isVendor ? 'Launch My Store' : 'Enter Discovery'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Nav Bar  */}
      {step < 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-6 py-10 sm:py-6 pb-20 sm:pb-12 pointer-events-none">
          <div className="max-w-[95%] mx-auto flex justify-end pointer-events-auto">
            <button
              onClick={goNext}
              className={`px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl hover:shadow-2xl border border-white/20 hover:scale-[1.02] active:scale-95`}
              style={{ background: 'linear-gradient(90deg, var(--accent) 0%, #2563eb 100%)', color: 'white', position: 'relative', bottom: '10px' }}
            >
              {step === 2 ? 'Review & Finish' : 'Continue'}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
