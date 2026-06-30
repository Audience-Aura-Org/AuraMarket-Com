"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, Bell, Shield, Lock, Power, ChevronRight,
  Store, ShieldAlert, Database, BarChart3,
  Mail, MapPin, Camera, ExternalLink, RefreshCw, Search,
  Truck, LayoutGrid, ShoppingBag, Activity,
  Users, Heart, Phone, Moon, Sun, ShieldCheck, Clock, Star, Globe2,
  Smartphone, Download, Monitor, Apple, Type, Check
} from 'lucide-react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import Pagination from '@/components/common/Pagination';
import SingleOrderView from '@/components/account/SingleOrderView';
import OrdersTab from '@/components/account/OrdersTab';
import dynamic from 'next/dynamic';

const ProductCard = dynamic(() => import('@/components/ProductCard'), { ssr: false });

import { TABS } from './constants';
import AccountHeader from './AccountHeader';
import AccountSidebar from './AccountSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { setFontSize, getFontSize, resetFontSettings, FONT_SIZES } from '@/utils/fontSettings';

const normalizePickupAddress = (pickup = {}, fallback = {}) => ({
  city: pickup.city || fallback.city || '',
  quartier: pickup.quartier || fallback.quartier || '',
  address_description:
    pickup.address_description ||
    pickup.street ||
    fallback.address_description ||
    fallback.street ||
    '',
});

const normalizeKycPayload = (kyc = {}) => ({
  full_name: kyc.full_name || '',
  id_type: kyc.id_type || kyc.document_type || 'national_id',
  id_number: kyc.id_number || kyc.document_number || '',
  file_url_front: kyc.file_url_front || kyc.document_front_url || '',
  file_url_back: kyc.file_url_back || kyc.document_back_url || '',
});

export default function AccountPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, deleteAccount, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { language, languages, setLanguage, t } = useLanguage();
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
  const itemsPerPage = 24;
  
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
    pickup_address: { city: '', quartier: '', address_description: '' },
    delivery_time: '',
    minimum_order_amount: ''
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
  const effectiveKycStatus = kycStatus || user?.kyc?.status || user?.verification_status;
  const isKycApproved = effectiveKycStatus === 'approved' || effectiveKycStatus === 'verified';
  const isKycRejected = effectiveKycStatus === 'rejected' || effectiveKycStatus === 'denied';
  const isKycPending = effectiveKycStatus === 'pending';

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteConfirmationWord = language === 'fr' ? 'SUPPRIMER' : 'DELETE';
  const [currentFontSize, setCurrentFontSize] = useState(FONT_SIZES.md);

  const [followedVendors, setFollowedVendors] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);

  const [audience, setAudience] = useState([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'network') fetchNetwork();
    if (activeTab === 'audience') fetchAudience();
    if (activeTab === 'wishlist') fetchWishlist();
  }, [activeTab]);

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
    // Only vendors with a completed profile have a Vendor document — skip for un-onboarded users
    if (user?.role !== 'vendor' || !user?.onboarded) {
      setAudienceLoading(false);
      return;
    }
    setAudienceLoading(true);
    try {
      const vRes = await api.get('/vendors/me', { skipClientCache: true });
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
      setKycData(d => ({ ...d, ...normalizeKycPayload(user.kyc) }));
    } else if (user.verification_status) {
      setKycStatus(user.verification_status);
    }

    // Only fetch vendor profile when the Vendor document is guaranteed to exist
    if (user.role === 'vendor' && user.onboarded) {
      api.get('/vendors/me', { skipClientCache: true }).then(res => {
        if (res.data.success) {
          const v = res.data.data.vendor;
          const s = v.store || {};
          const pickupAddress = normalizePickupAddress(v.pickup_address, user.onboarding_location);
          setStoreData({
            store_name: v.store_name || '',
            description: v.description || '',
            logo: s.logo || v.logo || user.branding?.logo || '',
            banner: s.banner || v.banner || user.branding?.banner || '',
            pickup_address: pickupAddress,
            delivery_time: s.delivery_time || '',
            minimum_order_amount: s.minimum_order_amount ?? ''
          });
          setProfileBranding((p) => ({
            logo: s.logo || v.logo || p.logo,
            banner: s.banner || v.banner || p.banner,
          }));
        }
      }).catch(() => {});
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

  useEffect(() => {
    setCurrentFontSize(getFontSize());
    const handleFontSizeChange = (event) => setCurrentFontSize(event.detail.size);
    window.addEventListener('fontsizechange', handleFontSizeChange);
    return () => window.removeEventListener('fontsizechange', handleFontSizeChange);
  }, []);

  const fontSizeOptions = [
    { value: FONT_SIZES.sm, label: 'S', helper: 'Small', size: '14px' },
    { value: FONT_SIZES.md, label: 'M', helper: 'Medium', size: '16px', badge: 'Default' },
    { value: FONT_SIZES.lg, label: 'L', helper: 'Large', size: '18px' },
    { value: FONT_SIZES.xl, label: 'XL', helper: 'Extra Large', size: '20px' },
  ];

  const handleFontSizeChange = (size) => {
    setFontSize(size);
    setCurrentFontSize(size);
  };

  const handleFontReset = () => {
    resetFontSettings();
    setCurrentFontSize(FONT_SIZES.md);
  };

  const handleLanguageChange = async (nextLanguage) => {
    const shouldReload = nextLanguage !== language;
    setLanguage(nextLanguage, { reload: shouldReload });
    updateUser({ preferred_language: nextLanguage });
    setBrandingStatus(t('settings.languageSaved'));

    try {
      const res = await api.patch('/users/me', { preferred_language: nextLanguage });
      if (res.data?.success && res.data?.data?.user) {
        updateUser(res.data.data.user);
      }
    } catch (err) {
      console.error(err);
      setBrandingStatus(t('settings.languageFailed'));
    } finally {
      setTimeout(() => setBrandingStatus(''), 2500);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteStatus('');
    const result = await deleteAccount(deleteConfirm);
    if (result.success) {
      router.replace('/login');
      return;
    }
    setDeleteStatus(result.message || 'Account deletion failed.');
    setDeleteLoading(false);
  };

  const handleUpdateStore = async () => {
    setLoading(true);
    try {
      const pickupAddress = normalizePickupAddress(storeData.pickup_address);
      await api.patch('/vendors/profile', {
        store_name: storeData.store_name,
        description: storeData.description,
        pickup_address: pickupAddress
      });
      const storeRes = await api.patch('/vendors/store', {
        delivery_time: storeData.delivery_time,
        minimum_order_amount: storeData.minimum_order_amount,
      });
      const updatedStore = storeRes.data?.data?.store;
      setStoreData((p) => ({
        ...p,
        pickup_address: pickupAddress,
        delivery_time: updatedStore?.delivery_time || '',
        minimum_order_amount: updatedStore?.minimum_order_amount ?? '',
      }));
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
      const nextBranding = { ...profileBranding, ...overrides };
      const logo = nextBranding.logo || storeData.logo || '';
      const banner = nextBranding.banner || storeData.banner || '';

      const brandingPayload = canUseBanner ? { logo, banner } : { logo };
      
      const res = await api.patch('/users/me', { branding: brandingPayload });

      if (user?.role === 'vendor') {
        await api.patch('/vendors/store', { logo, banner });
        setStoreData((p) => ({ ...p, logo, banner }));
      }
      if (user?.role === 'logistics') {
        await api.patch('/logistics/profile', { logo, banner });
      }

      if (res.data?.success && res.data?.data?.user) updateUser(res.data.data.user);
      setProfileBranding({ logo, banner });
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
        const nextKyc = res.data.data.kyc;
        const nextUser = { ...res.data.data.user, kyc: nextKyc };
        updateUser(nextUser);
        setKycStatus(nextKyc?.status || nextUser.verification_status || 'pending');
        if (nextKyc) setKycData((current) => ({ ...current, ...normalizeKycPayload(nextKyc) }));
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
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)] pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <AccountHeader title={t('settings.title')} />

      <div className="w-full px-1.5 sm:px-2 lg:px-3 py-2 grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-3">
        <AccountSidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {activeTab === 'general' && (
                <div className="space-y-3">
                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 shadow-xl w-full">
                    <div className="flex flex-col md:flex-row items-center md:items-center gap-3 md:gap-4">
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

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-1 md:px-2">
                      <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">{t('settings.identity')}</h3>
                      <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                    </div>

                    <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 space-y-3 shadow-xl">
                      <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                      
                      <div className="relative z-10 space-y-3 md:space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <FormField
                            label={t('settings.fullName')}
                            value={userData.name}
                            onChange={(v) => setUserData({ ...userData, name: v })}
                            icon={User}
                            placeholder="Your name"
                          />
                          <FormField
                            label={t('settings.phoneNumber')}
                            value={userData.phone}
                            onChange={(v) => setUserData({ ...userData, phone: v })}
                            icon={Phone}
                            placeholder="+237..."
                          />
                        </div>

                        <FormField
                          label={t('settings.email')}
                          value={user?.email}
                          disabled={true}
                          icon={Mail}
                        />

                        <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-4 md:p-5">
                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                                <Type className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Typography</p>
                                <p className="text-[11px] font-semibold leading-snug text-[var(--text-secondary)] opacity-70">Font size applies across the app. Default font is Poppins.</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleFontReset}
                              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
                            >
                              <RefreshCw className="size-3.5" />
                              Reset
                            </button>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">Font Size</p>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                              {fontSizeOptions.map((option) => {
                                const selected = currentFontSize === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleFontSizeChange(option.value)}
                                    className={`relative flex min-h-[58px] flex-col items-center justify-center rounded-2xl border px-3 py-2 text-center transition ${
                                      selected
                                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10'
                                        : 'border-[var(--glass-border)] bg-[var(--bg-primary)]/60 text-[var(--text-secondary)] hover:border-[var(--accent)]/35 hover:text-[var(--accent)]'
                                    }`}
                                    aria-pressed={selected}
                                  >
                                    {option.badge && selected && (
                                      <span className="absolute -top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
                                        {option.badge}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1 text-[15px] font-black leading-none">
                                      {selected && <Check className="size-3" />}
                                      {option.label}
                                    </span>
                                    <span className="mt-1 text-[9px] font-bold leading-none opacity-70">{option.helper}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="grid grid-cols-4 px-1 text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">
                              {fontSizeOptions.map((option) => (
                                <span key={option.value} className="text-center">{option.size}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-4 md:p-5">
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                              <Globe2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">{t('settings.language')}</p>
                              <p className="text-[11px] font-semibold leading-snug text-[var(--text-secondary)] opacity-70">{t('settings.languageHelp')}</p>
                            </div>
                          </div>
                          <select
                            value={language}
                            onChange={(event) => handleLanguageChange(event.target.value)}
                            className="h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 !text-base font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 md:text-sm"
                          >
                            {languages.map((item) => (
                              <option key={item.code} value={item.code}>
                                {item.nativeLabel}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ── Delivery / Home Address — customer & logistics only ── */}
                        {(user?.role === 'customer' || user?.role === 'logistics') && (
                          <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-4 md:p-5 space-y-4">
                            <div className="flex items-center gap-3 mb-1">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                                <MapPin className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                                  {user?.role === 'logistics' ? 'Home / Base Address' : 'Delivery Address'}
                                </p>
                                <p className="text-[11px] font-semibold leading-snug text-[var(--text-secondary)] opacity-70">
                                  {user?.role === 'logistics'
                                    ? 'Your base location used for wallet payments and zone matching.'
                                    : 'Your default delivery location for wallet-based checkout.'}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormSelect
                                label="City"
                                value={userData.onboarding_location.city}
                                onChange={(v) =>
                                  setUserData({
                                    ...userData,
                                    onboarding_location: {
                                      ...userData.onboarding_location,
                                      city: v,
                                      quartier: '',
                                    },
                                  })
                                }
                                options={zones
                                  .filter((z) => z.type === 'region')
                                  .map((z) => ({ label: z.name, value: z.name }))}
                                icon={MapPin}
                                placeholder="Select city"
                              />
                              <FormSelect
                                label="Quartier"
                                value={userData.onboarding_location.quartier}
                                onChange={(v) =>
                                  setUserData({
                                    ...userData,
                                    onboarding_location: {
                                      ...userData.onboarding_location,
                                      quartier: v,
                                    },
                                  })
                                }
                                options={zones
                                  .filter(
                                    (z) =>
                                      z.type === 'quartier' &&
                                      z.parent_id?.name === userData.onboarding_location.city,
                                  )
                                  .map((z) => ({ label: z.name, value: z.name }))}
                                icon={MapPin}
                                placeholder="Select quartier"
                                disabled={!userData.onboarding_location.city}
                              />
                            </div>

                            <FormField
                              label="Street / Landmark"
                              value={userData.onboarding_location.address_description}
                              onChange={(v) =>
                                setUserData({
                                  ...userData,
                                  onboarding_location: {
                                    ...userData.onboarding_location,
                                    address_description: v,
                                  },
                                })
                              }
                              icon={MapPin}
                              placeholder="Building, gate, landmark, or street name…"
                              textarea={true}
                            />
                          </div>
                        )}

                        <button
                          onClick={handleUpdateProfile}
                          disabled={profileSaving}
                          className="relative w-full flex items-center justify-center p-3 md:p-4 rounded-2xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/0 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                          <span className="relative z-10 text-[11px] lg:text-[12px] md:text-xs  font-semibold tracking-tight transition-colors">
                            {profileSaving ? t('settings.saving') : t('settings.saveIdentity')}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="min-w-0">
                  {viewingOrderId ? (
                    <div className="animate-in fade-in duration-300">
                      <SingleOrderView orderId={viewingOrderId} onBack={handleBackToLedger} />
                    </div>
                  ) : (
                    <OrdersTab user={user} onViewOrder={handleViewOrder} />
                  )}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Security Matrix</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 space-y-3 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-4">
                      {false && (
                      <div className="hidden">
                        <div className="flex items-center gap-4 border-b border-[var(--glass-border)] pb-4">
                          <div className="size-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20">
                            <Lock className="size-5 text-[var(--accent)]" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">Change Passphrase</p>
                            <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60">Legacy password controls are disabled.</p>
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
                      )}

                      <div className="w-full flex items-center justify-between p-5 md:p-6 bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-[2rem] transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20">
                            <ShieldCheck className="size-5 text-[var(--accent)]" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">Passwordless Session</p>
                            <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60">Your account uses email OTP verification. New devices verify again; this device stays trusted.</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'close-account' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] font-semibold tracking-tighter text-rose-500 shadow-sm">Close Account</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-rose-500/20 to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-rose-500/20 bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 space-y-3 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-rose-500/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="relative z-10">
                      <DeleteAccountPanel
                        deleteConfirm={deleteConfirm}
                        setDeleteConfirm={setDeleteConfirm}
                        deleteStatus={deleteStatus}
                        deleteLoading={deleteLoading}
                        confirmationWord={deleteConfirmationWord}
                        onDelete={handleDeleteAccount}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'store' && user?.role === 'vendor' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Storefront Architecture</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 space-y-3 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-3 md:space-y-4">
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
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <FormField
                          label="Estimated Delivery Time"
                          value={storeData.delivery_time}
                          onChange={(v) => setStoreData({ ...storeData, delivery_time: v })}
                          icon={Clock}
                          placeholder="1-3 days, Same day, Within 24 hours..."
                        />
                        <FormField
                          label="Minimum Order Amount (XAF)"
                          type="number"
                          value={storeData.minimum_order_amount}
                          onChange={(v) => setStoreData({ ...storeData, minimum_order_amount: v })}
                          icon={ShoppingBag}
                          placeholder="Leave blank for no minimum"
                        />
                      </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <BrandingUploadCard
                          title="Store Logo"
                          description="Shown on products, chats, vendor cards, and your storefront profile."
                          image={profileBranding.logo || storeData.logo}
                          field="logo"
                          uploading={brandingUploading === 'logo'}
                          onUpload={handleBrandingFileUpload}
                        />
                        <BrandingUploadCard
                          title="Store Banner"
                          description="Shown as the wide storefront header and marketplace cover image."
                          image={profileBranding.banner || storeData.banner}
                          field="banner"
                          uploading={brandingUploading === 'banner'}
                          onUpload={handleBrandingFileUpload}
                          wide
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <MapPin className="size-4 text-[var(--accent)]" />
                          <h4 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">Store Pickup Address Configuration</h4>
                        </div>
                        
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
                          label="Store Pickup Address Description"
                          value={storeData.pickup_address.address_description}
                          onChange={(v) => setStoreData({ ...storeData, pickup_address: { ...storeData.pickup_address, address_description: v } })}
                          icon={MapPin}
                          placeholder="Describe the exact store pickup point, landmark, building, floor, or gate..."
                          textarea={true}
                        />
                      </div>

                      <button
                        onClick={handleUpdateStore}
                        disabled={loading}
                        className="relative w-full flex items-center justify-center p-3 md:p-4 rounded-2xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4"
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
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Identity Validation</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 space-y-3 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10">
                      {isKycApproved ? (
                        <div className="flex flex-col items-center justify-center text-center p-12 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem]">
                          <div className="size-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
                            <ShieldCheck className="size-10 text-emerald-500" />
                          </div>
                          <h4 className="text-xl font-bold tracking-tight text-emerald-500 mb-2">Verification successful</h4>
                          <p className="text-sm text-emerald-500/70 font-medium max-w-xs">Your identity has been verified successfully. The verified icon can now display on your account and store surfaces.</p>
                        </div>
                      ) : isKycRejected ? (
                        <div className="space-y-8">
                          <div className="flex items-center gap-5 p-6 bg-rose-500/5 border border-rose-500/20 rounded-[2rem]">
                            <div className="size-12 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                              <ShieldAlert className="size-6 text-rose-500" />
                            </div>
                            <div>
                              <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-rose-500">Verification denied</p>
                              <p className="text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60 mt-1">Your submitted document was denied. Update the details below and submit again for review.</p>
                            </div>
                          </div>

                          <FormField
                            label="Legal Full Name"
                            value={kycData.full_name}
                            onChange={(v) => setKycData({...kycData, full_name: v})}
                            icon={User}
                            placeholder="Your full name"
                          />

                          <div>
                            <label className="block text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] mb-2 px-1">Credential Type</label>
                            <select
                              value={kycData.id_type}
                              onChange={(e) => setKycData({...kycData, id_type: e.target.value})}
                              className="w-full bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] rounded-[1.5rem] px-5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all text-[var(--text-primary)]"
                            >
                              <option value="national_id">National Identification</option>
                              <option value="passport">Passport</option>
                              <option value="drivers_license">Driver License</option>
                              <option value="utility_bill">Utility Bill</option>
                            </select>
                          </div>

                          <FormField
                            label="Document Number"
                            value={kycData.id_number}
                            onChange={(v) => setKycData({...kycData, id_number: v})}
                            icon={Database}
                            placeholder="ID number"
                          />

                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <KycUploadCard title="Front Document" image={kycData.file_url_front} field="kyc_front" uploading={brandingUploading === 'kyc_front'} onUpload={handleBrandingFileUpload} />
                            <KycUploadCard title="Back Document" image={kycData.file_url_back} field="kyc_back" uploading={brandingUploading === 'kyc_back'} onUpload={handleBrandingFileUpload} />
                          </div>

                          <button
                            onClick={handleKYCSubmit}
                            disabled={kycLoading}
                            className="relative w-full flex items-center justify-center p-3 md:p-4 rounded-2xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/0 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <div className="relative z-10 flex items-center gap-3">
                              {kycLoading && <RefreshCw className="size-4 animate-spin" />}
                              <span className="text-[11px] lg:text-[12px] md:text-xs font-semibold tracking-tight transition-colors">
                                {kycLoading ? 'Submitting credentials...' : 'Resubmit verification'}
                              </span>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {isKycPending && (
                            <div className="flex items-center gap-5 p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem]">
                              <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                                <Clock className="size-6 text-amber-500 animate-pulse" />
                              </div>
                              <div>
                                <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-amber-500">Verification pending</p>
                                <p className="text-sm text-amber-500/60 font-medium">Your documents are under review. We will update this page once a decision is made.</p>
                              </div>
                            </div>
                          )}

                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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

                          <div className="space-y-3">
                            <div className="flex items-center gap-4">
                              <Camera className="size-4 text-[var(--accent)]" />
                              <h4 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)]">Biometric Scans</h4>
                            </div>
                            
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
                            disabled={kycLoading || isKycPending}
                            className="relative w-full flex items-center justify-center p-3 md:p-4 rounded-2xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:bg-[var(--accent)] hover:text-white group transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4"
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
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Followed Vendors</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 shadow-xl">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                          {followedVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(vendor => (
                            <Link 
                              key={vendor._id} 
                              href={`/stores?id=${encodeURIComponent(vendor.vendor_id?._id || '')}`} 
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
                                    <Star className="size-2.5 fill-current" />
                                    {Number(vendor.vendor_id?.rating || 0) > 0 && Number(vendor.vendor_id.rating).toFixed(1)}
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
                          <div className="mt-4 flex justify-center">
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
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Store Audience</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 shadow-xl">
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
                          <div className="mt-4 flex justify-center">
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

              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Signal Parameters</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 space-y-3 shadow-xl">
                    <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-4">
                      <NotificationToggle label="App Notifications" icon={Bell} active={true} />
                      <NotificationToggle label="External Multi-cast (Email)" icon={Mail} active={true} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'install' && <InstallAppTab />}

              {activeTab === 'wishlist' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 md:px-2">
                    <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tighter text-[var(--accent)] shadow-sm">Saved Items</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
                  </div>

                  <div className="overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)] md:rounded-[3rem]">
                    <div className="px-4 md:px-8 lg:px-12 py-6">
                      {wishlistLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <RefreshCw className="size-8 text-[var(--accent)] animate-spin" />
                        </div>
                      ) : wishlist.length === 0 ? (
                        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-12 text-center shadow-inner">
                          <Heart className="mx-auto mb-4 size-12 text-[var(--accent)] opacity-40" />
                          <p className="text-[11px] font-semibold tracking-tight text-[var(--text-secondary)] lg:text-[12px]">Your wishlist is empty</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {wishlist.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((product) => (
                              <ProductCard key={product._id} product={product} layout="grid" />
                            ))}
                          </div>
                          {wishlist.length > itemsPerPage && (
                            <div className="mt-4 flex justify-center">
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

function DeleteAccountPanel({ deleteConfirm, setDeleteConfirm, deleteStatus, deleteLoading, confirmationWord, onDelete }) {
  const isConfirmed = deleteConfirm.trim().toUpperCase() === confirmationWord;

  return (
    <div className="w-full p-5 md:p-6 bg-rose-500/5 border border-rose-500/20 rounded-[2rem] transition-all space-y-5">
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
          <ShieldAlert className="size-5 text-rose-500" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold tracking-tight text-rose-500">Close Account</p>
          <p className="text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-70">
            Deletes your profile, tokens, carts, messages, listings, follows, notifications, and account-linked records. This cannot be undone.
          </p>
        </div>
      </div>

      <input
        value={deleteConfirm}
        onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
        placeholder={`Type ${confirmationWord} to confirm`}
        className="w-full bg-[var(--bg-primary)]/70 border border-rose-500/20 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-500/30"
      />

      {deleteStatus && (
        <div className="text-[11px] font-semibold text-center px-4 py-2 rounded-lg bg-rose-500/10 text-rose-500">
          {deleteStatus}
        </div>
      )}

      <button
        onClick={onDelete}
        disabled={deleteLoading || !isConfirmed}
        className="w-full py-3 md:py-4 rounded-full font-bold text-xs tracking-tight bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
      >
        {deleteLoading ? (
          <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        ) : 'Close account permanently'}
      </button>
    </div>
  );
}

function BrandingUploadCard({ title, description, image, field, uploading, onUpload, wide = false }) {
  return (
    <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-5 space-y-4">
      <div className={`${wide ? 'aspect-[2.4/1]' : 'aspect-square max-w-44'} w-full rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-primary)]/70 overflow-hidden flex items-center justify-center shadow-inner`}>
        {image ? (
          <img src={image} className="size-full object-cover" alt="" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--text-secondary)] opacity-35">
            <Camera className="size-8" />
            <span className="text-[11px] font-bold tracking-tight">No {field}</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">{title}</p>
        <p className="text-[11px] font-semibold leading-relaxed text-[var(--text-secondary)] opacity-60">{description}</p>
      </div>
      <label className="block">
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(field, e.target.files?.[0])} />
        <div className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[11px] font-bold tracking-tight text-[var(--text-primary)] transition-all hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
          {uploading ? <RefreshCw className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          {uploading ? 'Uploading...' : `Upload ${title}`}
        </div>
      </label>
    </div>
  );
}

function KycUploadCard({ title, image, field, uploading, onUpload }) {
  return (
    <label className="group relative aspect-video rounded-[2rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 overflow-hidden cursor-pointer flex items-center justify-center hover:border-[var(--accent)]/50 transition-all shadow-inner">
      {image ? (
        <img src={image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
      ) : (
        <div className="text-center p-6">
          {uploading ? <RefreshCw className="size-8 mx-auto mb-3 text-[var(--accent)] animate-spin" /> : <Camera className="size-8 mx-auto mb-3 text-[var(--accent)] opacity-40" />}
          <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)]">{uploading ? 'Uploading...' : title}</p>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(field, e.target.files?.[0])} />
    </label>
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

function InstallAppTab() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [activePlatform, setActivePlatform] = useState('android'); // 'android' | 'ios' | 'desktop'

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsReady(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsReady(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsReady(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1 md:px-2">
        <h3 className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] font-semibold tracking-tighter text-[var(--accent)] shadow-sm">
          App Installation Portal
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--glass-border)] to-transparent" />
      </div>

      <div className="relative overflow-hidden glass-panel rounded-2xl md:rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl p-3 md:p-4 shadow-xl">
        <div className="absolute -top-32 -right-32 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-2/5 flex flex-col items-center justify-center p-6 bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-[2.5rem] text-center">
            <div className="size-20 rounded-3xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mb-4 text-[var(--accent)]">
              <Smartphone className="size-10" />
            </div>
            <h4 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Auradime Mobile</h4>
            <p className="text-xs text-[var(--text-secondary)] opacity-70 mt-2 max-w-xs">
              Install the official app for the fastest shopping, instant notifications, and smooth animations.
            </p>
            <div className="mt-6 w-full space-y-3">
              <a
                href="/downloads/Auradime.apk"
                download
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[var(--accent)] text-white font-bold text-xs tracking-wide shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Download className="size-4" />
                Download Android APK
              </a>
              {isReady && (
                <button
                  onClick={handleInstallClick}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] text-[var(--text-primary)] font-bold text-xs tracking-wide hover:bg-[var(--bg-primary)] active:scale-[0.98] transition-all"
                >
                  <Smartphone className="size-4" />
                  Install Web App (PWA)
                </button>
              )}
            </div>
          </div>

          <div className="w-full md:w-3/5 space-y-6">
            <div>
              <h5 className="text-sm font-bold tracking-tight text-[var(--text-primary)] mb-4">Installation Guide</h5>
              <div className="flex gap-2 p-1 bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-2xl">
                {['android', 'ios', 'desktop'].map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setActivePlatform(plat)}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all capitalize ${
                      activePlatform === plat
                        ? 'bg-[var(--accent)] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {activePlatform === 'android' && (
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Tap the <strong className="text-[var(--text-primary)]">Download Android APK</strong> button to download the install file.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Open the downloaded <code className="bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">Auradime.apk</code> file from your notifications or files app.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      If prompted, enable installation from <strong className="text-[var(--text-primary)]">Unknown Sources</strong> in your settings.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Alternatively, click the <strong className="text-[var(--text-primary)]">Install Web App</strong> button if you prefer a lighter, browser-based app.
                    </p>
                  </div>
                </div>
              )}

              {activePlatform === 'ios' && (
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Make sure you are using <strong className="text-[var(--text-primary)]">Safari browser</strong> to install.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Tap the <strong className="text-[var(--text-primary)]">Share</strong> button at the bottom navigation bar of Safari.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Scroll down and tap <strong className="text-[var(--text-primary)]">Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Tap <strong className="text-[var(--text-primary)]">Add</strong> in the top-right corner to launch Aura from your home screen.
                    </p>
                  </div>
                </div>
              )}

              {activePlatform === 'desktop' && (
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Using Chrome or Edge on desktop, look at the right side of the address bar.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Click the <strong className="text-[var(--text-primary)]">Install</strong> icon (looks like a monitor with an arrow, or a plus sign).
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-6 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Confirm by clicking <strong className="text-[var(--text-primary)]">Install</strong> in the browser prompt.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
