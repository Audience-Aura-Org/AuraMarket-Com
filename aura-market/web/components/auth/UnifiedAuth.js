"use client";
// Force cache bust: v2-alias-fix

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, User, Phone, 
  ArrowRight, ArrowLeft, Sparkles, 
  ChevronRight, ShoppingBag, Store, Truck,
  CheckCircle2, Loader2, X, MapPin as AuraMapPin, Globe
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

/**
 * UnifiedAuth
 * A WhatsApp-style identifier-first authentication hub.
 * Merges login and registration into one seamless, animated flow.
 */
export default function UnifiedAuth() {
  const router = useRouter();
  const { login, register } = useAuthStore();

  // Step state: 'IDENTIFIER' -> 'CHALLENGE' (Existing/New) -> 'CALIBRATION' (New)
  const [step, setStep] = useState('IDENTIFIER'); 
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'customer'
  });

  // Onboarding data (Step 3)
  const [onboardingData, setOnboardingData] = useState({
    store_name: '',
    description: '',
    selectedCategories: [],
    city: '',
    quartier: '',
    followedVendors: []
  });

  // Resources for onboarding
  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [fetchingResources, setFetchingResources] = useState(false);

  useEffect(() => {
    if (step === 'CALIBRATION') {
      const fetchResources = async () => {
        setFetchingResources(true);
        try {
          // Parallel fetch with individual error handling to prevent blocking
          const [catRes, zoneRes, vendorRes] = await Promise.allSettled([
            api.get('/categories'),
            api.get('/logistics/zones'),
            api.get('/vendors/promoted')
          ]);
          
          if (catRes.status === 'fulfilled') setCategories(catRes.value.data.data || []);
          if (zoneRes.status === 'fulfilled') setZones(zoneRes.value.data.data?.zones || []);
          if (vendorRes.status === 'fulfilled') setVendors(vendorRes.value.data.data || vendorRes.value.data || []);
        } catch (e) {
          console.error('Critical failure in hub calibration', e);
        } finally {
          setFetchingResources(false);
        }
      };
      fetchResources();
    }
  }, [step]);

  // Zones now pre-loaded for speed
  const fetchZonesIfNeeded = () => {}; 

  const nextStep = () => {
    if (step === 'IDENTIFIER') setStep('CHALLENGE');
    else if (step === 'CHALLENGE') setStep('CALIBRATION');
  };

  const prevStep = () => {
    if (step === 'CHALLENGE') {
      setStep('IDENTIFIER');
      setIsNewUser(false);
    } else if (step === 'CALIBRATION') {
      setStep('CHALLENGE');
    }
  };

  const handleIdentifierSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;
    nextStep();
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isNewUser) {
        // Registering
        const formattedData = {
          ...formData,
          phone: formData.phone ? formData.phone.replace(/[\s-]/g, '') : formData.phone
        };
        const result = await register(formattedData);
        if (result.success) {
          const registeredUser = useAuthStore.getState().user;
          // Only customers need the calibration (onboarding) flow
          if (registeredUser?.role && registeredUser.role !== 'customer') {
            handleRedirect();
          } else {
            setStep('CALIBRATION');
          }
        } else {
          setError(result.message || 'Registration failed');
        }
      } else {
        // Logging in
        const result = await login({ email: formData.email, password: formData.password });
        if (result.success) handleRedirect();
        else setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (formData.role === 'vendor') {
        await api.post('/vendors/onboard', {
          store_name: onboardingData.store_name,
          description: onboardingData.description,
          categories: onboardingData.selectedCategories,
          location: {
            city: onboardingData.city,
            quartier: onboardingData.quartier
          }
        });
      } else {
        await api.patch('/users/onboarding', {
          liked_categories: onboardingData.selectedCategories,
          followed_vendors: onboardingData.followedVendors,
          location: {
            city: onboardingData.city,
            quartier: onboardingData.quartier
          },
          onboarded: true
        });
      }
      
      toast.success('Node calibrated successfully!');
      handleRedirect();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Calibration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = () => {
    const user = useAuthStore.getState().user;
    const role = user?.role?.toLowerCase();
    
    // Prefetch for instant navigate
    if (role === 'vendor') {
      router.prefetch('/vendor/dashboard');
      router.push('/vendor/dashboard');
    } else if (role === 'admin') {
      router.prefetch('/admin/dashboard');
      router.push('/admin/dashboard');
    } else if (role === 'logistics') {
      router.prefetch('/logistics/dashboard');
      router.push('/logistics/dashboard');
    } else {
      // For customers, check onboarding status
      if (user?.onboarded === false) {
        router.prefetch('/onboarding');
        router.push('/onboarding');
      } else {
        router.prefetch('/discovery');
        router.push('/discovery');
      }
    }
  };

  return (
    <div className={`w-full ${step === 'CALIBRATION' ? 'max-w-[95%] md:max-w-2xl' : 'max-w-[420px]'} mx-auto transition-all duration-700`}>
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Progress Bar (Aesthetic Dots) */}
        <div className="flex justify-center gap-1.5 mb-8">
          <div className={`h-1 rounded-full transition-all duration-500 ${step === 'IDENTIFIER' ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--accent)]/30'}`} />
          <div className={`h-1 rounded-full transition-all duration-500 ${step === 'CHALLENGE' ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--accent)]/30'}`} />
          {isNewUser && (
            <div className={`h-1 rounded-full transition-all duration-500 ${step === 'CALIBRATION' ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--accent)]/30'}`} />
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 'IDENTIFIER' ? (
            <motion.div
              key="identifier"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-[var(--text-primary)]">Welcome to Aura</h1>
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-60">
                  Enter your email to continue
                </p>
              </div>

              <form onSubmit={handleIdentifierSubmit} className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-colors group-focus-within:text-[var(--accent)]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="name@example.com"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all placeholder:text-[var(--text-secondary)]/30"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="pt-4 border-t border-[var(--glass-border)] text-center">
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-40 mb-3">New to Aura Market?</p>
                <button
                  onClick={() => {
                    setIsNewUser(true);
                    setStep('CHALLENGE');
                  }}
                  className="w-full py-3.5 rounded-2xl border border-[var(--accent)]/30 text-[var(--accent)] font-black text-[10px] uppercase tracking-widest hover:bg-[var(--accent)]/5 transition-all"
                >
                  Create an account
                </button>
              </div>
            </motion.div>
          ) : step === 'CHALLENGE' ? (
            <motion.div
              key="challenge"
              // ... existing challenge code ...
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2"
              >
                <ArrowLeft className="w-3 h-3" />
                Change Email
              </button>

              <div className="space-y-1">
                <h2 className="text-xl font-black text-[var(--text-primary)]">
                  {isNewUser ? 'Create your node' : 'Enter password'}
                </h2>
                <p className="text-[10px] font-bold text-[var(--accent)] truncate max-w-full">
                  {formData.email}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleFinalSubmit} className="space-y-4">
                {/* Name, Email (editable), & Phone for New Users */}
                {isNewUser && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Full Name"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>
                    
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="Email Address"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>

                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="Phone Number"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>

                    {/* Role Picker (WhatsApp-style selector) */}
                    <div className="grid grid-cols-3 gap-2">
                       {['customer', 'vendor', 'logistics'].map((r) => (
                         <button
                           key={r}
                           type="button"
                           onClick={() => setFormData({...formData, role: r})}
                           className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all ${
                             formData.role === r 
                             ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' 
                             : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                           }`}
                         >
                           {r === 'customer' && <ShoppingBag className="w-4 h-4" />}
                           {r === 'vendor' && <Store className="w-4 h-4" />}
                           {r === 'logistics' && <Truck className="w-4 h-4" />}
                           <span className="text-[8px] font-black uppercase tracking-tighter">{r}</span>
                         </button>
                       ))}
                    </div>
                  </motion.div>
                )}

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Enter password"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all placeholder:text-[var(--text-secondary)]/30"
                  />
                </div>

                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setIsNewUser(!isNewUser)}
                    className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest hover:opacity-70 transition-all"
                  >
                    {isNewUser ? 'Wait, I have an account' : 'I am new to Aura market'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    isNewUser ? 'Join Aura' : 'Continue'
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="calibration"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar"
            >
              {fetchingResources && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 bg-[var(--accent)]/5 rounded-[2rem] border border-[var(--accent)]/10">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest animate-pulse">Synchronizing Hub...</p>
                </div>
              )}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Calibrate Hub</h2>
                <p className="text-xs font-medium text-[var(--text-secondary)] opacity-60">Personalize your node for the Aura Network</p>
              </div>

              <form onSubmit={handleOnboardingSubmit} className="space-y-5">
                 {formData.role === 'vendor' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                       <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-2 block opacity-50">Store Name</label>
                       <div className="relative">
                         <Store className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)]" />
                         <input 
                           type="text" 
                           required
                           placeholder="Enter Store Name"
                           value={onboardingData.store_name}
                           onChange={e => setOnboardingData({...onboardingData, store_name: e.target.value})}
                           className="w-full bg-transparent pl-8 py-1 text-sm font-bold outline-none"
                         />
                       </div>
                    </div>
                    <div className="p-4 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-2 block opacity-50">Store Description</label>
                      <textarea 
                        placeholder="Tell us about your brand..."
                        required
                        value={onboardingData.description}
                        onChange={e => setOnboardingData({...onboardingData, description: e.target.value})}
                        className="w-full bg-transparent py-1 text-sm font-bold outline-none h-20 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Categories (Interests) - Horizontal Scroll on Mobile */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] px-1 opacity-60">
                    {formData.role === 'vendor' ? 'Store Categories' : 'What are you looking for?'}
                  </label>
                  <div className="flex flex-wrap md:flex-wrap gap-2 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                    {categories.map(cat => (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => setOnboardingData(prev => ({
                          ...prev,
                          selectedCategories: prev.selectedCategories.includes(cat._id) 
                            ? prev.selectedCategories.filter(id => id !== cat._id) 
                            : [...prev.selectedCategories, cat._id]
                        }))}
                         className={`px-4 py-2 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap ${
                          onboardingData.selectedCategories.includes(cat._id)
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 scale-105'
                          : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location Selection - Modern Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl transition-all focus-within:border-[var(--accent)]/50 group">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-2 block opacity-50">City</label>
                    <div className="relative">
                      <AuraMapPin className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)] transition-transform group-focus-within:scale-110" />
                      <select 
                         required
                         value={onboardingData.city}
                         onFocus={fetchZonesIfNeeded}
                         onChange={e => setOnboardingData({...onboardingData, city: e.target.value, quartier: ''})}
                         className="w-full bg-transparent pl-8 pr-8 py-1 text-sm font-bold outline-none appearance-none cursor-pointer"
                      >
                         <option value="">Select City</option>
                         {zones.filter(z => z.type === 'region').map(z => (
                           <option key={z._id} value={z.name}>{z.name}</option>
                         ))}
                      </select>
                      <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 size-4 opacity-20 rotate-90" />
                    </div>
                  </div>

                  {onboardingData.city && (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl transition-all focus-within:border-[var(--accent)]/50 group"
                    >
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-2 block opacity-50">Zone</label>
                      <div className="relative">
                        <Globe className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)] transition-transform group-focus-within:rotate-90" />
                        <select 
                           required
                           disabled={!onboardingData.city}
                           value={onboardingData.quartier}
                           onChange={e => setOnboardingData({...onboardingData, quartier: e.target.value})}
                           className="w-full bg-transparent pl-8 pr-8 py-1 text-sm font-bold outline-none appearance-none cursor-pointer disabled:opacity-30"
                        >
                           <option value="">Select Zone</option>
                           {zones.filter(z => z.type === 'quartier' && z.parent_id?.name === onboardingData.city).map(z => (
                             <option key={z._id} value={z.name}>{z.name}</option>
                           ))}
                        </select>
                        <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 size-4 opacity-20 rotate-90" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Follow Vendors - Feed Style */}
                {formData.role === 'customer' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex flex-col">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] opacity-60">Follow Vendors</label>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-40">Personalize your matrix feed</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${onboardingData.followedVendors.length >= 2 ? 'bg-green-500/20 text-green-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]'}`}>
                        {onboardingData.followedVendors.length}/2 Selected
                      </div>
                    </div>
                    
                    {fetchingResources ? (
                      <div className="flex flex-col items-center justify-center py-10 opacity-30">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p className="text-[10px] font-bold tracking-widest uppercase">Syncing Nodes</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                        {vendors.length > 0 ? vendors.map(v => (
                          <div
                            key={v._id}
                            onClick={() => setOnboardingData(prev => ({
                              ...prev,
                              followedVendors: prev.followedVendors.includes(v._id) 
                                ? prev.followedVendors.filter(id => id !== v._id) 
                                : [...prev.followedVendors, v._id]
                            }))}
                            className={`group p-3 rounded-[1.5rem] border transition-all cursor-pointer flex items-center justify-between ${
                              onboardingData.followedVendors.includes(v._id)
                              ? 'bg-[var(--accent)]/5 border-[var(--accent)] shadow-md'
                              : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:border-[var(--accent)]/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[14px] font-bold text-[var(--accent)] shadow-inner">
                                {v.store_name?.[0] || 'V'}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[13px] font-bold text-[var(--text-primary)]">{v.store_name}</span>
                                <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-50">Verified Node</span>
                              </div>
                            </div>
                            <div className={`p-1.5 rounded-full transition-all ${onboardingData.followedVendors.includes(v._id) ? 'bg-[var(--accent)] text-white' : 'bg-[var(--accent)]/5 text-[var(--accent)] opacity-40 group-hover:opacity-100'}`}>
                              {onboardingData.followedVendors.includes(v._id) ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4 rotate-45" />}
                            </div>
                          </div>
                        )) : (
                          <div className="w-full text-center py-8 bg-[var(--bg-primary)] rounded-[2rem] border border-dashed border-[var(--glass-border)]">
                            <Store className="w-8 h-8 mx-auto mb-2 opacity-10" />
                            <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-40">No available nodes in this sector</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-[2rem] bg-[var(--accent)] text-white font-bold text-sm shadow-xl shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    formData.role === 'customer' && onboardingData.followedVendors.length < 2 
                    ? 'Pick 2+ Stores to Activate' 
                    : 'Activate Profile'
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-8 text-center text-[10px] font-bold text-[var(--text-secondary)] opacity-40">
        © 2026 Aura Ecosystem
      </p>
    </div>
  );
}
