"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, Bell, Shield, Lock, Power, ChevronRight,
  Store, ShieldAlert, Palette, Database, BarChart3,
  Mail, MapPin, Camera, ExternalLink, RefreshCw,
  Truck, LayoutGrid, ShoppingBag,
  Users, Heart, Phone, Moon, Sun, ShieldCheck
} from 'lucide-react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import Pagination from '@/components/common/Pagination';

const TABS = [
  { id: 'general', label: 'General', icon: User, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, roles: ['customer', 'vendor'] },
  { id: 'security', label: 'Security', icon: Shield, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'network', label: 'Network', icon: Users, roles: ['customer', 'vendor'] },
  { id: 'audience', label: 'Audience', icon: Heart, roles: ['vendor'] },

  { id: 'store', label: 'Storefront', icon: Store, roles: ['vendor'] },
  { id: 'fleet', label: 'Fleet Management', icon: Truck, roles: ['logistics'] },
  { id: 'governance', label: 'Governance', icon: ShieldAlert, roles: ['admin'] },
  { id: 'kyc', label: 'Verification', icon: Shield, roles: ['customer', 'vendor'] },
  { id: 'notifications', label: 'Signals', icon: Bell, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'advanced', label: 'Advanced', icon: Database, roles: ['admin'] },
];

export default function AccountPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const canUseBanner = ['vendor', 'logistics'].includes(user?.role);

  useEffect(() => {
    const tabUrl = searchParams.get('tab');
    if (tabUrl && TABS.some((t) => t.id === tabUrl)) setActiveTab(tabUrl);
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [profileBranding, setProfileBranding] = useState({ logo: '', banner: '' });
  const [brandingStatus, setBrandingStatus] = useState('');
  const [brandingUploading, setBrandingUploading] = useState(null); // 'logo' | 'banner' | 'kyc' | null

  const [storeData, setStoreData] = useState({
    store_name: '',
    description: '',
    logo: user?.branding?.logo || '',
    banner: user?.branding?.banner || '',
    pickup_address: { city: '', quartier: '', address_description: '' }
  });

  const [userData, setUserData] = useState({ 
    name: '', 
    phone: '',
    onboarding_location: { city: '', quartier: '', address_description: '' }
  });
  
  const [zones, setZones] = useState([]);
  
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await api.get('/logistics/zones');
        if (res.data.success) setZones(res.data.data.zones || []);
      } catch (e) {}
    };
    fetchZones();
  }, []);
  const [kycData, setKycData] = useState({ full_name: '', id_type: 'national_id', id_number: '', file_url_front: '', file_url_back: '' });
  const [kycStatus, setKycStatus] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [followedVendors, setFollowedVendors] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);

  const [audience, setAudience] = useState([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [govUsers, setGovUsers] = useState([]);

  const fetchOrders = useCallback(async () => {
     if (!user) return;
     setOrdersLoading(true);
     try {
       const endpoint = user?.role === 'vendor' ? '/orders/vendor-orders' : '/orders/my-orders';
       const res = await api.get(endpoint);
       if (res.data.success) {
          setOrders(res.data.data.orders || []);
       }
     } catch (err) {
       console.error("Orders fetch failed", err);
     } finally {
       setOrdersLoading(false);
     }
  }, [user]);


  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'network') fetchNetwork();
    if (activeTab === 'audience') fetchAudience();
  }, [activeTab, fetchOrders]);

  const fetchNetwork = async () => {
    setNetworkLoading(true);
    try {
      const res = await api.get('/users/followed-vendors');
      if (res.data.success) setFollowedVendors(res.data.data.follows || []);
    } catch (err) { console.error(err); }
    finally { setNetworkLoading(false); }
  };

  const fetchAudience = async () => {
    setAudienceLoading(true);
    try {
      // First get vendor profile to get ID
      const vRes = await api.get('/vendors/me');
      if (vRes.data.success) {
        const aRes = await api.get(`/vendors/${vRes.data.data.vendor._id}/followers`);
        if (aRes.data.success) setAudience(aRes.data.data.followers || []);
      }
    } catch (err) { console.error(err); }
    finally { setAudienceLoading(false); }
  };


  useEffect(() => {
    if (!user) return;
    const existing = user.branding || {};
    setProfileBranding({
      logo: existing.logo || user.avatar || '',
      banner: existing.banner || ''
    });
    if (user.role === 'vendor') {
      setStoreData(prev => ({
        ...prev,
        logo: existing.logo || user.avatar || '',
        banner: existing.banner || ''
      }));
    }
    setUserData({
      name: user.name || '',
      phone: user.phone || '',
      onboarding_location: {
        city: user.onboarding_location?.city || '',
        quartier: user.onboarding_location?.quartier || '',
        address_description: user.onboarding_location?.address_description || ''
      }
    });
    if (user.kyc) {
      setKycStatus(user.kyc.status);
      setKycData(d => ({ ...d, ...user.kyc }));
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    setBrandingStatus('Updating personal records...');
    try {
      const res = await api.patch('/users/me', userData);
      if (res.data?.success && res.data?.data?.user) {
        updateUser(res.data.data.user);
        setBrandingStatus('Profile updated.');
      }
    } catch (err) {
      console.error(err);
      setBrandingStatus('Profile update failed.');
    } finally {
      setProfileSaving(false);
      if (user.role === 'vendor' && userData.name) {
         setStoreData(s => ({ ...s, store_name: userData.name }));
         // Optionally trigger auto-sync with vendor record here
      }
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const fetchVendorProfile = useCallback(async () => {
    try {
      const res = await api.get('/vendors/me');
      if (res.data.success) {
        const v = res.data.data.vendor;
        setStoreData({
          store_name: v.store_name || '',
          description: v.description || '',
          logo: v.store?.logo || '',
          banner: v.store?.banner || '',
          pickup_address: {
             city: v.pickup_address?.city || '',
             quartier: v.pickup_address?.quartier || '',
             address_description: v.pickup_address?.address_description || ''
          }
        });
      }
    } catch (err) {
      console.error("Failed to fetch vendor profile", err);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'vendor') fetchVendorProfile();
  }, [user, fetchVendorProfile]);

  const handleUpdateStore = async () => {
    setLoading(true);
    setSaveStatus('Saving changes...');
    try {
      await api.patch('/vendors/profile', {
        store_name: storeData.store_name,
        description: storeData.description,
        pickup_address: storeData.pickup_address
      });
      setSaveStatus('Store profile synchronized.');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error("Update failed", err);
      setSaveStatus('Sync failed. Check terminal.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranding = async () => {
    setBrandingStatus('Saving branding...');
    try {
      const brandingPayload = canUseBanner
        ? { logo: profileBranding.logo, banner: profileBranding.banner }
        : { logo: profileBranding.logo };
      
      const res = await api.patch('/users/me', {
        branding: brandingPayload
      });

      if (user?.role === 'vendor') {
        // Also update the store visuals for consistency
        await api.patch('/vendors/store', { 
          logo: profileBranding.logo, 
          banner: profileBranding.banner 
        });
      }

      if (res.data?.success && res.data?.data?.user) updateUser(res.data.data.user);
      setBrandingStatus('Branding updated platforms-wide.');
      setTimeout(() => setBrandingStatus(''), 2500);
    } catch (err) {
      console.error('Branding update failed', err);
      setBrandingStatus('Branding update failed.');
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const handleBrandingFileUpload = async (field, file) => {
    if (!file) return;
    setBrandingUploading(field);
    setBrandingStatus(`Uploading ${field.replace('_', ' ')}...`);
    try {
      // 📂 PASS TYPE: Ensures folder organization on the hosting
      let uploadType = 'general';
      if (field === 'logo') uploadType = 'avatars';
      if (field === 'banner') uploadType = 'banners';
      if (field.startsWith('kyc')) uploadType = 'kyc';

      const res = await uploadService.uploadSingle(file, uploadType);
      if (res?.success && res?.data?.url) {
        if (field === 'kyc_front') {
          setKycData((p) => ({ ...p, file_url_front: res.data.url }));
          setBrandingStatus(`Front of ID uploaded.`);
        } else if (field === 'kyc_back') {
          setKycData((p) => ({ ...p, file_url_back: res.data.url }));
          setBrandingStatus(`Back of ID uploaded.`);
        } else {
          setProfileBranding((p) => ({ ...p, [field]: res.data.url }));
          setBrandingStatus(`${field} uploaded. Save to apply.`);
        }
      } else {
        setBrandingStatus('Upload failed.');
      }
      setTimeout(() => setBrandingStatus(''), 2500);
    } catch (err) {
      console.error('Branding upload failed', err);
      setBrandingStatus('Upload failed.');
      setTimeout(() => setBrandingStatus(''), 2500);
    } finally {
      setBrandingUploading(null);
    }
  };

  const handleKYCSubmit = async () => {
    setKycLoading(true);
    setBrandingStatus('Submitting KYC data...');
    try {
      const res = await api.post('/users/kyc', kycData);
      if (res.data?.success) {
        updateUser(res.data.data.user);
        setKycStatus(res.data.data.user.kyc.status);
        setBrandingStatus('KYC data submitted successfully. Awaiting review.');
      } else {
        setBrandingStatus('KYC submission failed.');
      }
    } catch (err) {
      console.error('KYC submission failed', err);
      setBrandingStatus('KYC submission failed.');
    } finally {
      setKycLoading(false);
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const filteredTabs = TABS.filter((t) => t.roles.includes(user?.role || 'customer'));

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-700">
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_0%_0%,var(--accent)_0%,transparent_30%),radial-gradient(circle_at_100%_100%,_#3b82f6_0%,transparent_30%)] opacity-[0.02]" />

      <div className="flex flex-col lg:flex-row min-h-screen max-w-[1600px] mx-auto overflow-hidden">
        <div className="w-full lg:w-80 lg:border-r border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 z-40 lg:h-screen lg:flex lg:flex-col shrink-0">
          <div className="px-6 py-8 md:px-10 flex items-center justify-between lg:block">
            <div className="flex items-center gap-4 mb-0 lg:mb-12">
              <button onClick={() => router.back()} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:text-[var(--accent)] transition-all">
                <ArrowLeft className="size-5" />
              </button>
              <div className="flex flex-col">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight  leading-none">Account</h1>
                <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)]  mt-1 opacity-60">Control Panel</span>
              </div>
            </div>

            <Link 
              href={`/${user?.role}/dashboard`}
              className="hidden lg:flex items-center gap-3 px-6 py-4 mb-6 rounded-2xl bg-[var(--accent)] text-white font-bold text-[10px] tracking-[0.2em]  shadow-lg shadow-[var(--accent)]/30 hover:scale-105 active:scale-95 transition-all"
            >
              <LayoutGrid className="size-4" />
              Return to Dashboard
            </Link>

            <div className="hidden lg:flex items-center gap-4 mb-10 p-4 rounded-3xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]">
               <div className="size-12 rounded-2xl bg-[var(--bg-primary)] overflow-hidden border border-[var(--glass-border)] flex items-center justify-center">
                  {profileBranding.logo ? (
                    <img src={profileBranding.logo} className="size-full object-cover" alt="Node" />
                  ) : (
                    <User className="size-6 text-[var(--accent)]" />
                  )}
               </div>
               <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold tracking-tight  truncate">{user?.name}</p>
                  <p className="text-[11px] font-bold tracking-tight  text-[var(--text-secondary)] opacity-50 truncate">{user?.role}</p>
               </div>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <div className="size-10 rounded-xl overflow-hidden border border-[var(--glass-border)] mr-2">
                 <img src={profileBranding.logo || user?.avatar} className="size-full object-cover" alt="" />
              </div>
              <button onClick={() => logout()} className="size-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Power className="size-5" />
              </button>
            </div>

            <nav className="hidden lg:flex flex-col gap-2">
              {filteredTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      group flex items-center justify-between px-6 py-4 md:py-4.5 rounded-[1.5rem] transition-all duration-300
                      ${activeTab === tab.id
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <Icon className={`size-5 transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-white' : 'text-[var(--accent)]'}`} />
                      <span className="text-[11px] font-bold tracking-[0.2em] ">{tab.label}</span>
                    </div>
                    {activeTab === tab.id && (
                      <motion.div layoutId="activeInd" className="size-1.5 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="lg:hidden flex items-center overflow-x-auto px-6 pb-4 no-scrollbar gap-2 -mt-2">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-6 py-3 md:py-3.5 rounded-full text-[10px] md:text-[11px] font-bold tracking-tight  transition-all ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent)] text-white shadow-md'
                    : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:mt-auto lg:p-10 lg:block">
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-xl hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <Power className="size-5" />
                <span className="text-[11px] font-bold tracking-tight ">Terminate Session</span>
              </div>
              <ChevronRight className="size-4 opacity-40 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>

        <main className="flex-1 px-6 py-8 md:px-12 md:py-16 lg:px-20 lg:py-24 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-w-4xl mx-auto space-y-12"
            >
              {activeTab === 'general' && (
                <div className="space-y-12">
                  <header className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">General Matrix</h2>
                    <p className="text-[var(--text-secondary)] font-medium max-w-lg">Universal identity and interface parameters for your Aura profile.</p>
                  </header>

                  <div className="bg-[var(--bg-primary)]/80 backdrop-blur-3xl border border-[var(--glass-border)] rounded-[3rem] p-8 md:p-12 relative overflow-hidden glass-panel group shadow-2xl mb-12 flex flex-col items-center justify-center text-center">
                    <div className="absolute inset-x-0 -top-24 h-64 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
                    
                    {/* Header: Identity & Roles */}
                    <div className="relative group shrink-0 mb-6">
                       <div className="absolute inset-0 bg-[var(--accent)]/40 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                       <div className="size-32 md:size-40 rounded-[2rem] border-4 border-[var(--bg-secondary)] bg-[var(--bg-secondary)] overflow-hidden shadow-2xl relative z-10 transition-transform duration-500 group-hover:scale-105 flex items-center justify-center text-5xl font-bold text-[var(--accent)]">
                         {profileBranding.logo ? (
                            <img src={profileBranding.logo} className="size-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                         ) : (
                            user?.name?.[0]?.toUpperCase()
                         )}
                       </div>
                       <label className="absolute -bottom-3 -right-3 size-12 rounded-[1.25rem] bg-[var(--text-primary)] text-[var(--bg-primary)] border-4 border-[var(--bg-secondary)] flex items-center justify-center hover:scale-110 transition-transform shadow-xl cursor-pointer z-20">
                         <Camera className="size-5" />
                         <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandingFileUpload('logo', e.target.files?.[0])} />
                       </label>
                    </div>

                    <div className="space-y-4 relative z-10 w-full">
                       <h3 className="text-3xl md:text-5xl font-bold tracking-tighter  shadow-sm">
                         {user?.role === 'vendor' ? (storeData.store_name || user?.name) : user?.name || 'Authorized User'}
                       </h3>
                       <p className="text-[var(--text-secondary)] font-medium flex items-center justify-center gap-2">
                         <Mail className="size-4 opacity-40" /> {user?.email}
                       </p>
                       <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                         <span className="px-4 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold tracking-tight  border border-[var(--accent)]/20 shadow-sm">
                           {user?.role === 'vendor' ? 'Nexus Vendor' : user?.role === 'admin' ? 'Root Administrator' : user?.role === 'logistics' ? 'Logistics Node' : 'Node User'}
                         </span>
                         <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-bold tracking-tight  border border-emerald-500/20 shadow-sm">
                           Active Session
                         </span>
                       </div>
                    </div>

                    {/* Branding Suite Integrated */}
                    <div className="border-t border-[var(--glass-border)]/50 pt-10 space-y-8 relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-bold tracking-[0.3em]  text-[var(--text-secondary)]">Platform Branding</h4>
                        {brandingStatus && <span className="text-[11px] font-bold text-[var(--accent)]  animate-pulse">{brandingStatus}</span>}
                      </div>

                      <div className={`grid grid-cols-1 ${canUseBanner ? 'md:grid-cols-2' : ''} gap-8`}>
                         <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                               <span className="text-[11px] font-bold tracking-tight  opacity-40">Identity Logo</span>
                               {brandingUploading === 'logo' && <RefreshCw className="size-3 animate-spin text-[var(--accent)]" />}
                            </div>
                            <div className="h-32 rounded-[32px] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center overflow-hidden hover:border-[var(--accent)]/30 transition-all group/b relative">
                               {profileBranding.logo ? (
                                 <img src={profileBranding.logo} className="size-full object-cover" alt="logo" />
                               ) : (
                                 <Store className="size-8 opacity-10" />
                               )}
                               <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/b:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                  <Camera className="text-white size-8" />
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandingFileUpload('logo', e.target.files?.[0])} />
                               </label>
                            </div>
                         </div>

                         {canUseBanner && (
                         <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                               <span className="text-[11px] font-bold tracking-tight  opacity-40">Immersion Banner</span>
                               {brandingUploading === 'banner' && <RefreshCw className="size-3 animate-spin text-[var(--accent)]" />}
                            </div>
                            <div className="h-32 rounded-[32px] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center overflow-hidden hover:border-[var(--accent)]/30 transition-all group/b relative">
                               {profileBranding.banner ? (
                                 <img src={profileBranding.banner} className="size-full object-cover" alt="banner" />
                               ) : (
                                 <ExternalLink className="size-8 opacity-10" />
                               )}
                               <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/b:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                  <ExternalLink className="text-white size-8" />
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandingFileUpload('banner', e.target.files?.[0])} />
                               </label>
                            </div>
                         </div>
                         )}
                      </div>

                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                           <InputModule 
                              label="Branding Key (Logo URL)" 
                              value={profileBranding.logo} 
                              onChange={(v) => setProfileBranding(p => ({...p, logo: v}))} 
                              icon={Camera} 
                              placeholder="https://..." 
                           />
                        </div>
                        {canUseBanner && (
                        <div className="flex-1">
                           <InputModule 
                              label="Immersion Link (Banner URL)" 
                              value={profileBranding.banner} 
                              onChange={(v) => setProfileBranding(p => ({...p, banner: v}))} 
                              icon={ExternalLink} 
                              placeholder="https://..." 
                           />
                        </div>
                        )}
                      </div>

                      <div className="pt-4 flex items-center justify-between">
                         <p className="text-[11px] font-bold tracking-tight  text-[var(--text-secondary)] opacity-50 max-w-xs">
                            {user?.role === 'vendor' ? 'Changes synchronize with your digital storefront node.' : 'Branding reflects across all platform interaction vectors.'}
                         </p>
                         <button
                            onClick={handleUpdateBranding}
                            className="bg-[var(--accent)] text-white px-10 py-4 rounded-2xl font-bold text-[10px] tracking-tight  shadow-xl shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all"
                         >
                            Deploy Branding Update
                         </button>
                      </div>
                    </div>
                  </div>

                  <SectionBox title="Personal Records">
                    <div className="space-y-6 pt-2">
                      <InputModule 
                        label="Official Designation" 
                        value={userData.name} 
                        onChange={(v) => setUserData({ ...userData, name: v })} 
                        icon={User} 
                        placeholder="Human Name" 
                      />
                      <InputModule 
                        label="Logistics Signal (Phone)" 
                        value={userData.phone} 
                        onChange={(v) => setUserData({ ...userData, phone: v })} 
                        icon={Phone} 
                        placeholder="+237 ..." 
                      />
                      <InputRow label="Auth Node (Email)" value={user?.email} disable />
                      <InputRow label="Platform Role" value={user?.role?.toUpperCase()} disable />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                         <SelectModule 
                            label="Operational Sector (City)"
                            value={userData.onboarding_location.city}
                            onChange={(v) => setUserData({...userData, onboarding_location: {...userData.onboarding_location, city: v, quartier: ''}})}
                            options={zones.filter(z => z.type === 'region').map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select City Node"
                         />
                         <SelectModule 
                            label="Local Quartier (Zone)"
                            value={userData.onboarding_location.quartier}
                            onChange={(v) => setUserData({...userData, onboarding_location: {...userData.onboarding_location, quartier: v}})}
                            options={zones.filter(z => z.type === 'quartier' && z.parent_id?.name === userData.onboarding_location.city).map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select Quartier Signal"
                            disable={!userData.onboarding_location.city}
                         />
                      </div>
                      <InputModule 
                         label="Address Description" 
                         value={userData.onboarding_location.address_description} 
                         onChange={(v) => setUserData({ ...userData, onboarding_location: {...userData.onboarding_location, address_description: v} })} 
                         icon={MapPin} 
                         placeholder="Additional routing metadata (Door #, Landmark)..." 
                         area
                      />
                      
                      <div className="pt-4 flex justify-end">
                        <button
                          onClick={handleUpdateProfile}
                          disabled={profileSaving}
                          className="px-8 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] font-bold tracking-tight  hover:bg-[var(--accent)] hover:text-white transition-all"
                        >
                          {profileSaving ? 'Saving...' : 'Synchronize Records'}
                        </button>
                      </div>
                    </div>
                  </SectionBox>

                  <SectionBox title="Interface Preferences">
                    <div className="flex items-center justify-between py-2">
                       <div className="flex items-center gap-4">
                         <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                           {theme === 'dark' ? <Moon className="size-5" /> : <Sun className="size-5" />}
                         </div>
                         <div>
                           <p className="text-[11px] font-bold tracking-tight">System Appearance</p>
                           <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-60">Toggle between Dark and Light protocol modes.</p>
                         </div>
                       </div>
                       <button 
                         onClick={toggleTheme}
                         className={`w-14 h-8 rounded-full relative transition-all duration-300 ${theme === 'dark' ? 'bg-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]' : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]'}`}
                       >
                         <div className={`absolute top-1 size-6 rounded-full bg-white shadow-xl transition-all duration-300 ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
                       </button>
                    </div>
                  </SectionBox>
                </div>
              )}


              {activeTab === 'orders' && (
                <div className="space-y-12">
                   <header className="space-y-4 flex flex-col md:flex-row md:items-end justify-between">
                     <div>
                       <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] ">Order <span className="text-[var(--accent)]">Matrix</span></h2>
                       <p className="text-[var(--text-secondary)] font-medium max-w-lg mt-2">Historical and active transaction records synchronized with the platform.</p>
                     </div>
                     <button onClick={fetchOrders} className="size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:text-[var(--accent)] transition-all">
                        <RefreshCw className={`size-5 ${ordersLoading ? 'animate-spin' : ''}`} />
                     </button>
                   </header>

                    <div className="space-y-4">
                      {orders.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center glass-panel rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-xl text-center space-y-6">
                            <ShoppingBag className="size-16 opacity-10" />
                            <p className="text-sm font-bold tracking-tight opacity-40">No Order Records Synchronized</p>
                        </div>
                      ) : (
                        <>
                        {orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((o) => (
                           <Link href={`/orders/${o._id}`} key={o._id} className="block p-8 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:border-[var(--accent)]/40 hover:shadow-2xl transition-all group overflow-hidden relative">
                              <div className="absolute top-0 right-0 size-24 bg-[var(--accent)]/5 rounded-full blur-2xl group-hover:bg-[var(--accent)]/10 transition-all" />
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                 <div className="flex items-center gap-6">
                                    <div className="size-16 rounded-[28px] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center relative shadow-inner overflow-hidden">
                                       <img src={o.products?.[0]?.image || '/placeholder.png'} className="size-full object-cover" alt="" />
                                    </div>
                                    <div>
                                       <h4 className="text-lg font-bold tracking-tight group-hover:text-[var(--accent)] transition-colors line-clamp-1">{o.products?.[0]?.name || 'Encrypted Order'}</h4>
                                       <div className="flex items-center gap-3 mt-1.5 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">
                                          <span className="text-[11px] font-bold tracking-tight">{new Date(o.createdAt).toLocaleDateString()}</span>
                                          <div className="size-1 rounded-full bg-[var(--accent)]" />
                                          <span className="text-[11px] font-bold tracking-tight text-[var(--accent)]">{o.order_status}</span>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center justify-between md:justify-end gap-10 border-t md:border-t-0 border-[var(--glass-border)] pt-6 md:pt-0">
                                    <div className="text-right">
                                       <p className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-40 mb-1">Vault Value</p>
                                       <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">{(o.total_amount).toLocaleString()} <span className="text-xs">XAF</span></p>
                                    </div>
                                    <div className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white group-hover:translate-x-1 transition-all">
                                       <ChevronRight className="size-5" />
                                    </div>
                                 </div>
                              </div>
                           </Link>
                        ))}
                        {orders.length > 0 && (
                          <div className="pt-6">
                            <Pagination
                              currentPage={currentPage}
                              totalPages={Math.ceil(orders.length / itemsPerPage)}
                              onPageChange={setCurrentPage}
                            />
                          </div>
                        )}
                        </>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'security' && (

                <div className="space-y-12">
                  <header className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Security Citadel</h2>
                    <p className="text-[var(--text-secondary)] font-medium max-w-lg">Manage encrypted access, key pairing, and biometric links.</p>
                  </header>

                  <SectionBox title="Core Access Control">
                    <ActionButton icon={Lock} label="Rotate Access Key" desc="Change your security passphrase regularly." />
                    <ActionButton icon={RefreshCw} label="Secure Session Clearing" desc="Logout from all other active node devices." />
                  </SectionBox>
                </div>
              )}

              {activeTab === 'store' && user?.role === 'vendor' && (
                <div className="space-y-12">
                  <header className="space-y-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] ">Command <span className="text-[var(--accent)]">Center</span></h2>
                      <p className="text-[var(--text-secondary)] font-medium max-w-lg">Customize your organization&apos;s digital storefront presence.</p>
                    </div>
                    {saveStatus && (
                      <span className="px-6 py-3 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold tracking-tight  border border-[var(--accent)] animate-pulse">
                        {saveStatus}
                      </span>
                    )}
                  </header>

                  <SectionBox title="Storefront Presence">
                    <div className="space-y-8">
                      {/* Sync Notice */}
                      <div className="p-8 rounded-[40px] bg-[var(--accent)]/5 border border-[var(--glass-border)] flex items-center gap-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 size-32 bg-[var(--accent)]/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[var(--accent)]/20 transition-all" />
                        <div className="size-16 rounded-[24px] bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] relative z-10">
                          <Palette className="size-8" />
                        </div>
                        <div className="flex-1 relative z-10">
                          <p className="text-sm font-bold tracking-tight">Unified Platform Branding</p>
                          <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-60 leading-relaxed mt-1 max-w-md">
                            Your storefront visuals (Logo & Banner) are synchronized with your <span className="text-[var(--accent)]">General Profile</span> settings to maintain cross-platform brand integrity.
                          </p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('general')}
                          className="px-6 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] font-bold tracking-tight hover:border-[var(--accent)]/30 hover:scale-[1.02] active:scale-95 transition-all relative z-10"
                        >
                          Modify Assets
                        </button>
                      </div>

                      <div className="space-y-8">
                        <InputModule 
                          label="Store Alias" 
                          value={storeData.store_name} 
                          onChange={(v) => setStoreData({ ...storeData, store_name: v })} 
                          icon={Store} 
                          placeholder="Organization Name" 
                        />
                        <InputModule 
                          label="Store Transmission (Bio)" 
                          value={storeData.description} 
                          onChange={(v) => setStoreData({ ...storeData, description: v })} 
                          icon={Database} 
                          placeholder="Describe your node's purpose and mission..." 
                          area 
                        />
                      </div>
                    </div>
                  </SectionBox>

                  <SectionBox title="Logistics Hub (Pickup)">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <SelectModule 
                            label="Fulfillment Hub (City)" 
                            value={storeData.pickup_address.city} 
                            onChange={(v) => setStoreData({...storeData, pickup_address: {...storeData.pickup_address, city: v, quartier: ''}})} 
                            options={zones.filter(z => z.type === 'city').map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select Node"
                          />
                          <SelectModule 
                             label="Pickup Region (Quartier)"
                             value={storeData.pickup_address.quartier}
                             onChange={(v) => setStoreData({...storeData, pickup_address: {...storeData.pickup_address, quartier: v}})}
                             options={zones.filter(z => z.type === 'quartier' && z.parent_id?.name === storeData.pickup_address.city).map(z => ({ label: z.name, value: z.name }))}
                             icon={MapPin}
                             placeholder="Select Sub-Node"
                             disable={!storeData.pickup_address.city}
                          />
                      </div>
                      <InputModule 
                        label="Handshake Coordinates (Pickup Address)" 
                        value={storeData.pickup_address.address_description} 
                        onChange={(v) => setStoreData({ ...storeData, pickup_address: { ...storeData.pickup_address, address_description: v } })} 
                        icon={MapPin} 
                        placeholder="Specific building info for logistics pickup..." 
                        area 
                      />
                    </div>
                  </SectionBox>

                  <button
                    onClick={handleUpdateStore}
                    disabled={loading}
                    className="w-full py-10 bg-[var(--accent)] text-white font-bold text-[11px] tracking-[0.5em] rounded-[40px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-[var(--accent)]/40  flex items-center justify-center gap-4 disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
                    {loading ? 'Committing Hub Sync...' : 'Finalize Store Profile'}
                  </button>
                </div>
              )}

              {activeTab === 'fleet' && user?.role === 'logistics' && (
                <div className="space-y-12">
                  <header className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Fleet Management</h2>
                    <p className="text-[var(--text-secondary)] font-medium max-w-lg">Configure your operational capacity and dispatch parameters.</p>
                  </header>
                  <SectionBox title="Operational Reach">
                    <ActionButton icon={MapPin} label="Service Regions" desc="Define cities where your fleet is active." />
                    <ActionButton icon={Truck} label="Vehicle Manifest" desc="Specify available vehicle types (Bikes, Vans, Trucks)." />
                   </SectionBox>
                 </div>
               )}
 
               {activeTab === 'kyc' && (
                 <div className="space-y-12">
                   <header className="space-y-4">
                     <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Identity Node</h2>
                     <p className="text-[var(--text-secondary)] font-medium max-w-lg">Verify your identity to unlock advanced vendor features and higher transaction limits.</p>
                   </header>
  
                   <div className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-[40px] p-8 md:p-12 glass-panel shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 size-64 bg-emerald-500/5 rounded-full blur-[100px]" />
                     
                     <div className="flex items-center justify-between mb-10 pb-10 border-b border-[var(--glass-border)]/50">
                       <div className="flex items-center gap-6">
                         <div className={`size-16 rounded-[24px] flex items-center justify-center border shadow-inner ${
                           kycStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                           kycStatus === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                           kycStatus === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                           'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--glass-border)]'
                         }`}>
                           <Shield className="size-8" />
                         </div>
                         <div>
                           <h3 className="text-xl font-bold tracking-tight ">Verification Status</h3>
                           <p className={`text-[11px] font-bold tracking-tight mt-1 ${
                             kycStatus === 'approved' ? 'text-emerald-500' :
                             kycStatus === 'pending' ? 'text-amber-500' :
                             kycStatus === 'rejected' ? 'text-rose-500' : 'text-[var(--text-secondary)]'
                           }`}>
                             {kycStatus ? kycStatus.toUpperCase() : 'NOT SUBMITTED'}
                           </p>
                         </div>
                       </div>
                       
                       {kycStatus === 'approved' && (
                         <div className="px-6 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[11px] font-bold tracking-tight ">
                           Global Node Verified
                         </div>
                       )}
                     </div>
  
                     {kycStatus === 'approved' ? (
                       <div className="py-10 text-center space-y-4">
                         <p className="text-sm font-bold text-[var(--text-secondary)]">Your identity has been fully verified by the Aura Protocol.</p>
                         <p className="text-[11px] font-bold text-[var(--accent)] tracking-tight">Enhanced node privileges activated</p>
                       </div>
                     ) : (
                       <div className="space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <InputModule 
                             label="Full Legal Name" 
                             value={kycData.full_name} 
                             onChange={(v) => setKycData({...kycData, full_name: v})} 
                             icon={User} 
                             placeholder="Ex: John Doe" 
                           />
                           <div className="space-y-4">
                             <div className="flex items-center gap-3 ml-4">
                               <Shield className="size-4 text-[var(--accent)] opacity-40" />
                               <span className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] ">ID Document Type</span>
                             </div>
                             <select 
                               value={kycData.id_type}
                               onChange={(e) => setKycData({...kycData, id_type: e.target.value})}
                               className="w-full bg-[var(--bg-primary)]/30 border border-[var(--glass-border)] rounded-full px-8 py-5 text-sm font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none shadow-inner text-[var(--text-primary)]"
                             >
                               <option value="national_id">National ID Card</option>
                               <option value="passport">Biometric Passport</option>
                               <option value="drivers_license">Driver's License</option>
                             </select>
                           </div>
                         </div>
  
                         <InputModule 
                           label="Document ID Number" 
                           value={kycData.id_number} 
                           onChange={(v) => setKycData({...kycData, id_number: v})} 
                           icon={Lock} 
                           placeholder="Ex: 2024-X99" 
                         />
  
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                   <span className="text-[11px] font-bold tracking-tight  text-[var(--text-secondary)]">ID Front Scan</span>
                                   {brandingUploading === 'kyc_front' && <RefreshCw className="size-4 animate-spin text-[var(--accent)]" />}
                                </div>
                                <div className="h-48 rounded-[32px] bg-[var(--bg-primary)]/30 border-2 border-dashed border-[var(--glass-border)] flex flex-col items-center justify-center p-8 text-center hover:border-[var(--accent)]/50 transition-all group relative overflow-hidden">
                                   {kycData.file_url_front ? (
                                     <>
                                       <img src={kycData.file_url_front} className="absolute inset-0 size-full object-contain p-4" alt="ID front" />
                                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <p className="text-white text-[11px] font-bold tracking-tight">Replace Front</p>
                                       </div>
                                     </>
                                   ) : (
                                     <>
                                       <Camera className="size-10 text-[var(--text-secondary)] opacity-20 mb-4" />
                                       <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60 tracking-tight">Front Page</p>
                                     </>
                                   )}
                                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleBrandingFileUpload('kyc_front', e.target.files?.[0])} />
                                </div>
                             </div>

                             <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                   <span className="text-[11px] font-bold tracking-tight  text-[var(--text-secondary)]">ID Back Scan</span>
                                   {brandingUploading === 'kyc_back' && <RefreshCw className="size-4 animate-spin text-[var(--accent)]" />}
                                </div>
                                <div className="h-48 rounded-[32px] bg-[var(--bg-primary)]/30 border-2 border-dashed border-[var(--glass-border)] flex flex-col items-center justify-center p-8 text-center hover:border-[var(--accent)]/50 transition-all group relative overflow-hidden">
                                   {kycData.file_url_back ? (
                                     <>
                                       <img src={kycData.file_url_back} className="absolute inset-0 size-full object-contain p-4" alt="ID back" />
                                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <p className="text-white text-[11px] font-bold tracking-tight">Replace Back</p>
                                       </div>
                                     </>
                                   ) : (
                                     <>
                                       <Camera className="size-10 text-[var(--text-secondary)] opacity-20 mb-4" />
                                       <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60 tracking-tight">Back Page</p>
                                     </>
                                   )}
                                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleBrandingFileUpload('kyc_back', e.target.files?.[0])} />
                                </div>
                             </div>
                          </div>
   
                          <div className="flex justify-center pt-8">
                             <button
                               onClick={handleKYCSubmit}
                               disabled={kycLoading || kycStatus === 'pending'}
                               className={`min-w-[320px] px-10 py-5 rounded-full font-bold text-[10px] tracking-[0.2em]  transition-all shadow-xl ${
                                 kycStatus === 'pending' ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed' :
                                 'bg-[var(--accent)] text-white shadow-[var(--accent)]/30 hover:scale-105 active:scale-95'
                               }`}
                             >
                               {kycLoading ? 'Commiting Node Data...' : kycStatus === 'pending' ? 'Governance Review In Progress' : 'Initialize Identity Verification'}
                             </button>
                          </div>
                       </div>
                     )}
                   </div>
                 </div>
               )}
  
               {activeTab === 'notifications' && (
                <div className="space-y-12">
                  <header className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Signals & Intel</h2>
                    <p className="text-[var(--text-secondary)] font-medium max-w-lg">Configure how the platform communicates critical updates to your node.</p>
                  </header>
                  <SectionBox title="Notification Channels">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-4">
                        <Mail className="size-5 text-[var(--accent)]" />
                        <span className="text-[11px] font-bold tracking-tight">Email Protocols</span>
                      </div>
                      <Toggle active />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-4">
                        <Bell className="size-5 text-[var(--accent)]" />
                        <span className="text-[11px] font-bold tracking-tight">Push Signals</span>
                      </div>
                      <Toggle active />
                    </div>
                    <Link href="/notifications" className="block p-8 rounded-[40px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-center group transition-all hover:bg-[var(--accent)] hover:text-white mt-10 shadow-xl">
                       <p className="text-[11px] font-bold  tracking-[0.4em]">Initialize Full Frequency Scan</p>
                    </Link>
                  </SectionBox>
                </div>
              )}

              {activeTab === 'network' && (
                 <div className="space-y-12">
                    <header className="space-y-4">
                      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Node <span className="text-[var(--accent)]">Network</span></h2>
                      <p className="text-[var(--text-secondary)] font-medium max-w-lg">Active connections to marketplaces and independent vendor nodes.</p>
                    </header>

                    {networkLoading ? (
                      <div className="flex flex-col items-center py-24 opacity-30 animate-pulse">
                         <RefreshCw className="size-16 animate-spin mb-4" />
                         <p className="text-[11px] font-bold tracking-tight">Resolving Followed Nodes...</p>
                      </div>
                    ) : followedVendors.length === 0 ? (
                       <div className="py-24 flex flex-col items-center justify-center glass-panel rounded-[40px] border border-[var(--glass-border)] text-center space-y-6">
                           <Users className="size-16 opacity-10" />
                           <p className="text-sm font-bold tracking-tight opacity-40">No connected vendor nodes detected</p>
                       </div>
                    ) : (
                       <div className="space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {followedVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(f => (
                             <Link key={f._id} href={`/stores/${f.vendor_id?._id}`} className="group p-8 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:border-[var(--accent)]/40 transition-all flex items-center gap-6 shadow-xl">
                                <div className="size-20 rounded-[28px] overflow-hidden border border-[var(--glass-border)] group-hover:border-[var(--accent)]/50 transition-all shadow-inner shrink-0 bg-[var(--bg-primary)]">
                                   <img src={f.vendor_id?.user_id?.branding?.logo || f.vendor_id?.user_id?.avatar} className="size-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-3">
                                      <h4 className="text-lg font-bold tracking-tight truncate group-hover:text-[var(--accent)] transition-colors">{f.vendor_id?.store_name}</h4>
                                      {f.vendor_id?.verified && <ShieldCheck className="size-4 text-emerald-500 shrink-0" />}
                                   </div>
                                   <p className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-40 mt-1">{(f.vendor_id?.follower_count || 0).toLocaleString()} Subscribers</p>
                                </div>
                             </Link>
                          ))}
                         </div>
                         {followedVendors.length > 0 && (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={Math.ceil(followedVendors.length / itemsPerPage)}
                              onPageChange={setCurrentPage}
                            />
                         )}
                       </div>
                    )}
                 </div>
              )}

              {activeTab === 'audience' && (
                 <div className="space-y-12">
                    <header className="space-y-4">
                      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Node <span className="text-[var(--accent)]">Audience</span></h2>
                      <p className="text-[var(--text-secondary)] font-medium max-w-lg">Independent user nodes synchronized with your marketplace frequency.</p>
                    </header>

                    {audienceLoading ? (
                      <div className="flex flex-col items-center py-24 opacity-30 animate-pulse">
                         <RefreshCw className="size-16 animate-spin mb-4" />
                         <p className="text-[11px] font-bold tracking-tight">Scanning Audience Signal...</p>
                      </div>
                    ) : audience.length === 0 ? (
                       <div className="py-24 flex flex-col items-center justify-center glass-panel rounded-[40px] border border-[var(--glass-border)] text-center space-y-6">
                           <Heart className="size-16 opacity-10" />
                           <p className="text-sm font-bold tracking-tight opacity-40">No active subscribers in this frequency</p>
                       </div>
                    ) : (
                       <div className="space-y-6 pb-32">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {audience.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(a => (
                             <div key={a._id} className="p-8 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-6 shadow-xl">
                                <div className="size-16 rounded-[24px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0">
                                   <img src={a.user_id?.branding?.logo || a.user_id?.avatar} className="size-full object-cover" alt="" />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <h4 className="text-base font-bold tracking-tight truncate">{a.user_id?.name}</h4>
                                   <p className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-40 mt-1">Status: Active Monitor</p>
                                </div>
                                <span className="text-[11px] font-bold tracking-tight opacity-20">{new Date(a.createdAt).toLocaleDateString()}</span>
                             </div>
                          ))}
                       </div>
                       {audience.length > 0 && (
                          <Pagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(audience.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                          />
                       )}
                    </div>
                    )}
                 </div>
              )}

              {activeTab === 'governance' && user?.role === 'admin' && (
                 <div className="space-y-12 pb-32">
                   <header className="space-y-4">
                     <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Protocol Governance</h2>
                     <p className="text-[var(--text-secondary)] font-medium max-w-lg">Advanced administrative controls for platform stability and regulation.</p>
                   </header>
 
                    <SectionBox title="User Governance">
                       <div className="space-y-6">
                          <div className="relative group">
                             <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-[var(--accent)] opacity-40 group-focus-within:opacity-100 transition-opacity" />
                             <input 
                                type="text"
                                placeholder="Search by Node ID or Email..."
                                className="w-full bg-[var(--bg-primary)]/30 border border-[var(--glass-border)] rounded-[32px] pl-16 pr-8 py-6 text-sm font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all shadow-inner text-[var(--text-primary)]"
                                onChange={async (e) => {
                                   const q = e.target.value;
                                   if (q.length < 3) return;
                                   try {
                                      const res = await api.get(`/admin/users?search=${q}`);
                                      if (res.data.success) setGovUsers(res.data.data.users || []);
                                   } catch (_) {}
                                }}
                             />
                          </div>

                          <div className="space-y-4">
                             {(govUsers || []).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(u => (
                                <div key={u._id} className="p-6 rounded-[32px] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-between gap-6">
                                   <div className="flex items-center gap-4">
                                      <div className="size-12 rounded-2xl bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)]">
                                         <img src={u.branding?.logo || u.avatar} alt="" className="size-full object-cover" />
                                      </div>
                                      <div>
                                         <p className="text-[11px] font-bold tracking-tight">{u.name}</p>
                                         <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-60">{u.email} • {u.role}</p>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <button 
                                         onClick={async () => {
                                            const nextStatus = u.verification_status === 'held' ? 'unverified' : 'held';
                                            try { await api.patch(`/admin/users/${u._id}/status`, { status: nextStatus }); setBrandingStatus(`User ${u.name} ${nextStatus}.`); } catch (_) {}
                                         }}
                                         className={`px-4 py-2 rounded-xl text-[11px] font-bold tracking-tight border transition-all ${u.verification_status === 'held' ? 'bg-amber-500 text-white' : 'bg-transparent border-[var(--glass-border)] hover:bg-amber-500/10 text-amber-500'}`}
                                      >
                                         {u.verification_status === 'held' ? 'Release Node' : 'Hold Node'}
                                      </button>
                                      <button 
                                         onClick={async () => {
                                            try { await api.patch(`/admin/users/${u._id}/status`, { status: 'unverified' }); setBrandingStatus(`Verification requested for ${u.name}`); } catch (_) {}
                                         }}
                                         className="px-4 py-2 rounded-xl text-[11px] font-bold tracking-tight bg-[var(--accent)] text-white shadow-lg active:scale-95 transition-all"
                                      >
                                         Request Verify
                                      </button>
                                   </div>
                                </div>
                             ))}
                          </div>
                          {(govUsers || []).length > 0 && (
                             <Pagination
                               currentPage={currentPage}
                               totalPages={Math.ceil((govUsers || []).length / itemsPerPage)}
                               onPageChange={setCurrentPage}
                             />
                          )}
                       </div>
                    </SectionBox>

                   <SectionBox title="Administrative Override">
                     <ActionButton icon={ShieldAlert} label="System Lockdown" desc="Temporarily suspend all non-essential platform services." />
                     <ActionButton icon={User} label="Node Verification" desc="Manually review and approve pending vendor applications." />
                   </SectionBox>
                 </div>
              )}

              {activeTab === 'advanced' && user?.role === 'admin' && (
                <div className="space-y-12">
                  <header className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)]">Root Systems</h2>
                    <p className="text-[var(--text-secondary)] font-medium max-w-lg">Low-level data manipulation and infrastructure parameters.</p>
                  </header>
                  <SectionBox title="Database Sync">
                    <ActionButton icon={Database} label="Flush Cache" desc="Clear all temporary platform optimization data." />
                    <ActionButton icon={BarChart3} label="Audit Logs" desc="View complete interaction history for this node." />
                  </SectionBox>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function SectionBox({ title, children }) {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center gap-6 px-4 md:px-6">
        <h3 className="text-[10px] md:text-[11px] font-bold tracking-[0.4em]  text-[var(--accent)] shadow-sm">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
      </div>
      <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
        <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}

function InputModule({ label, value, onChange, icon: Icon, placeholder, area = false, disable = false }) {
  return (
    <div className="space-y-3 px-1 md:px-2">
      <div className="flex items-center gap-3 ml-2 md:ml-4">
        {Icon && <Icon className="size-4 text-[var(--accent)] opacity-60" />}
        <label className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-[var(--text-secondary)] ">{label}</label>
      </div>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disable}
          rows={4}
          className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-[2rem] px-6 py-5 text-xs md:text-sm font-bold focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 outline-none transition-all resize-none shadow-inner text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disable}
          className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-full px-6 md:px-8 py-4 md:py-5 text-xs md:text-sm font-bold focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 outline-none transition-all shadow-inner text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        />
      )}
    </div>
  );
}

function InputRow({ label, value, disable }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 rounded-[2rem] bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] gap-2 md:gap-0">
      <span className="text-[11px] font-bold tracking-[0.2em]  text-[var(--text-secondary)]">{label}</span>
      <span className={`text-[11px] md:text-xs font-bold tracking-tight ${disable ? 'opacity-60 text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{value}</span>
    </div>
  );
}

function Toggle({ active }) {
  return (
    <div className={`w-14 h-8 rounded-full p-1.5 transition-all duration-500 cursor-pointer ${active ? 'bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/30' : 'bg-[var(--glass-border)]'}`}>
      <div className={`h-full aspect-square rounded-full bg-white transition-all duration-500 transform ${active ? 'translate-x-6' : ''}`} />
    </div>
  );
}

function ActionButton({ icon: Icon, label, desc }) {
  return (
    <button className="relative w-full flex items-center justify-between p-5 md:p-6 rounded-[2rem] bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 text-left overflow-hidden hover:-translate-y-0.5 hover:shadow-xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/0 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
      <div className="flex items-center gap-5 md:gap-6 relative z-10">
        <div className="size-12 md:size-14 rounded-[1.25rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all shadow-sm">
          <Icon className="size-5 md:size-6 text-[var(--accent)] group-hover:text-white transition-all" />
        </div>
        <div>
          <p className="text-[11px] md:text-xs font-bold tracking-[0.2em]  transition-colors">{label}</p>
          <p className="text-[10px] md:text-[11px] font-bold text-[var(--text-secondary)] opacity-60 group-hover:text-white group-hover:opacity-80 transition-colors mt-0.5">{desc}</p>
        </div>
      </div>
      <ChevronRight className="size-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 relative z-10" />
    </button>
  );
}

function SelectModule({ label, value, onChange, options, icon: Icon, placeholder, disable = false }) {
  return (
    <div className="space-y-3 px-2">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="size-4 text-[var(--accent)] opacity-40" />}
        <label className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] ">{label}</label>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disable}
        className="w-full bg-[var(--bg-primary)]/30 border border-[var(--glass-border)] rounded-full px-8 py-5 text-sm font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all shadow-inner text-[var(--text-primary)] appearance-none cursor-pointer disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
           <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
