"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, Bell, Shield, Lock, Power, ChevronRight,
  Store, ShieldAlert, Palette, Database, BarChart3,
  Mail, MapPin, Camera, ExternalLink, RefreshCw, Search,
  Truck, LayoutGrid, ShoppingBag,
  Users, Heart, Phone, Moon, Sun, ShieldCheck, X
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
  { id: 'general', label: 'Profile', icon: User, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, roles: ['customer', 'vendor'] },
  { id: 'security', label: 'Security', icon: Shield, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'network', label: 'Network', icon: Users, roles: ['customer', 'vendor'] },
  { id: 'audience', label: 'Audience', icon: Heart, roles: ['vendor'] },
  { id: 'store', label: 'Store', icon: Store, roles: ['vendor'] },
  { id: 'fleet', label: 'Fleet', icon: Truck, roles: ['logistics'] },
  { id: 'governance', label: 'Governance', icon: ShieldAlert, roles: ['admin'] },
  { id: 'kyc', label: 'Verification', icon: Shield, roles: ['customer', 'vendor'] },
  { id: 'notifications', label: 'Alerts', icon: Bell, roles: ['customer', 'vendor', 'admin', 'logistics'] },
  { id: 'advanced', label: 'Advanced', icon: Database, roles: ['admin'] },
];

export default function AccountPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    setSaveStatus('Saving store...');
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

  const handleUpdateBranding = async () => {
    setBrandingStatus('Updating branding...');
    try {
      const brandingPayload = canUseBanner
        ? { logo: profileBranding.logo, banner: profileBranding.banner }
        : { logo: profileBranding.logo };
      
      const res = await api.patch('/users/me', {
        branding: brandingPayload
      });

      if (user?.role === 'vendor') {
        await api.patch('/vendors/store', { 
          logo: profileBranding.logo, 
          banner: profileBranding.banner 
        });
      }

      if (res.data?.success && res.data?.data?.user) updateUser(res.data.data.user);
      setBrandingStatus('Branding updated successfully.');
      setTimeout(() => setBrandingStatus(''), 2500);
    } catch (err) {
      console.error('Branding update failed', err);
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
        if (field === 'kyc_front') {
          setKycData((p) => ({ ...p, file_url_front: res.data.url }));
          setBrandingStatus(`ID front uploaded.`);
        } else if (field === 'kyc_back') {
          setKycData((p) => ({ ...p, file_url_back: res.data.url }));
          setBrandingStatus(`ID back uploaded.`);
        } else {
          setProfileBranding((p) => ({ ...p, [field]: res.data.url }));
          setBrandingStatus(`${field} uploaded. Save to apply.`);
        }
      } else {
        setBrandingStatus('Upload failed.');
      }
      setTimeout(() => setBrandingStatus(''), 2500);
    } catch (err) {
      console.error('Upload failed', err);
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
      console.error('KYC submission failed', err);
      setBrandingStatus('Submission failed.');
    } finally {
      setKycLoading(false);
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const filteredTabs = TABS.filter((t) => t.roles.includes(user?.role || 'customer'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-2xl bg-[var(--bg-primary)]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">Account Settings</h1>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors">
            <Power className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* Profile Card */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
                  {profileBranding.logo ? (
                    <img src={profileBranding.logo} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-6 h-6 text-[var(--accent)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.name}</p>
                  <p className="text-xs text-white/50 capitalize truncate">{user?.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleTheme} className="flex-1 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              {filteredTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                      isActive
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'hover:bg-white/5 text-white/70 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{tab.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
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
                  <div>
                    <h2 className="text-2xl font-bold">Profile Settings</h2>
                    <p className="text-white/50 text-sm mt-1">Manage your account information and preferences</p>
                  </div>

                  {/* Avatar Section */}
                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">Profile Picture</h3>
                        <p className="text-sm text-white/50 mt-1">Upload your profile image</p>
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-6">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-white/10 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
                          {profileBranding.logo ? (
                            <img src={profileBranding.logo} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <User className="w-10 h-10 text-white/20" />
                          )}
                        </div>
                        <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                          <Camera className="w-4 h-4 text-white" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBrandingFileUpload('logo', e.target.files?.[0])} />
                        </label>
                      </div>
                      <div>
                        <p className="text-xs text-white/50">JPG, PNG up to 5MB</p>
                      </div>
                    </div>

                    <button
                      onClick={handleUpdateBranding}
                      className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm hover:bg-[var(--accent)]/90 transition-colors"
                    >
                      {brandingUploading ? 'Uploading...' : 'Update Picture'}
                    </button>
                  </div>

                  {/* Personal Info */}
                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 space-y-6">
                    <h3 className="font-semibold">Personal Information</h3>

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
                      className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50"
                    >
                      {profileSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Order History</h2>
                    <p className="text-white/50 text-sm mt-1">View and track your orders</p>
                  </div>

                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-12 text-center">
                      <ShoppingBag className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/50">No orders yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order) => (
                        <Link key={order._id} href={`/orders/${order._id}`}>
                          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 hover:border-[var(--accent)]/30 transition-all">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold line-clamp-1">{order.products?.[0]?.name || 'Order'}</p>
                                <p className="text-xs text-white/50 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{(order.total_amount).toLocaleString()} XAF</p>
                                <p className="text-xs text-emerald-400 capitalize mt-1">{order.order_status}</p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {orders.length > itemsPerPage && (
                        <Pagination
                          currentPage={currentPage}
                          totalPages={Math.ceil(orders.length / itemsPerPage)}
                          onPageChange={setCurrentPage}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Security</h2>
                    <p className="text-white/50 text-sm mt-1">Manage your account security settings</p>
                  </div>

                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 space-y-4">
                    <button className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-[var(--accent)]" />
                        <div className="text-left">
                          <p className="font-medium">Change Password</p>
                          <p className="text-xs text-white/50">Update your security passphrase</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-[var(--accent)]" />
                        <div className="text-left">
                          <p className="font-medium">Active Sessions</p>
                          <p className="text-xs text-white/50">Manage your logged in devices</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'store' && user?.role === 'vendor' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Store Settings</h2>
                    <p className="text-white/50 text-sm mt-1">Manage your storefront information</p>
                  </div>

                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 space-y-6">
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

                    <div>
                      <h4 className="font-semibold mb-4">Pickup Location</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormSelect
                          label="City"
                          value={storeData.pickup_address.city}
                          onChange={(v) => setStoreData({...storeData, pickup_address: {...storeData.pickup_address, city: v, quartier: ''}})}
                          options={zones.filter(z => z.type === 'city').map(z => ({ label: z.name, value: z.name }))}
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
                        label="Pickup Address"
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
                      className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {loading ? 'Saving...' : 'Save Store Settings'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Identity Verification</h2>
                    <p className="text-white/50 text-sm mt-1">Verify your identity to unlock advanced features</p>
                  </div>

                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 space-y-6">
                    {kycStatus === 'approved' ? (
                      <div className="flex items-center gap-4 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-emerald-500">Verified</p>
                          <p className="text-sm text-emerald-500/70">Your identity has been verified</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {kycStatus === 'pending' && (
                          <div className="flex items-center gap-4 p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <Clock className="w-6 h-6 text-amber-500 shrink-0" />
                            <div>
                              <p className="font-semibold text-amber-500">Pending</p>
                              <p className="text-sm text-amber-500/70">Your verification is being reviewed</p>
                            </div>
                          </div>
                        )}

                        <FormField
                          label="Full Name"
                          value={kycData.full_name}
                          onChange={(v) => setKycData({...kycData, full_name: v})}
                          icon={User}
                          placeholder="Your full name"
                        />

                        <div>
                          <label className="block text-sm font-medium mb-2">ID Type</label>
                          <select
                            value={kycData.id_type}
                            onChange={(e) => setKycData({...kycData, id_type: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[var(--accent)]/50"
                          >
                            <option value="national_id">National ID</option>
                            <option value="passport">Passport</option>
                            <option value="drivers_license">Driver's License</option>
                          </select>
                        </div>

                        <FormField
                          label="ID Number"
                          value={kycData.id_number}
                          onChange={(v) => setKycData({...kycData, id_number: v})}
                          icon={Lock}
                          placeholder="Your ID number"
                        />

                        <div>
                          <h4 className="font-semibold mb-4">ID Scans</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm text-white/50 mb-2">Front of ID</p>
                              <label className="block w-full aspect-[4/3] border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition-colors overflow-hidden">
                                {kycData.file_url_front ? (
                                  <img src={kycData.file_url_front} className="w-full h-full object-contain p-2" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Camera className="w-6 h-6 text-white/20" />
                                  </div>
                                )}
                                <input type="file" className="hidden" onChange={(e) => handleBrandingFileUpload('kyc_front', e.target.files?.[0])} />
                              </label>
                            </div>
                            <div>
                              <p className="text-sm text-white/50 mb-2">Back of ID</p>
                              <label className="block w-full aspect-[4/3] border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition-colors overflow-hidden">
                                {kycData.file_url_back ? (
                                  <img src={kycData.file_url_back} className="w-full h-full object-contain p-2" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Camera className="w-6 h-6 text-white/20" />
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
                          className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium text-sm hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50"
                        >
                          {kycLoading ? 'Submitting...' : 'Submit for Verification'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'network' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Followed Vendors</h2>
                    <p className="text-white/50 text-sm mt-1">Vendors you're following</p>
                  </div>

                  {networkLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : followedVendors.length === 0 ? (
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-12 text-center">
                      <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/50">No followed vendors</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {followedVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(vendor => (
                        <Link key={vendor._id} href={`/stores/${vendor.vendor_id?._id}`}>
                          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 hover:border-[var(--accent)]/30 transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
                                <img src={vendor.vendor_id?.user_id?.branding?.logo || vendor.vendor_id?.user_id?.avatar} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate group-hover:text-[var(--accent)] transition-colors">{vendor.vendor_id?.store_name}</p>
                                <p className="text-xs text-white/50">{vendor.vendor_id?.follower_count || 0} followers</p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'audience' && user?.role === 'vendor' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Your Followers</h2>
                    <p className="text-white/50 text-sm mt-1">Users following your store</p>
                  </div>

                  {audienceLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : audience.length === 0 ? (
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-12 text-center">
                      <Heart className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/50">No followers yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {audience.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(follower => (
                        <div key={follower._id} className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
                              <img src={follower.user_id?.branding?.logo || follower.user_id?.avatar} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{follower.user_id?.name}</p>
                              <p className="text-xs text-white/50">{new Date(follower.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Notifications</h2>
                    <p className="text-white/50 text-sm mt-1">Manage your notification preferences</p>
                  </div>

                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 space-y-4">
                    <NotificationToggle label="Email Notifications" icon={Mail} active={true} />
                    <NotificationToggle label="Push Notifications" icon={Bell} active={true} />
                  </div>
                </div>
              )}

              {/* Add other tabs as needed - they can follow the same pattern */}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, icon: Icon, placeholder, disabled = false, textarea = false }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[var(--accent)]/50 resize-none disabled:opacity-50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-50"
        />
      )}
    </div>
  );
}

function FormSelect({ label, value, onChange, options, icon: Icon, placeholder, disabled = false }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-50"
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
    <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[var(--accent)]" />
        <p className="font-medium text-sm">{label}</p>
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors ${active ? 'bg-[var(--accent)]' : 'bg-white/10'}`}>
        <div className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${active ? 'ml-6' : 'ml-0.5'}`} />
      </div>
    </div>
  );
}
