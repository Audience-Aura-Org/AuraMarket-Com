"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, Bell, Shield, Lock, Power, ChevronRight,
  Store, ShieldAlert, Database, BarChart3,
  Mail, MapPin, Camera, ExternalLink, RefreshCw, Search,
  Truck, LayoutGrid, ShoppingBag, Activity,
  Users, Heart, Phone, Moon, Sun, ShieldCheck, Clock, Star
} from 'lucide-react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import Pagination from '@/components/common/Pagination';
import StatusManager from '@/components/status/StatusManager';
import SingleOrderView from '@/components/account/SingleOrderView';
import dynamic from 'next/dynamic';

const ProductCard = dynamic(() => import('@/components/ProductCard'), { ssr: false });

import { TABS } from './constants';
import AccountHeader from './AccountHeader';
import AccountSidebar from './AccountSidebar';

export default function AccountPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [viewingOrderId, setViewingOrderId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canUseBanner = ['vendor', 'logistics'].includes(user?.role);

  useEffect(() => {
    const tabUrl = searchParams.get('tab');
    const orderId = searchParams.get('orderId');
    if (tabUrl && TABS.some((t) => t.id === tabUrl)) setActiveTab(tabUrl);
    if (orderId) setViewingOrderId(orderId);
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setViewingOrderId(null);
    router.push(`/profile?tab=${tab}`, { scroll: false });
  };

  const handleViewOrder = (id) => {
    setViewingOrderId(id);
    router.push(`/profile?tab=orders&orderId=${id}`, { scroll: false });
  };

  const handleBackToLedger = () => {
    setViewingOrderId(null);
    router.push(`/profile?tab=orders`, { scroll: false });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [profileBranding, setProfileBranding] = useState({ logo: '', banner: '' });
  const [brandingStatus, setBrandingStatus] = useState('');
  const [brandingUploading, setBrandingUploading] = useState(null);

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

  const [passphraseData, setPassphraseData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passphraseStatus, setPassphraseStatus] = useState('');
  const [passphraseLoading, setPassphraseLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderView, setOrderView] = useState(user?.role === 'vendor' ? 'sales' : 'purchases');

  const [followedVendors, setFollowedVendors] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);

  const [audience, setAudience] = useState([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
     if (!user) return;
     setOrdersLoading(true);
     try {
       const endpoint = orderView === 'sales' ? '/orders/vendor-orders' : '/orders/my-orders';
       const res = await api.get(endpoint);
       if (res.data.success) {
          const sortedOrders = (res.data.data.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOrders(sortedOrders);
       }
     } catch (err) {
       console.error("Orders fetch failed", err);
     } finally {
       setOrdersLoading(false);
     }
  }, [user, orderView]);

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'network') fetchNetwork();
    if (activeTab === 'audience') fetchAudience();
    if (activeTab === 'wishlist') fetchWishlist();
  }, [activeTab, fetchOrders]);

  const fetchWishlist = async () => {
    setWishlistLoading(true);
    try {
      const res = await api.get('/wishlist');
      if (res.data.success) setWishlist(res.data.data.wishlist?.products || []);
    } catch (err) { console.error(err); }
    finally { setWishlistLoading(false); }
  };

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
    setBrandingStatus('Updating profile...');
    try {
      const res = await api.patch('/users/me', userData);
      if (res.data?.success && res.data?.data?.user) {
        updateUser(res.data.data.user);
        setBrandingStatus('Profile updated successfully.');
      }
    } catch (err) {
      console.error(err);
      setBrandingStatus('Update failed.');
    } finally {
      setProfileSaving(false);
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const handleChangePassphrase = async () => {
    if (passphraseData.newPassword !== passphraseData.confirmPassword) {
      setPassphraseStatus('New passwords do not match.');
      return;
    }
    if (passphraseData.newPassword.length < 6) {
      setPassphraseStatus('Password must be at least 6 characters.');
      return;
    }
    setPassphraseLoading(true);
    setPassphraseStatus('Updating passphrase...');
    try {
      const res = await api.patch('/auth/change-password', {
        currentPassword: passphraseData.currentPassword,
        newPassword: passphraseData.newPassword
      });
      if (res.data?.success) {
        setPassphraseStatus('Passphrase updated successfully.');
        setPassphraseData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setPassphraseStatus(err.response?.data?.error || 'Failed to update passphrase.');
    } finally {
      setPassphraseLoading(false);
      setTimeout(() => setPassphraseStatus(''), 3000);
    }
  };

  const handleUpdateStore = async () => {
    setLoading(true);
    try {
      await api.patch('/vendors/profile', {
        store_name: storeData.store_name,
        description: storeData.description,
        pickup_address: storeData.pickup_address
      });
      setSaveStatus('Store updated successfully.');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error("Update failed", err);
      setSaveStatus('Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranding = async (overrides = {}) => {
    setBrandingStatus('Updating branding...');
    try {
      const logo = overrides.logo || profileBranding.logo;
      const banner = overrides.banner || profileBranding.banner;

      const brandingPayload = canUseBanner ? { logo, banner } : { logo };
      
      const res = await api.patch('/users/me', { branding: brandingPayload });

      if (user?.role === 'vendor') {
        await api.patch('/vendors/store', { logo, banner });
      }
      if (user?.role === 'logistics') {
        await api.patch('/logistics/profile', { logo, banner });
      }

      if (res.data?.success && res.data?.data?.user) updateUser(res.data.data.user);
      setBrandingStatus('Branding updated successfully.');
      setTimeout(() => setBrandingStatus(''), 2500);
    } catch (err) {
      setBrandingStatus('Update failed.');
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const handleBrandingFileUpload = async (field, file) => {
    if (!file) return;
    setBrandingUploading(field);
    setBrandingStatus(`Uploading ${field.replace('_', ' ')}...`);
    try {
      let uploadType = 'general';
      if (field === 'logo') uploadType = 'avatars';
      if (field === 'banner') uploadType = 'banners';
      if (field.startsWith('kyc')) uploadType = 'kyc';

      const res = await uploadService.uploadSingle(file, uploadType);
      if (res?.success && res?.data?.url) {
        const url = res.data.url;
        if (field.startsWith('kyc')) {
          setKycData((p) => ({ ...p, [field === 'kyc_front' ? 'file_url_front' : 'file_url_back']: url }));
          setBrandingStatus(`${field.replace('_', ' ')} uploaded.`);
        } else {
          setProfileBranding((p) => ({ ...p, [field]: url }));
          await handleUpdateBranding({ [field]: url });
        }
      } else {
        setBrandingStatus('Upload failed.');
      }
      setTimeout(() => setBrandingStatus(''), 2500);
    } catch (err) {
      setBrandingStatus('Upload failed.');
      setTimeout(() => setBrandingStatus(''), 2500);
    } finally {
      setBrandingUploading(null);
    }
  };

  const handleKYCSubmit = async () => {
    setKycLoading(true);
    setBrandingStatus('Submitting KYC...');
    try {
      const res = await api.post('/users/kyc', kycData);
      if (res.data?.success) {
        updateUser(res.data.data.user);
        setKycStatus(res.data.data.user.kyc.status);
        setBrandingStatus('KYC submitted successfully.');
      } else {
        setBrandingStatus('Submission failed.');
      }
    } catch (err) {
      setBrandingStatus('Submission failed.');
    } finally {
      setKycLoading(false);
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]">
      <AccountHeader title="Account Settings" />

      <div className="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <AccountSidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-8 shadow-xl w-full">
                    <div className="flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-8">
                      <div className="relative group shrink-0">
                        <div className="size-28 md:size-32 rounded-full border-4 border-[var(--bg-secondary)] bg-[var(--bg-secondary)] overflow-hidden shadow-xl relative z-10 flex items-center justify-center text-4xl  font-bold text-[var(--accent)]">
                          {profileBranding.logo ? (
                            <img src={profileBranding.logo} className="size-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          ) : (
                            user?.name?.[0]?.toUpperCase()
                          )}
                        </div>
                        <label className="absolute bottom-0 right-0 size-10 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border-4 border-[var(--bg-primary)] flex items-center justify-center hover:scale-110 hover:text-[var(--accent)] transition-all shadow-xl cursor-pointer z-20">
                          <Camera className="size-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandingFileUpload('logo', e.target.files?.[0])} />
                        </label>
                      </div>

                      <div className="flex-1 text-center md:text-left space-y-1">
                        <h3 className="text-2xl md:text-3xl  font-bold  text-[var(--text-primary)] tracking-tight">
                          {user?.role === 'vendor' ? (storeData.store_name || user?.name) : user?.name || 'Aura User'}
                        </h3>
                        <p className="text-[var(--text-secondary)] font-medium flex items-center justify-center md:justify-start gap-2 text-sm">
                          <Mail className="size-4 opacity-40 shrink-0" /> {user?.email}
                        </p>
                        <div className="pt-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold tracking-tight  border border-[var(--accent)]/20 shadow-sm">
                            {user?.role || 'User'} Profile
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 md:space-y-8">
                    <div className="flex items-center gap-6 px-4 md:px-6">
                      <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Identity Parameters</h3>
                      <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                    </div>

                    <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
                      <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                      
                      <div className="relative z-10 space-y-6 md:space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            label="Full Name"
                            value={userData.name}
                            onChange={(v) => setUserData({ ...userData, name: v })}
                            icon={User}
                            placeholder="Your name"
                          />
                          <FormField
                            label="Phone Number"
                            value={userData.phone}
                            onChange={(v) => setUserData({ ...userData, phone: v })}
                            icon={Phone}
                            placeholder="+237..."
                          />
                        </div>

                        <FormField
                          label="Email"
                          value={user?.email}
                          disabled={true}
                          icon={Mail}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormSelect
                            label="City"
                            value={userData.onboarding_location.city}
                            onChange={(v) => setUserData({...userData, onboarding_location: {...userData.onboarding_location, city: v, quartier: ''}})}
                            options={zones.filter(z => z.type === 'region').map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select city"
                          />
                          <FormSelect
                            label="Quartier"
                            value={userData.onboarding_location.quartier}
                            onChange={(v) => setUserData({...userData, onboarding_location: {...userData.onboarding_location, quartier: v}})}
                            options={zones.filter(z => z.type === 'quartier' && z.parent_id?.name === userData.onboarding_location.city).map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select quartier"
                            disabled={!userData.onboarding_location.city}
                          />
                        </div>

                        <FormField
                          label="Address Description"
                          value={userData.onboarding_location.address_description}
                          onChange={(v) => setUserData({ ...userData, onboarding_location: {...userData.onboarding_location, address_description: v} })}
                          icon={MapPin}
                          placeholder="Additional address details..."
                          textarea={true}
                        />

                        <button
                          onClick={handleUpdateProfile}
                          disabled={profileSaving}
                          className="relative w-full flex items-center justify-center p-5 md:p-6 rounded-[2rem] bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/0 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                          <span className="relative z-10 text-[11px] lg:text-[12px] md:text-xs  font-semibold tracking-tight transition-colors">
                            {profileSaving ? 'Synchronizing state...' : 'Save identity configuration'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Order Manifest</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative z-10">
                    {viewingOrderId ? (
                      <div className="animate-in fade-in duration-700">
                        <SingleOrderView orderId={viewingOrderId} onBack={handleBackToLedger} />
                      </div>
                    ) : (
                      <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
                        <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                        
                        <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                          {user?.role === 'vendor' && (
                            <div className="flex p-1 bg-[var(--bg-secondary)]/50 rounded-2xl border border-[var(--glass-border)] mr-4">
                              <button
                                onClick={() => setOrderView('purchases')}
                                className={`px-4 py-1.5 rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all ${orderView === 'purchases' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-60 hover:opacity-100'}`}
                              >
                                Purchases
                              </button>
                              <button
                                onClick={() => setOrderView('sales')}
                                className={`px-4 py-1.5 rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all ${orderView === 'sales' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-60 hover:opacity-100'}`}
                              >
                                Sales
                              </button>
                            </div>
                          )}
                          
                          {['all', 'placed', 'processing', 'shipped', 'completed', 'cancelled'].map(f => (
                            <button 
                              key={f}
                              onClick={() => {}}
                              className="px-4 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[10px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all capitalize"
                            >
                              {f === 'all' ? 'Universal' : f}
                            </button>
                          ))}
                        </div>

                        {ordersLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="size-10 border-2 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin" />
                            
                          </div>
                        ) : orders.length === 0 ? (
                          <div className="py-20 flex flex-col items-center justify-center text-center glass-panel rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                            <ShoppingBag className="w-12 h-12 text-[var(--accent)] opacity-40 mx-auto mb-4" />
                            <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)]">No manifest records found</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order) => {
                              const firstItem = order.products?.[0] || order.items?.[0];
                              const imageUrl = firstItem?.image || firstItem?.product?.image || (Array.isArray(firstItem?.product?.images) ? firstItem.product.images[0] : firstItem?.product?.images) || '/logo-white-main.png';
                              const title = firstItem?.name || firstItem?.product?.name || `Order #${order._id.substring(0, 8)}`;
                              
                              const getStatusColor = (s) => {
                                switch(s) {
                                  case 'completed': return 'emerald';
                                  case 'shipped': return 'blue';
                                  case 'cancelled': return 'rose';
                                  default: return 'amber';
                                }
                              };
                              const sColor = getStatusColor(order.order_status);

                              return (
                                <button 
                                  key={order._id} 
                                  onClick={() => handleViewOrder(order._id)}
                                  className="block w-full text-left group"
                                >
                                  <div className="relative overflow-hidden bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-2xl p-5 hover:bg-[var(--bg-secondary)]/50 hover:border-[var(--accent)]/30 transition-all duration-300">
                                    <div className={`absolute left-0 top-0 w-1 h-full bg-${sColor}-500 opacity-20 group-hover:opacity-100 transition-opacity`} />
                                    
                                    <div className="flex items-center gap-5">
                                      <div className="size-14 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden shrink-0 shadow-sm">
                                        <img src={imageUrl} alt="" className="size-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] lg:text-[12px]  font-semibold tracking-tight bg-${sColor}-500/10 text-${sColor}-500 border border-${sColor}-500/20 capitalize`}>
                                            {order.shipment && ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(order.shipment.status) 
                                              ? order.shipment.status.replace('_', ' ') 
                                              : order.order_status || 'pending'}
                                          </span>
                                          <span className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40">#{order._id.slice(-8).toUpperCase()}</span>
                                        </div>
                                        <h4 className="text-[11px] lg:text-[12px]  font-semibold truncate group-hover:text-[var(--accent)] transition-colors">{title}</h4>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)]">{(order.total_amount || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-40">XAF</span></div>
                                        <div className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40">{new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            <div className="pt-4">
                              <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(orders.length / itemsPerPage)}
                                onPageChange={setCurrentPage}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Security Matrix</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-4">
                      <div className="w-full p-5 md:p-6 bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-[2rem] transition-all group space-y-6">
                        <div className="flex items-center gap-4 border-b border-[var(--glass-border)] pb-4">
                          <div className="size-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20">
                            <Lock className="size-5 text-[var(--accent)]" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">Change Passphrase</p>
                            <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60">Update your account authentication layer</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <FormField
                            label="Current Passphrase"
                            type="password"
                            value={passphraseData.currentPassword}
                            onChange={(v) => setPassphraseData({ ...passphraseData, currentPassword: v })}
                            icon={Lock}
                            placeholder="••••••••"
                          />
                          <FormField
                            label="New Passphrase"
                            type="password"
                            value={passphraseData.newPassword}
                            onChange={(v) => setPassphraseData({ ...passphraseData, newPassword: v })}
                            icon={Lock}
                            placeholder="••••••••"
                          />
                          <FormField
                            label="Confirm New Passphrase"
                            type="password"
                            value={passphraseData.confirmPassword}
                            onChange={(v) => setPassphraseData({ ...passphraseData, confirmPassword: v })}
                            icon={Lock}
                            placeholder="••••••••"
                          />
                        </div>

                        {passphraseStatus && (
                          <div className="text-[11px] lg:text-[12px]  font-semibold text-center mt-2 px-4 py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                            {passphraseStatus}
                          </div>
                        )}

                        <button 
                          onClick={handleChangePassphrase}
                          disabled={passphraseLoading || !passphraseData.currentPassword || !passphraseData.newPassword}
                          className="w-full py-3 md:py-4 rounded-full  font-bold text-xs tracking-tight bg-[var(--accent)] text-white hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20"
                        >
                          {passphraseLoading ? (
                            <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                          ) : 'Update passphrase'}
                        </button>
                      </div>

                      <button className="w-full flex items-center justify-between p-5 md:p-6 bg-[var(--bg-secondary)]/30 hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 border border-[var(--glass-border)] rounded-[2rem] transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20">
                            <RefreshCw className="size-5 text-[var(--accent)]" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">Active Device Sessions</p>
                            <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60">Monitor and revoke concurrent access points</p>
                          </div>
                        </div>
                        <ChevronRight className="size-5 text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'store' && user?.role === 'vendor' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Storefront Architecture</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-6 md:space-y-8">
                      <FormField
                        label="Store Name"
                        value={storeData.store_name}
                        onChange={(v) => setStoreData({ ...storeData, store_name: v })}
                        icon={Store}
                        placeholder="Your store name"
                      />

                      <FormField
                        label="Store Description"
                        value={storeData.description}
                        onChange={(v) => setStoreData({ ...storeData, description: v })}
                        icon={Database}
                        placeholder="Describe your store..."
                        textarea={true}
                      />

                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <MapPin className="size-4 text-[var(--accent)]" />
                          <h4 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">Pickup Address Configuration</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormSelect
                            label="City"
                            value={storeData.pickup_address.city}
                            onChange={(v) => setStoreData({...storeData, pickup_address: {...storeData.pickup_address, city: v, quartier: ''}})}
                            options={zones.filter(z => z.type === 'region').map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select city"
                          />
                          <FormSelect
                            label="Quartier"
                            value={storeData.pickup_address.quartier}
                            onChange={(v) => setStoreData({...storeData, pickup_address: {...storeData.pickup_address, quartier: v}})}
                            options={zones.filter(z => z.type === 'quartier' && z.parent_id?.name === storeData.pickup_address.city).map(z => ({ label: z.name, value: z.name }))}
                            icon={MapPin}
                            placeholder="Select quartier"
                            disabled={!storeData.pickup_address.city}
                          />
                        </div>

                        <FormField
                          label="Pickup Address Description"
                          value={storeData.pickup_address.address_description}
                          onChange={(v) => setStoreData({ ...storeData, pickup_address: { ...storeData.pickup_address, address_description: v } })}
                          icon={MapPin}
                          placeholder="Specific address details..."
                          textarea={true}
                        />
                      </div>

                      <button
                        onClick={handleUpdateStore}
                        disabled={loading}
                        className="relative w-full flex items-center justify-center p-5 md:p-6 rounded-[2rem] bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/0 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                        <div className="relative z-10 flex items-center gap-3">
                          {loading && <RefreshCw className="size-4 animate-spin" />}
                          <span className="text-[11px] lg:text-[12px] md:text-xs  font-semibold tracking-tight transition-colors">
                            {loading ? 'Updating storefront...' : 'Commit store configuration'}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Identity Validation</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10">
                      {kycStatus === 'approved' ? (
                        <div className="flex flex-col items-center justify-center text-center p-12 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem]">
                          <div className="size-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
                            <ShieldCheck className="size-10 text-emerald-500" />
                          </div>
                          <h4 className="text-xl  font-bold tracking-tight text-emerald-500 mb-2">Verified Identity</h4>
                          <p className="text-sm text-emerald-500/60 font-medium max-w-xs">Your identity matrix has been fully synchronized and validated.</p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {kycStatus === 'pending' && (
                            <div className="flex items-center gap-5 p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem]">
                              <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                                <Clock className="size-6 text-amber-500 animate-pulse" />
                              </div>
                              <div>
                                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-amber-500">Validation in Progress</p>
                                <p className="text-sm text-amber-500/60 font-medium">Our node controllers are reviewing your credentials.</p>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              label="Legal Full Name"
                              value={kycData.full_name}
                              onChange={(v) => setKycData({...kycData, full_name: v})}
                              icon={User}
                              placeholder="Your full name"
                            />

                            <div>
                              <label className="block text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)] mb-2 px-1">Credential Type</label>
                              <select
                                value={kycData.id_type}
                                onChange={(e) => setKycData({...kycData, id_type: e.target.value})}
                                className="w-full bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] rounded-[1.5rem] px-5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all text-[var(--text-primary)]"
                              >
                                <option value="national_id">National Identification</option>
                                <option value="passport">Global Passport</option>
                                <option value="drivers_license">Driver Authorization</option>
                              </select>
                            </div>
                          </div>

                          <FormField
                            label="Document Serial Number"
                            value={kycData.id_number}
                            onChange={(v) => setKycData({...kycData, id_number: v})}
                            icon={Lock}
                            placeholder="Your ID number"
                          />

                          <div className="space-y-6">
                            <div className="flex items-center gap-4">
                              <Camera className="size-4 text-[var(--accent)]" />
                              <h4 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">Biometric Scans</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)] opacity-50 px-1">Primary Face (Front)</p>
                                <label className="relative group block w-full aspect-video border-2 border-dashed border-[var(--glass-border)] rounded-[2rem] cursor-pointer hover:border-[var(--accent)]/50 transition-all overflow-hidden bg-[var(--bg-secondary)]/30">
                                  {kycData.file_url_front ? (
                                    <img src={kycData.file_url_front} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                                  ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                      <Camera className="size-8 text-[var(--glass-border)] group-hover:scale-110 group-hover:text-[var(--accent)] transition-all" />
                                      <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--glass-border)] tracking-normal">Initialize Scan</span>
                                    </div>
                                  )}
                                  <input type="file" className="hidden" onChange={(e) => handleBrandingFileUpload('kyc_front', e.target.files?.[0])} />
                                </label>
                              </div>
                              
                              <div className="space-y-3">
                                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)] opacity-50 px-1">Secondary Face (Back)</p>
                                <label className="relative group block w-full aspect-video border-2 border-dashed border-[var(--glass-border)] rounded-[2rem] cursor-pointer hover:border-[var(--accent)]/50 transition-all overflow-hidden bg-[var(--bg-secondary)]/30">
                                  {kycData.file_url_back ? (
                                    <img src={kycData.file_url_back} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                                  ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                      <Camera className="size-8 text-[var(--glass-border)] group-hover:scale-110 group-hover:text-[var(--accent)] transition-all" />
                                      <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--glass-border)] tracking-normal">Initialize Scan</span>
                                    </div>
                                  )}
                                  <input type="file" className="hidden" onChange={(e) => handleBrandingFileUpload('kyc_back', e.target.files?.[0])} />
                                </label>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={handleKYCSubmit}
                            disabled={kycLoading || kycStatus === 'pending'}
                            className="relative w-full flex items-center justify-center p-5 md:p-6 rounded-[2rem] bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/0 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <div className="relative z-10 flex items-center gap-3">
                              {kycLoading && <RefreshCw className="size-4 animate-spin" />}
                              <span className="text-[11px] lg:text-[12px] md:text-xs  font-semibold tracking-tight transition-colors">
                                {kycLoading ? 'Encrypting credentials...' : 'Submit for validation'}
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'network' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Followed Vendors</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10">
                      {networkLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <RefreshCw className="size-8 text-[var(--accent)] animate-spin" />
                        </div>
                      ) : followedVendors.length === 0 ? (
                        <div className="bg-gradient-to-br from-[var(--bg-secondary)]/10 to-transparent border border-[var(--glass-border)] rounded-[2rem] p-12 text-center shadow-inner">
                          <Users className="size-12 text-[var(--accent)] opacity-40 mx-auto mb-4" />
                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">No Followed Vendors</p>
                        </div>
                      ) : (
                        <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                          {followedVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(vendor => (
                            <Link 
                              key={vendor._id} 
                              href={`/stores/${vendor.vendor_id?._id || ''}`} 
                              className="group relative rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--accent)]/10 hover:-translate-y-2 glass-panel"
                            >
                              <div className="absolute top-0 left-0 w-full h-24 overflow-hidden">
                                <img 
                                  src={vendor.vendor_id?.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000'} 
                                  className="w-full h-full object-cover brightness-[0.4] group-hover:scale-110 transition-transform duration-1000"
                                  alt=""
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] to-transparent opacity-90"></div>
                              </div>

                              <div className="relative pt-12 px-6 pb-6 flex flex-col items-center text-center">
                                <div className="size-20 rounded-2xl overflow-hidden border-4 border-[var(--bg-primary)] shadow-xl relative z-10 bg-[var(--bg-secondary)] group-hover:scale-105 transition-transform">
                                  <img 
                                    src={vendor.vendor_id?.user_id?.branding?.logo || vendor.vendor_id?.user_id?.avatar || '/logo-white-main.png'} 
                                    alt={vendor.vendor_id?.store_name}
                                    className="size-full object-cover"
                                  />
                                </div>

                                <div className="mt-4 space-y-2 relative z-10 w-full">
                                  <div className="flex items-center justify-center gap-2">
                                    <h3 className="text-sm  font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight line-clamp-1 ">
                                      {vendor.vendor_id?.store_name}
                                    </h3>
                                    <ShieldCheck className="size-3.5 text-blue-500" />
                                  </div>
                                  
                                  <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold tracking-tight w-fit mx-auto ">
                                    <Star className="size-2.5 fill-current" /> {vendor.vendor_id?.rating || '4.9'}
                                  </div>

                                  <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60  tracking-tighter">
                                    {vendor.vendor_id?.follower_count || 0} Followers
                                  </p>
                                </div>

                                <div className="mt-6 pt-4 border-t border-[var(--glass-border)] w-full flex items-center justify-between">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)]/40 tracking-tight">Status</span>
                                    <span className="text-[11px] lg:text-[12px]  font-semibold text-emerald-500 flex items-center gap-1 ">
                                      <div className="size-1 rounded-full bg-emerald-500 animate-pulse"></div> Active
                                    </span>
                                  </div>
                                  
                                  <div className="size-8 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)] group-hover:text-white flex items-center justify-center transition-all duration-500 shadow-sm">
                                    <ChevronRight className="size-4" />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                        {followedVendors.length > itemsPerPage && (
                          <div className="mt-8 flex justify-center">
                            <Pagination
                              currentPage={currentPage}
                              totalPages={Math.ceil(followedVendors.length / itemsPerPage)}
                              onPageChange={setCurrentPage}
                            />
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'audience' && user?.role === 'vendor' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Store Audience</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10">
                      {audienceLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <RefreshCw className="size-8 text-[var(--accent)] animate-spin" />
                        </div>
                      ) : audience.length === 0 ? (
                        <div className="bg-gradient-to-br from-[var(--bg-secondary)]/10 to-transparent border border-[var(--glass-border)] rounded-[2rem] p-12 text-center shadow-inner">
                          <Users className="size-12 text-[var(--accent)] opacity-40 mx-auto mb-4" />
                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">No Followers Yet</p>
                        </div>
                      ) : (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {audience.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(follower => (
                            <div key={follower._id} className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-[2rem] p-5 hover:bg-[var(--accent)]/5 transition-all duration-300">
                              <div className="flex items-center gap-4">
                                <div className="size-14 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0">
                                  <img src={follower.user_id?.branding?.logo || follower.user_id?.avatar || '/logo-white-main.png'} className="size-full object-cover" alt="" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs  font-bold tracking-tight truncate text-[var(--text-primary)]">{follower.user_id?.name}</p>
                                  <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60  tracking-tighter">Synchronized {new Date(follower.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {audience.length > itemsPerPage && (
                          <div className="mt-8 flex justify-center">
                            <Pagination
                              currentPage={currentPage}
                              totalPages={Math.ceil(audience.length / itemsPerPage)}
                              onPageChange={setCurrentPage}
                            />
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'statuses' && (user?.role === 'vendor' || user?.role === 'admin') && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Story Management</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>
                  <StatusManager />
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Signal Parameters</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 space-y-6 md:space-y-8 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-4">
                      <NotificationToggle label="App Notifications" icon={Bell} active={true} />
                      <NotificationToggle label="External Multi-cast (Email)" icon={Mail} active={true} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'wishlist' && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-6 px-4 md:px-6">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Saved Items</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-6 md:p-10 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10">
                      {wishlistLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <RefreshCw className="size-8 text-[var(--accent)] animate-spin" />
                        </div>
                      ) : wishlist.length === 0 ? (
                        <div className="bg-gradient-to-br from-[var(--bg-secondary)]/10 to-transparent border border-[var(--glass-border)] rounded-[2rem] p-12 text-center shadow-inner">
                          <Heart className="size-12 text-[var(--accent)] opacity-40 mx-auto mb-4" />
                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">Your wishlist is empty</p>
                        </div>
                      ) : (
                        <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                          {wishlist.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(product => (
                            <ProductCard key={product._id} product={product} />
                          ))}
                        </div>
                        {wishlist.length > itemsPerPage && (
                          <div className="mt-8 flex justify-center">
                            <Pagination
                              currentPage={currentPage}
                              totalPages={Math.ceil(wishlist.length / itemsPerPage)}
                              onPageChange={setCurrentPage}
                            />
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, icon: Icon, placeholder, disabled = false, textarea = false, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">{label}</label>
      {textarea ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={4}
          className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-[1.5rem] px-4 py-2 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]/50 resize-none disabled:opacity-50"
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-[1.5rem] px-4 py-2 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-50"
        />
      )}
    </div>
  );
}

function FormSelect({ label, value, onChange, options, icon: Icon, placeholder, disabled = false }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-[1.5rem] px-4 py-2 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-50 appearance-none"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function NotificationToggle({ label, icon: Icon, active }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)] rounded-[1.5rem] transition-colors border border-[var(--glass-border)]">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[var(--accent)]" />
        <p className="font-medium text-sm text-[var(--text-primary)]">{label}</p>
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors relative ${active ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-[var(--text-primary)] transition-transform ${active ? 'left-[26px]' : 'left-0.5'}`} />
      </div>
    </div>
  );
}
