"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Heart, MapPin, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Store, 
  Package, LayoutGrid, Check, Search, SkipForward, Plus, Globe
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

const STEPS = [
  { id: 'vendors', title: 'Discover Nodes', icon: Users, desc: 'Follow at least 2 vendors to synchronize with their frequency.' },
  { id: 'categories', title: 'Pulse Interests', icon: Heart, desc: 'Select at least 2 categories to calibrate your discovery feed.' },
  { id: 'location', title: 'Signal Point', icon: MapPin, desc: 'Set your operational coordinates for logistics routing.' },
  { id: 'finish', title: 'Calibration', icon: CheckCircle2, desc: 'Finalize your node profile and enter the Hub.' }
];

const VENDOR_STEPS = [
  { id: 'profile', title: 'Merchant Identity', icon: Store, desc: 'Establish your brand signature and mission manifesto.' },
  { id: 'categories', title: 'Trade Sectors', icon: LayoutGrid, desc: 'Identify your primary operational categories for trade.' },
  { id: 'location', title: 'Fulfillment Base', icon: MapPin, desc: 'Define your primary sector for logistics and pickups.' },
  { id: 'finish', title: 'Node Activation', icon: CheckCircle2, desc: 'Finalize your merchant matrix and enter the network.' }
];

export default function OnboardingPage() {
  const router = useRouter();
   const { user, updateUser } = useAuthStore();
   const [currentStep, setCurrentStep] = useState(0);
   const [loading, setLoading] = useState(false);
   
   // Data State
   const [vendors, setVendors] = useState([]);
   const [categories, setCategories] = useState([]);
   const [zones, setZones] = useState([]);
   
   // Selections
   const [followedVendors, setFollowedVendors] = useState([]);
   const [selectedCategories, setSelectedCategories] = useState([]);
   const [location, setLocation] = useState({ city: '', quartier: '', address_description: '' });
   const [vendorProfile, setVendorProfile] = useState({ store_name: '', description: '' });
   
   const isVendor = user?.role === 'vendor';
   const ACTIVE_STEPS = isVendor ? VENDOR_STEPS : STEPS;

   // Pre-fill from user profile
   useEffect(() => {
     if (user) {
       if (user.liked_categories?.length > 0) {
         setSelectedCategories(user.liked_categories.map(c => c._id || c));
       }
       if (user.onboarding_location) {
         setLocation({
           city: user.onboarding_location.city || '',
           quartier: user.onboarding_location.quartier || '',
           address_description: user.onboarding_location.address_description || ''
         });
       }
     }
   }, [user]);

   // UI State
   const [search, setSearch] = useState('');
   const [fetching, setFetching] = useState(true);
   const [syncing, setSyncing] = useState(null); // ID of vendor being synced
   const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(12);

   useEffect(() => {
      if (!user) return;
      if (user.onboarded) {
         router.push(user.role === 'vendor' ? '/vendor/dashboard' : '/discovery');
         return;
      }

      const fetchInitData = async () => {
         try {
            const [vRes, cRes, fRes, zRes] = await Promise.all([
               api.get('/vendors'),
               api.get('/categories'),
               api.get('/users/followed-vendors'),
               api.get('/logistics/zones')
            ]);
            
            const vendorList = vRes.data.data.stores || [];
            const categoryList = cRes.data.data || [];
            const follows = fRes.data.data.follows?.map(f => (f.vendor_id?._id || f.vendor_id).toString()) || [];
            const zonesList = zRes.data.data.zones || [];

            setVendors(vendorList);
            setCategories(categoryList);
            setFollowedVendors(follows);
            setZones(zonesList);

            // Fetch vendor profile if role is vendor
            if (isVendor) {
               try {
                  const vpRes = await api.get('/vendors/me');
                  if (vpRes.data.success && vpRes.data.data.vendor) {
                     setVendorProfile({
                        store_name: vpRes.data.data.vendor.store_name || '',
                        description: vpRes.data.data.vendor.description || ''
                     });
                  }
               } catch (e) { console.log("No partial vendor profile yet."); }
            }

            // Auto-skip logic
            const hasCategories = (user.liked_categories?.length || 0) >= 2 || categoryList.length === 0; // fallback if no categories exist
            const hasLocation = !!(user.onboarding_location?.city || false);
            const hasFollows = follows.length >= 2;

            if (hasFollows && hasCategories && hasLocation) {
               toast.success('Signal already calibrated. Redirecting...');
               router.push('/discovery');
            }
         } catch (err) {
            console.error('Onboarding Fetch Error:', err);
            toast.error('Failed to resolve data nodes.');
         } finally {
            setFetching(false);
         }
      };

      fetchInitData();
   }, [user, isVendor, router]);

  // Reset visible count when search changes
  useEffect(() => {
    if (search) setVisibleCategoriesCount(100); // Show more when searching
    else setVisibleCategoriesCount(12);
  }, [search]);

   const handleToggleFollow = async (vIdString) => {
     const isFollowing = followedVendors.includes(vIdString);
     try {
       setSyncing(vIdString);
       if (isFollowing) {
         await api.delete(`/vendors/${vIdString}/follow`);
         setFollowedVendors(prev => prev.filter(id => id !== vIdString));
         toast.success('Connection severed.');
       } else {
         try {
           await api.post(`/vendors/${vIdString}/follow`);
           setFollowedVendors(prev => [...prev, vIdString]);
           toast.success('Node synchronized.');
         } catch (err) {
           if (err.response?.status === 400) {
              setFollowedVendors(prev => [...new Set([...prev, vIdString])]);
              toast.success('Node state synchronized.');
           } else throw err;
         }
       }
     } catch (err) {
       console.error('Follow error:', err);
       toast.error('Sync failed. Terminal unstable.');
     } finally {
       setSyncing(null);
     }
   };

    const nextStep = () => {
      // Step Validation
      if (isVendor) {
        if (currentStep === 0 && (!vendorProfile.store_name || !vendorProfile.description)) {
          return toast.error('Identify your matrix with a name and mission manifesto.');
        }
      } else {
        if (currentStep === 0 && followedVendors.length < 2) {
          return toast.error('Follow at least 2 vendors to stabilize the connection.');
        }
      }

      if (currentStep === 1 && selectedCategories.length < 2) {
        return toast.error('Select at least 2 interests for feed calibration.');
      }
      if (currentStep === 2 && (!location.city || !location.quartier)) {
        return toast.error('City and Quartier are mandatory operational parameters.');
      }
      setSearch(''); // Clear search when moving steps
      setCurrentStep(prev => prev + 1);
    };

   const prevStep = () => {
     setSearch('');
     setCurrentStep(prev => prev - 1);
   };

   const skipOnboarding = () => {
     // Store a SESSION-only flag — clears when the browser tab closes or user logs out.
     // This means onboarding will reappear on next login without permanently marking them as onboarded.
     sessionStorage.setItem('onboarding_skipped', 'true');
     router.push('/discovery');
   };

    const finishOnboarding = async () => {
       try {
          setLoading(true);

          if (isVendor) {
            // 1. Create Vendor & Store Profile (Now atomically marks user as onboarded)
            const vendorRes = await api.post('/vendors/onboard', {
              store_name: vendorProfile.store_name,
              description: vendorProfile.description,
              categories: selectedCategories,
              location: location
            });
            
            if (vendorRes.data.success) {
               toast.success('Signal Origin Established.');
               if (vendorRes.data.data?.user) updateUser(vendorRes.data.data.user);
               router.push('/vendor/dashboard');
               return; // Skip secondary non-atomic call
            }
          }

          // 2. Finalize User Onboarding State (For Customers)
          const res = await api.patch('/users/onboarding', {
             liked_categories: selectedCategories,
             location: location,
             onboarded: true
          });
          
          if (res.data.success) {
             toast.success('Signal Origin Established.');
             updateUser(res.data.data.user);
             router.push('/discovery');
          }
       } catch (err) {
          console.error('Finish onboarding error:', err);
          toast.error(err.response?.data?.message || 'Sync failed. Re-calibrate.');
       } finally {
          setLoading(false);
       }
    };

  if (fetching) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center space-y-6">
        <Loader2 className="size-12 animate-spin text-[var(--accent)]" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Synchronizing Matrix Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-hidden flex flex-col pt-20">
      {/* Background blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent)]/10 blur-[120px] rounded-full -z-0" />
      <div className="fixed bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-[var(--accent-light)]/5 blur-[100px] rounded-full -z-0" />

      {/* Header Container */}
      <div className="max-w-xl mx-auto w-full px-6 relative z-10 flex flex-col items-center mb-12">
         {/* Step Indicators */}
         <div className="flex items-center gap-2 mb-10 w-full justify-between">
            {ACTIVE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              return (
                <div key={step.id} className="flex flex-col items-center gap-3 group relative flex-1">
                   {idx > 0 && <div className={`absolute right-1/2 w-full h-[2px] -z-10 top-5 transition-colors duration-500 bg-gradient-to-r ${isDone || isActive ? 'from-[var(--accent)]/40 to-transparent' : 'from-[var(--glass-border)] to-transparent'}`} />}
                   <div className={`size-10 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                     isActive ? 'bg-[var(--accent)] text-white border-[var(--accent)] scale-110 shadow-lg shadow-[var(--accent)]/20' : 
                     isDone ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--glass-border)]'
                   }`}>
                      {isDone ? <Check className="size-5" /> : <Icon className="size-5" />}
                   </div>
                   <span className={`text-[8px] font-black uppercase tracking-widest transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-20'}`}>
                      {step.title}
                   </span>
                </div>
              );
            })}
         </div>

         <motion.div 
           key={currentStep}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           className="text-center space-y-3"
         >
            <h1 className="text-4xl font-black tracking-tighter uppercase">{ACTIVE_STEPS[currentStep].title}</h1>
            <p className="text-[var(--text-secondary)] font-medium text-sm max-w-xs mx-auto opacity-60 leading-relaxed">
              {ACTIVE_STEPS[currentStep].desc}
            </p>
         </motion.div>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-6 relative z-10 mb-32 overflow-y-auto no-scrollbar">
         <AnimatePresence mode="wait">
            {currentStep === 0 && (
               <motion.div 
                 key="step0"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 1.05 }}
                 className="space-y-6"
               >
                  {isVendor ? (
                     <div className="max-w-md mx-auto space-y-8">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] ml-4">Merchant Name</label>
                           <div className="relative">
                              <Store className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-[var(--text-secondary)] opacity-40" />
                              <input 
                                 type="text" 
                                 placeholder="e.g. Aura Fashion Elite"
                                 value={vendorProfile.store_name}
                                 onChange={e => setVendorProfile(prev => ({ ...prev, store_name: e.target.value }))}
                                 className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] pl-16 pr-8 py-5 text-sm font-bold focus:ring-4 focus:ring-[var(--accent)]/10 outline-none shadow-inner"
                              />
                           </div>

                           <label className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] ml-4 block pt-2">Manifesto / Description</label>
                           <textarea 
                              placeholder="Tell the network about your brand mission..."
                              value={vendorProfile.description}
                              onChange={e => setVendorProfile(prev => ({ ...prev, description: e.target.value }))}
                              className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-6 text-sm font-bold focus:ring-4 focus:ring-[var(--accent)]/10 outline-none h-40 resize-none shadow-inner"
                           />
                        </div>
                     </div>
                  ) : (
                     <>
                        <div className="relative">
                           <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-[var(--text-secondary)] opacity-40" />
                           <input 
                             type="text" 
                             placeholder="Scan for vendor signatures..."
                             value={search}
                             onChange={e => setSearch(e.target.value)}
                             className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] pl-16 pr-8 py-5 text-sm font-bold focus:ring-4 focus:ring-[var(--accent)]/10 outline-none shadow-inner"
                           />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {vendors
                             .filter(v => !followedVendors.some(id => id.toString() === (v._id || v).toString()))
                             .filter(v => v.store_name.toLowerCase().includes(search.toLowerCase()))
                             .map(v => (
                              <div key={v._id} className="p-6 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all flex items-center gap-6 shadow-xl relative overflow-hidden group">
                                 <div className="size-16 rounded-[24px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 shadow-inner">
                                    <img src={v.user_id?.branding?.logo || v.user_id?.avatar} className="size-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-black uppercase tracking-tight truncate">{v.store_name}</h4>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] opacity-60">Verified Node</p>
                                 </div>
                                 <button 
                                   onClick={() => handleToggleFollow(v._id)}
                                   disabled={syncing === v._id}
                                   className={`px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
                                     followedVendors.some(id => id.toString() === v._id.toString()) 
                                     ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                     : 'bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                                   } ${syncing === v._id ? 'opacity-50 cursor-wait' : ''}`}
                                 >
                                    {syncing === v._id ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : followedVendors.some(id => id.toString() === v._id.toString()) ? (
                                      <Check className="size-3" />
                                    ) : null}
                                    {syncing === v._id ? 'Syncing...' : followedVendors.some(id => id.toString() === v._id.toString()) ? 'Active' : 'Follow'}
                                 </button>
                              </div>
                           ))}
                        </div>
                     </>
                  )}
               </motion.div>
            )}

            {currentStep === 1 && (
               <motion.div 
                 key="step1"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 1.05 }}
                 className="space-y-6"
               >
                  <div className="relative">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-[var(--text-secondary)] opacity-40" />
                     <input 
                       type="text" 
                       placeholder="Filter frequency spectrum (Categories)..."
                       value={search}
                       onChange={e => setSearch(e.target.value)}
                       className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] pl-16 pr-8 py-5 text-sm font-bold focus:ring-4 focus:ring-[var(--accent)]/10 outline-none shadow-inner"
                     />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                     {categories
                       .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
                       .slice(0, visibleCategoriesCount)
                       .map(cat => (
                        <button
                           key={cat._id}
                           onClick={() => setSelectedCategories(prev => 
                              prev.includes(cat._id) ? prev.filter(id => id !== cat._id) : [...prev, cat._id]
                           )}
                           className={`p-4 rounded-3xl glass-panel border transition-all flex flex-col items-center gap-3 text-center shadow-lg group relative overflow-hidden ${
                              selectedCategories.includes(cat._id)
                              ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                              : 'bg-[var(--bg-primary)]/40 border-[var(--glass-border)] hover:border-[var(--accent)]/40'
                           }`}
                        >
                           <div className={`size-10 rounded-xl flex items-center justify-center transition-all ${
                              selectedCategories.includes(cat._id) ? 'bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20' : 'bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)]'
                           }`}>
                              <LayoutGrid className="size-5" />
                           </div>
                           <span className="text-[9px] font-black uppercase tracking-tight leading-tight">{cat.name}</span>
                           {selectedCategories.includes(cat._id) && (
                              <div className="absolute top-2 right-2 size-4 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg">
                                 <Check className="size-2.5" />
                              </div>
                           )}
                        </button>
                     ))}
                  </div>

                  {!search && visibleCategoriesCount < categories.length && (
                    <div className="flex justify-center pt-8">
                       <button 
                         onClick={() => setVisibleCategoriesCount(prev => prev + 20)}
                         className="px-10 py-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-[0.2em] hover:border-[var(--accent)]/40 transition-all flex items-center gap-3 group"
                       >
                          <Plus className="size-4 group-hover:rotate-90 transition-transform duration-500" />
                          Expand Spectrum
                       </button>
                    </div>
                  )}
               </motion.div>
            )}

            {currentStep === 2 && (
               <motion.div 
                 key="step2"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 1.05 }}
                 className="max-w-md mx-auto space-y-8"
               >
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] ml-4">Operational Sector (City)</label>
                     <div className="relative">
                        <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-[var(--text-secondary)] opacity-40" />
                        <select 
                           value={location.city}
                           onChange={e => setLocation(prev => ({ ...prev, city: e.target.value, quartier: '' }))}
                           className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] pl-16 pr-8 py-5 text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-[var(--accent)]/10"
                        >
                           <option value="">Select City Node</option>
                           {zones.filter(z => z.type === 'region').map(z => (
                              <option key={z._id} value={z.name}>{z.name}</option>
                           ))}
                        </select>
                     </div>

                     <label className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] ml-4 block pt-2">Local Quartier (Zone)</label>
                     <div className="relative">
                        <Globe className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-[var(--text-secondary)] opacity-40" />
                        <select 
                           value={location.quartier}
                           onChange={e => setLocation(prev => ({ ...prev, quartier: e.target.value }))}
                           disabled={!location.city}
                           className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[32px] pl-16 pr-8 py-5 text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-[var(--accent)]/10 disabled:opacity-50"
                        >
                           <option value="">Select Quartier Signal</option>
                           {zones.filter(z => z.type === 'quartier' && z.parent_id?.name === location.city).map(z => (
                              <option key={z._id} value={z.name}>{z.name}</option>
                           ))}
                        </select>
                     </div>

                     <label className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] ml-4 block pt-2">Address Description (Optional)</label>
                     <textarea 
                        placeholder="Additional routing metadata (Door #, Landmark)..."
                        value={location.address_description}
                        onChange={e => setLocation(prev => ({ ...prev, address_description: e.target.value }))}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-6 text-sm font-bold focus:ring-4 focus:ring-[var(--accent)]/10 outline-none h-32 resize-none"
                     />
                  </div>
               </motion.div>
            )}

            {currentStep === 3 && (
               <motion.div 
                 key="step3"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="max-w-md mx-auto space-y-8 pb-12"
               >
                  <div className="p-10 rounded-[48px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 size-32 bg-[var(--accent)]/10 rounded-full blur-[40px]" />
                     
                     <div className="space-y-10 relative z-10">
                         <div className="flex items-center gap-6">
                            <div className={`size-14 rounded-2xl ${isVendor ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-[var(--accent)]/10 text-[var(--accent)]'} flex items-center justify-center border shadow-inner`}>
                               {isVendor ? <Store className="size-6" /> : <Users className="size-6" />}
                            </div>
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{isVendor ? 'Merchant Entity' : 'Followed Nodes'}</p>
                               <h4 className="text-xl font-black uppercase tracking-tight truncate">{isVendor ? vendorProfile.store_name : `${followedVendors.length} Connections`}</h4>
                            </div>
                         </div>

                        <div className="flex items-center gap-6">
                           <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                              <Heart className="size-6" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Active Pulses</p>
                              <h4 className="text-2xl font-black uppercase tracking-tight">{selectedCategories.length} Categories</h4>
                           </div>
                        </div>

                        <div className="flex items-center gap-6">
                           <div className="size-14 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
                              <MapPin className="size-6" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Signal Origin</p>
                              <h4 className="text-2xl font-black uppercase tracking-tight truncate">{location.city}, {location.quartier}</h4>
                           </div>
                        </div>
                     </div>
                  </div>

                  <button 
                    onClick={finishOnboarding}
                    disabled={loading}
                    className="w-full py-8 rounded-full bg-[var(--accent)] text-white font-black text-[12px] tracking-[0.4em] uppercase shadow-2xl shadow-[var(--accent)]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? <Loader2 className="size-6 animate-spin" /> : <CheckCircle2 className="size-6" />}
                    {loading ? 'Initializing Interface...' : 'Authorize Main Hub Access'}
                  </button>
               </motion.div>
            )}
         </AnimatePresence>
      </div>

      {/* Persistent Controls */}
      <div className="fixed bottom-0 left-0 w-full p-8 md:p-12 z-50 pointer-events-none">
         <div className="max-w-4xl mx-auto flex items-center justify-between pointer-events-auto">
            <button 
              onClick={prevStep}
              className={`h-14 px-10 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] font-black text-[10px] tracking-widest uppercase flex items-center gap-3 transition-all hover:bg-[var(--bg-secondary)] ${currentStep === 0 ? 'opacity-0 pointer-events-none' : ''}`}
            >
               <ArrowLeft className="size-4" />
               Revert
            </button>
            
            <div className="flex items-center gap-4">
               {currentStep < 3 && (
                  <button 
                    onClick={skipOnboarding}
                    className="h-14 px-8 rounded-2xl text-[var(--text-secondary)] opacity-40 hover:opacity-100 font-black text-[10px] tracking-widest uppercase transition-all flex items-center gap-2"
                  >
                    Skip <SkipForward className="size-4" />
                  </button>
               )}
               {currentStep < 3 && (
                  <button 
                    onClick={nextStep}
                    className="h-14 px-12 rounded-2xl bg-[var(--accent)] text-white font-black text-[10px] tracking-widest uppercase shadow-xl shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                  >
                    Calibrate & Proceed <ArrowRight className="size-4" />
                  </button>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

