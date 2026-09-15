'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import {
  Package, Send, ArrowDownToLine, ChevronRight, MapPin,
  Clock, Wallet, CreditCard, Loader2, CheckCircle2,
  Pencil, Phone, Mail, User as UserIcon, X,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const PACKAGE_CATEGORIES = [
  { value: 'document', label: 'Document' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'food', label: 'Food' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
];

const WEIGHT_TIERS = [
  { value: 'light', label: 'Light (< 5 kg)' },
  { value: 'medium', label: 'Medium (5–15 kg)' },
  { value: 'heavy', label: 'Heavy (15–30 kg)' },
  { value: 'extra_heavy', label: 'Extra Heavy (30+ kg)' },
];

const INPUT_CLASS = 'delivery-input w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 px-3.5 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] placeholder:font-normal outline-none transition-all focus:border-[var(--accent)]/50 min-h-[44px]';
const LABEL_CLASS = 'delivery-label block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5 ml-0.5';

export default function DeliveryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLanguage();


  const [direction, setDirection] = useState('send');
  const [step, setStep] = useState(1); // 1=form, 2=quote, 3=confirm
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [zones, setZones] = useState([]);
  const [success, setSuccess] = useState(null);

  // Form state
  const [form, setForm] = useState({
    pickup_name: '', pickup_phone: '', pickup_email: '',
    pickup_street: '', pickup_city: '', pickup_district: '', pickup_quartier: '', pickup_zone_id: '',
    dropoff_name: '', dropoff_phone: '', dropoff_email: '',
    dropoff_street: '', dropoff_city: '', dropoff_district: '', dropoff_quartier: '', dropoff_zone_id: '',
    category: 'other', weight_tier: 'light', declared_value: '',
    description: '', prohibited_confirmed: false,
    scheduled: false, scheduled_date: '',
    other_user_id: null,
    payment_method: user ? 'wallet' : 'gateway',
  });

  // Lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [editingMyBox, setEditingMyBox] = useState(false);

  // Fetch saved addresses for signed-in user
  const [userAddresses, setUserAddresses] = useState([]);

  useEffect(() => {
    api.get('/logistics/zones').then(res => {
      if (res.data?.success) setZones(res.data.data.zones || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/addresses').then(res => {
      if (res.data?.success) {
        const addrs = res.data.data?.addresses || res.data.data || [];
        setUserAddresses(addrs);
      }
    }).catch(() => {});
  }, [user]);

  const quartiers = zones.filter(z => z.type === 'quartier');
  const cities = zones.filter(z => z.type === 'city' || z.type === 'region');

  // Cascading zone helpers — given a city name, return districts; given a district name, return quartiers
  const getDistrictOpts = (cityName) => {
    const cityZone = cities.find(z => z.name === cityName);
    return cityZone ? zones.filter(z => (z.type === 'district' || z.type === 'quartier') && String(z.parent_id?._id ?? z.parent_id) === String(cityZone._id)) : [];
  };
  const getQuartierOpts = (districtName, cityName) => {
    const distOpts = getDistrictOpts(cityName);
    const distZone = distOpts.find(z => z.name === districtName);
    return distZone ? zones.filter(z => z.type === 'quartier' && String(z.parent_id?._id ?? z.parent_id) === String(distZone._id)) : [];
  };

  // Autofill signed-in user's data to the correct side based on direction
  useEffect(() => {
    if (!user || !zones.length) return;
    // Prefer fetched addresses, fall back to addresses on user object
    const allAddrs = userAddresses.length ? userAddresses : (user.addresses || []);
    const defaultAddr = allAddrs.find(a => a.isDefault) || allAddrs[0] || null;
    const loc = user.onboarding_location || {};
    const myPrefix  = direction === 'send' ? 'pickup' : 'dropoff';
    const otherPrefix = direction === 'send' ? 'dropoff' : 'pickup';

    // Resolve city, district, quartier and zone_id from saved address or onboarding_location
    const cityName = defaultAddr?.city || loc.city || '';
    const districtName = defaultAddr?.region || loc.zone || '';
    let quartierName = defaultAddr?.quartier || loc.quartier || '';
    let zoneId = defaultAddr?.zone_id || '';

    // If no zone_id, try to resolve it by matching quartier name against loaded zones
    if (!zoneId && quartierName && quartiers.length) {
      const match = quartiers.find(z => z.name.toLowerCase() === quartierName.toLowerCase());
      if (match) {
        zoneId = match._id;
        quartierName = match.name;
      }
    }

    setForm(prev => ({
      ...prev,
      // Populate user's side with their profile + address
      [`${myPrefix}_name`]: user.name || '',
      [`${myPrefix}_phone`]: defaultAddr?.contact_phone || user.phone || '',
      [`${myPrefix}_email`]: user.email || '',
      [`${myPrefix}_street`]: defaultAddr?.street || loc.address_description || '',
      [`${myPrefix}_city`]: cityName,
      [`${myPrefix}_district`]: districtName,
      [`${myPrefix}_quartier`]: quartierName,
      [`${myPrefix}_zone_id`]: zoneId,
      // Clear the other side so the user fills it for the other party
      [`${otherPrefix}_name`]: '',
      [`${otherPrefix}_phone`]: '',
      [`${otherPrefix}_email`]: '',
      [`${otherPrefix}_street`]: '',
      [`${otherPrefix}_city`]: '',
      [`${otherPrefix}_district`]: '',
      [`${otherPrefix}_quartier`]: '',
      [`${otherPrefix}_zone_id`]: '',
      other_user_id: null,
    }));
  }, [user, direction, userAddresses, zones]);

  // The "other" prefix is the side the other party fills
  const otherPrefix = direction === 'send' ? 'dropoff' : 'pickup';

  const [lookupMsg, setLookupMsg] = useState('');

  const selectLookupUser = (found) => {
    const addr = found.address || {};
    setLookupResult(found);
    setLookupResults([]);

    let zoneId = addr.zone_id || '';
    if (!zoneId && addr.quartier && quartiers.length) {
      const match = quartiers.find(z => z.name.toLowerCase() === addr.quartier.toLowerCase());
      if (match) zoneId = match._id;
    }

    setForm(prev => ({
      ...prev,
      other_user_id: found._id,
      [`${otherPrefix}_name`]: found.name || '',
      [`${otherPrefix}_phone`]: found.phone || '',
      [`${otherPrefix}_email`]: found.email || '',
      [`${otherPrefix}_street`]: addr.street || '',
      [`${otherPrefix}_city`]: addr.city || '',
      [`${otherPrefix}_district`]: addr.district || '',
      [`${otherPrefix}_quartier`]: addr.quartier || '',
      [`${otherPrefix}_zone_id`]: zoneId,
    }));
  };

  const handleLookup = async () => {
    if (!lookupQuery || lookupQuery.length < 3) return;
    setLookupLoading(true);
    setLookupMsg('');
    setLookupResult(null);
    setLookupResults([]);
    try {
      const res = await api.get(`/p2p/lookup?q=${encodeURIComponent(lookupQuery)}`);
      if (res.data?.success && res.data.data.found) {
        const { users, multiple } = res.data.data;
        if (multiple && users?.length > 1) {
          setLookupResults(users);
        } else {
          selectLookupUser(users?.[0] || res.data.data.user);
        }
      } else {
        setLookupMsg('No user found with that username, phone, or email');
      }
    } catch (err) {
      setLookupMsg(err.response?.data?.message || 'Lookup failed — please try again');
    }
    setLookupLoading(false);
  };

  const handleGetQuote = async () => {
    setError('');
    if (!form.pickup_zone_id || !form.dropoff_zone_id) {
      setError('Please select pickup and delivery quartiers');
      return;
    }
    if (!form.prohibited_confirmed) {
      setError('Please confirm no prohibited items are included');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/p2p/quote', {
        pickup_zone_id: form.pickup_zone_id,
        dropoff_zone_id: form.dropoff_zone_id,
        weight_tier: form.weight_tier,
      });
      if (res.data?.success && res.data.data.coverage && res.data.data.quotes?.length) {
        setQuotes(res.data.data.quotes);
        setSelectedQuote(res.data.data.quotes[0]); // Pre-select cheapest
        setStep(2);
      } else {
        setError(res.data?.data?.reason || 'No coverage for this route');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get quote');
    }
    setLoading(false);
  };

  const handleBook = async () => {
    setError('');
    setLoading(true);
    try {
      const myPfx = direction === 'send' ? 'pickup' : 'dropoff';
      const otherPfx = direction === 'send' ? 'dropoff' : 'pickup';

      const payload = {
        direction,
        provider_id: selectedQuote?.provider_id,
        pickup_address: {
          name: form.pickup_name, phone: form.pickup_phone, email: form.pickup_email,
          street: form.pickup_street, city: form.pickup_city,
          quartier: form.pickup_quartier, zone_id: form.pickup_zone_id,
        },
        dropoff_address: {
          name: form.dropoff_name, phone: form.dropoff_phone, email: form.dropoff_email,
          street: form.dropoff_street, city: form.dropoff_city,
          quartier: form.dropoff_quartier, zone_id: form.dropoff_zone_id,
        },
        package_details: {
          category: form.category, weight_tier: form.weight_tier,
          declared_value: Number(form.declared_value) || 0,
          description: form.description,
          prohibited_items_confirmed: true,
        },
        other_party: {
          user_id: form.other_user_id,
          name: form[`${otherPfx}_name`],
          phone: form[`${otherPfx}_phone`],
          email: form[`${otherPfx}_email`],
        },
        scheduled_pickup: form.scheduled ? form.scheduled_date : null,
        payment_method: form.payment_method,
      };

      if (!user) {
        payload.booker_name = form[`${myPfx}_name`];
        payload.booker_phone = form[`${myPfx}_phone`];
        payload.booker_email = form[`${myPfx}_email`];
        payload.guest_session_id = getGuestSessionId();
      }

      const res = await api.post('/p2p/book', payload);
      if (res.data?.success) {
        setSuccess(res.data.data.shipment);
        setStep(3);
      } else {
        setError(res.data?.message || 'Booking failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book delivery');
    }
    setLoading(false);
  };

  // Unified address box — isMyBox=true means this is the logged-in user's side (autofilled)
  const renderAddressBox = (prefix, label, color, isMyBox) => {
    const isOtherSide = !isMyBox;
    const distOpts = getDistrictOpts(form[`${prefix}_city`]);
    const qOpts = getQuartierOpts(form[`${prefix}_district`], form[`${prefix}_city`]);

    // Summary view for the user's own box (when not editing)
    const showSummary = isMyBox && user && !editingMyBox;
    const hasAddress = form[`${prefix}_city`] || form[`${prefix}_street`];

    // Build address string
    const addressParts = [form[`${prefix}_street`], form[`${prefix}_quartier`], form[`${prefix}_district`], form[`${prefix}_city`]].filter(Boolean);

    return (
      <div className={`rounded-2xl border p-5 space-y-4 transition-all ${isMyBox && user ? 'border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 to-transparent' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--text-primary)] text-[15px] flex items-center gap-2.5">
            <div className={`rounded-lg p-2 ${isMyBox && user ? 'bg-[var(--accent)]/20' : 'bg-[var(--text-secondary)]/10'}`}>
              <MapPin className={`size-4 ${isMyBox && user ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
            </div>
            <span>{isMyBox && user ? `${label} (${user.name?.split(' ')[0] || 'You'})` : `${label} Location`}</span>
          </h3>
          {isMyBox && user && !editingMyBox && (
            <button onClick={() => setEditingMyBox(true)} className="rounded-lg p-2 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors">
              <Pencil className="size-4" />
            </button>
          )}
          {isMyBox && user && editingMyBox && (
            <button onClick={() => setEditingMyBox(false)} className="rounded-lg p-2 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/10 transition-colors">
              <CheckCircle2 className="size-4" />
            </button>
          )}
        </div>

        {/* Summary card for user's own info */}
        {showSummary && (
          <div className="space-y-2">
            {form[`${prefix}_name`] && (
              <div className="flex items-center gap-2.5">
                <UserIcon className="size-3.5 text-[var(--text-secondary)]/60 shrink-0" />
                <span className="text-[13px] font-medium text-[var(--text-primary)]">{form[`${prefix}_name`]}</span>
              </div>
            )}
            {form[`${prefix}_phone`] && (
              <div className="flex items-center gap-2.5">
                <Phone className="size-3.5 text-[var(--text-secondary)]/60 shrink-0" />
                <span className="text-[13px] text-[var(--text-primary)]">{form[`${prefix}_phone`]}</span>
              </div>
            )}
            {form[`${prefix}_email`] && (
              <div className="flex items-center gap-2.5">
                <Mail className="size-3.5 text-[var(--text-secondary)]/60 shrink-0" />
                <span className="text-[13px] text-[var(--text-primary)]">{form[`${prefix}_email`]}</span>
              </div>
            )}
            {hasAddress && (
              <div className="flex items-start gap-2.5 mt-1 pt-1 border-t border-[var(--glass-border)]/50">
                <MapPin className="size-3.5 text-[var(--text-secondary)]/60 shrink-0 mt-0.5" />
                <span className="text-[13px] text-[var(--text-secondary)] leading-snug">{addressParts.join(', ') || 'No address set'}</span>
              </div>
            )}
            {!form[`${prefix}_name`] && !form[`${prefix}_phone`] && !hasAddress && (
              <p className="text-[12px] text-[var(--text-secondary)]/60 italic">No info yet — tap Edit to add your details</p>
            )}
          </div>
        )}

        {/* Full editable form (always shown for other side, shown on edit for my side) */}
        {!showSummary && (
          <>
            {/* User lookup on the other party's side (auth users only) */}
            {isOtherSide && user && (
              <>
                {!lookupResult && lookupResults.length === 0 && (
                  <div className="flex gap-2">
                    <input value={lookupQuery} onChange={e => setLookupQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      className={INPUT_CLASS} placeholder="Search by username, phone, or email" />
                    <button onClick={handleLookup} disabled={lookupLoading}
                      className="shrink-0 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white disabled:opacity-50">
                      {lookupLoading ? '...' : 'Find'}
                    </button>
                  </div>
                )}
                {lookupMsg && !lookupResult && lookupResults.length === 0 && (
                  <p className="text-[12px] text-rose-500 font-medium">{lookupMsg}</p>
                )}
                {/* Multiple results — let user pick */}
                {lookupResults.length > 1 && !lookupResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-[var(--text-secondary)]">Multiple accounts found — select one:</p>
                      <button onClick={() => { setLookupResults([]); setLookupQuery(''); }}
                        className="text-[11px] text-rose-500 font-semibold">Cancel</button>
                    </div>
                    {lookupResults.map(u => (
                      <button key={u._id} onClick={() => selectLookupUser(u)}
                        className="w-full flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-3 text-left transition-all hover:border-[var(--accent)]/40">
                        {u.avatar ? (
                          <img src={u.avatar} className="size-10 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="size-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-bold text-[14px]">
                            {u.name?.[0]}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{u.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.username && <span className="text-[11px] text-[var(--text-secondary)]">@{u.username}</span>}
                            {u.role && u.role !== 'user' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] capitalize">{u.role}</span>
                            )}
                          </div>
                          {u.address?.city && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{[u.address.quartier, u.address.city].filter(Boolean).join(', ')}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {lookupResult && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    {lookupResult.avatar ? (
                      <img src={lookupResult.avatar} className="size-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="size-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-bold text-[14px]">
                        {lookupResult.name?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{lookupResult.name}</p>
                      {lookupResult.username && <p className="text-[11px] text-[var(--text-secondary)]">@{lookupResult.username}</p>}
                    </div>
                    <button onClick={() => {
                      setLookupResult(null);
                      setLookupResults([]);
                      setLookupQuery('');
                      setLookupMsg('');
                      setForm(p => ({
                        ...p, other_user_id: null,
                        [`${prefix}_name`]: '', [`${prefix}_phone`]: '', [`${prefix}_email`]: '',
                        [`${prefix}_street`]: '', [`${prefix}_city`]: '', [`${prefix}_district`]: '',
                        [`${prefix}_quartier`]: '', [`${prefix}_zone_id`]: '',
                      }));
                    }} className="ml-auto text-[11px] text-rose-500 font-semibold">Clear</button>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* Contact info */}
              <div><label className={LABEL_CLASS}>Full Name</label><input value={form[`${prefix}_name`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_name`]: e.target.value }))} className={INPUT_CLASS} placeholder="Full name" /></div>
              <div><label className={LABEL_CLASS}>Phone</label><input value={form[`${prefix}_phone`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_phone`]: e.target.value }))} className={INPUT_CLASS} placeholder="+237..." /></div>
              <div className="md:col-span-2"><label className={LABEL_CLASS}>Email</label><input value={form[`${prefix}_email`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_email`]: e.target.value }))} className={INPUT_CLASS} placeholder="email@example.com" /></div>

              {/* Address dropdowns */}
              <div>
                <label className={LABEL_CLASS}>City</label>
                <select value={form[`${prefix}_city`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_city`]: e.target.value, [`${prefix}_district`]: '', [`${prefix}_quartier`]: '', [`${prefix}_zone_id`]: '' }))} className={INPUT_CLASS}>
                  <option value="">Select city</option>
                  {cities.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                </select>
              </div>
              {distOpts.length > 0 && (
                <div>
                  <label className={LABEL_CLASS}>District</label>
                  <select value={form[`${prefix}_district`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_district`]: e.target.value, [`${prefix}_quartier`]: '', [`${prefix}_zone_id`]: '' }))} className={INPUT_CLASS}>
                    <option value="">Select district</option>
                    {distOpts.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                  </select>
                </div>
              )}
              {qOpts.length > 0 && (
                <div>
                  <label className={LABEL_CLASS}>Quartier</label>
                  <select value={form[`${prefix}_quartier`]} onChange={e => {
                    const zone = qOpts.find(z => z.name === e.target.value);
                    setForm(p => ({ ...p, [`${prefix}_quartier`]: e.target.value, [`${prefix}_zone_id`]: zone?._id || '' }));
                  }} className={INPUT_CLASS}>
                    <option value="">Select quartier</option>
                    {qOpts.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                  </select>
                </div>
              )}
              <div><label className={LABEL_CLASS}>Street / Landmark</label><input value={form[`${prefix}_street`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_street`]: e.target.value }))} className={INPUT_CLASS} placeholder="Building, gate, landmark..." /></div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)]/20 pb-32 pt-4 sm:pt-6">
      <style jsx>{`
        .delivery-input, .delivery-input::placeholder { font-size: 16px; }
        .delivery-label { font-size: 12px; }
        @media (min-width: 768px) {
          .delivery-input, .delivery-input::placeholder { font-size: 14px; }
          .delivery-label { font-size: 12px; }
        }
        .direction-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .direction-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>
      <div className="mx-auto max-w-lg sm:max-w-3xl px-3 sm:px-4">
        {/* Header */}
        <div className="mb-5 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            {user?.avatar || user?.branding?.logo ? (
              <img src={user.branding?.logo || user.avatar} alt={user.name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/70 text-white font-bold text-base sm:text-lg shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)]">Pickup & Delivery</h1>
              <p className="text-[11px] sm:text-[13px] text-[var(--text-secondary)] mt-0.5">Quick & reliable package delivery</p>
            </div>
          </div>
        </div>

        {/* Step 3: Success */}
        {step === 3 && success && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-3">
                  <CheckCircle2 className="size-10 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Delivery Booked!</h2>
              <p className="text-[var(--text-secondary)] text-[14px] mb-4">Your package is ready for pickup</p>
              <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Tracking Code</p>
                <p className="font-mono text-[18px] font-bold text-[var(--accent)] tracking-wider">{success.tracking_code}</p>
              </div>
            </div>

            {/* Booking Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)] to-transparent p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="size-4 text-[var(--accent)]" />
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Amount</p>
                </div>
                <p className="text-[18px] font-bold text-[var(--text-primary)]">{success.price?.toLocaleString()} XAF</p>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)] to-transparent p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="size-4 text-[var(--accent)]" />
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Payment</p>
                </div>
                <span className={`text-[13px] font-bold px-3 py-1 rounded-full inline-block ${
                  success.payment_status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-600'
                    : 'bg-amber-500/20 text-amber-600'
                }`}>
                  {success.payment_status === 'paid' ? '✓ Paid' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => router.push(`/delivery/track?code=${success.tracking_code}`)}
                className="flex-1 rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/80 px-6 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl hover:shadow-[var(--accent)]/30 transition-all hover:scale-105">
                <div className="flex items-center justify-center gap-2">
                  <Package className="size-4" />
                  Track Package
                </div>
              </button>
              <button onClick={() => { setStep(1); setSuccess(null); setQuotes([]); setSelectedQuote(null); }}
                className="flex-1 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-6 py-3.5 text-[14px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all">
                Book Another
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Provider Selection & Quote Review */}
        {step === 2 && quotes.length > 0 && (
          <div className="space-y-6">
            {/* Provider Selection */}
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-[16px] mb-4">Available Delivery Providers</h3>
              <div className="space-y-3">
                {quotes.map(q => (
                  <button
                    key={q.provider_id}
                    onClick={() => setSelectedQuote(q)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all duration-300 ${
                      selectedQuote?.provider_id === q.provider_id
                        ? 'border-[var(--accent)] bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 shadow-md shadow-[var(--accent)]/10 scale-105'
                        : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 hover:shadow-md hover:shadow-black/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {q.provider_logo ? (
                          <img src={q.provider_logo} className="size-12 rounded-xl object-cover shadow-sm" alt="" />
                        ) : (
                          <div className="size-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-bold text-[16px]">
                            {q.provider_name?.[0]}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-[14px] font-bold text-[var(--text-primary)]">{q.provider_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {q.estimated_delivery_minutes && (
                              <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] bg-white/5 px-2.5 py-1 rounded-lg">
                                <Clock className="size-3.5" />~{q.estimated_delivery_minutes} min
                              </span>
                            )}
                            {q.provider_rating > 0 && (
                              <span className="inline-flex items-center gap-1 text-[12px] text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                                ⭐ {q.provider_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-bold text-[var(--accent)]">{q.price?.toLocaleString()}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">XAF</p>
                        {q.platform_fee > 0 && (
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1">Fee: {q.platform_fee.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Quote Summary */}
            {selectedQuote && (
              <div className="rounded-2xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/10 to-transparent p-5 space-y-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Base Delivery Fee</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedQuote.base_price?.toLocaleString()} XAF</span>
                </div>
                {selectedQuote.platform_fee > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--text-secondary)]">Platform Fee</span>
                    <span className="font-semibold text-[var(--text-primary)]">{selectedQuote.platform_fee.toLocaleString()} XAF</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--accent)]/20 pt-3">
                  <span className="font-bold text-[var(--text-primary)] text-[14px]">Total Cost</span>
                  <span className="font-bold text-[var(--accent)] text-[18px]">{selectedQuote.price?.toLocaleString()} XAF</span>
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5 space-y-3">
              <h3 className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CreditCard className="size-4 text-[var(--accent)]" />
                Select Payment Method
              </h3>
              <div className="space-y-2.5">
                {user && (
                  <label className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] p-4 cursor-pointer transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5">
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      form.payment_method === 'wallet'
                        ? 'border-[var(--accent)] bg-[var(--accent)]'
                        : 'border-[var(--text-secondary)]/40'
                    }`}>
                      {form.payment_method === 'wallet' && <div className="size-1.5 bg-white rounded-full" />}
                    </div>
                    <Wallet className="size-5 text-[var(--accent)]" />
                    <input type="radio" name="payment" value="wallet" checked={form.payment_method === 'wallet'}
                      onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                      className="hidden" />
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">Wallet Balance</span>
                  </label>
                )}
                <label className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] p-4 cursor-pointer transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5">
                  <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    form.payment_method === 'gateway'
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--text-secondary)]/40'
                  }`}>
                    {form.payment_method === 'gateway' && <div className="size-1.5 bg-white rounded-full" />}
                  </div>
                  <CreditCard className="size-5 text-[var(--accent)]" />
                  <input type="radio" name="payment" value="gateway" checked={form.payment_method === 'gateway'}
                    onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="hidden" />
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">Mobile Money</span>
                </label>
              </div>
            </div>

            {error && <p className="text-rose-500 text-[13px] font-semibold bg-rose-500/10 rounded-xl px-4 py-2.5">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 rounded-2xl border border-[var(--glass-border)] py-3.5 text-[14px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all hover:border-[var(--accent)]/40">
                ← Back
              </button>
              <button onClick={handleBook} disabled={loading || !selectedQuote}
                className="flex-1 rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/80 py-3.5 text-[14px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl hover:shadow-[var(--accent)]/30 transition-all hover:scale-105">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Confirm & Pay
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Booking Form */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Direction Toggle */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <button onClick={() => setDirection('send')}
                className={`direction-btn flex flex-col items-center gap-2 sm:gap-3 rounded-2xl border-2 p-4 sm:p-5 transition-all active:scale-[0.97] ${
                  direction === 'send'
                    ? 'border-[var(--accent)] bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 shadow-lg shadow-[var(--accent)]/10'
                    : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40'
                }`}>
                <div className={`rounded-full p-2.5 sm:p-3 transition-all ${
                  direction === 'send' ? 'bg-[var(--accent)]/20' : 'bg-[var(--text-secondary)]/10'
                }`}>
                  <Send className={`size-5 sm:size-6 ${direction === 'send' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                </div>
                <span className={`text-[12px] sm:text-[14px] font-bold ${direction === 'send' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  Send Package
                </span>
              </button>
              <button onClick={() => setDirection('request_pickup')}
                className={`direction-btn flex flex-col items-center gap-2 sm:gap-3 rounded-2xl border-2 p-4 sm:p-5 transition-all active:scale-[0.97] ${
                  direction === 'request_pickup'
                    ? 'border-[var(--accent)] bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 shadow-lg shadow-[var(--accent)]/10'
                    : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40'
                }`}>
                <div className={`rounded-full p-2.5 sm:p-3 transition-all ${
                  direction === 'request_pickup' ? 'bg-[var(--accent)]/20' : 'bg-[var(--text-secondary)]/10'
                }`}>
                  <ArrowDownToLine className={`size-5 sm:size-6 ${direction === 'request_pickup' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                </div>
                <span className={`text-[12px] sm:text-[14px] font-bold ${direction === 'request_pickup' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  Request Pickup
                </span>
              </button>
            </div>

            {/* Pickup */}
            {renderAddressBox('pickup', 'Pickup', 'emerald', direction === 'send')}

            {/* Delivery */}
            {renderAddressBox('dropoff', 'Delivery', 'rose', direction === 'request_pickup')}

            {/* Package Details */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5 space-y-4">
              <h3 className="font-bold text-[var(--text-primary)] text-[15px] flex items-center gap-2.5">
                <div className="rounded-lg bg-[var(--accent)]/20 p-2">
                  <Package className="size-4 text-[var(--accent)]" />
                </div>
                Package Details
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={INPUT_CLASS}>
                    {PACKAGE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Weight</label>
                  <select value={form.weight_tier} onChange={e => setForm(p => ({ ...p, weight_tier: e.target.value }))} className={INPUT_CLASS}>
                    {WEIGHT_TIERS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
                <div><label className={LABEL_CLASS}>Declared Value (XAF)</label><input type="number" value={form.declared_value} onChange={e => setForm(p => ({ ...p, declared_value: e.target.value }))} className={INPUT_CLASS} placeholder="0" /></div>
                <div className="md:col-span-2"><label className={LABEL_CLASS}>Description</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={`${INPUT_CLASS} resize-none`} rows={2} placeholder="Describe your package" /></div>
              </div>

              {/* Prohibited items */}
              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <input type="checkbox" checked={form.prohibited_confirmed} onChange={e => setForm(p => ({ ...p, prohibited_confirmed: e.target.checked }))}
                  className="mt-0.5 accent-[var(--accent)]" />
                <span className="text-[11px] text-[var(--text-secondary)] leading-tight">
                  I confirm this package does not contain prohibited items (weapons, drugs, hazardous materials, illegal goods).
                </span>
              </label>
            </div>

            {/* Schedule */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--text-primary)] text-[15px] flex items-center gap-2.5">
                  <div className="rounded-lg bg-[var(--accent)]/20 p-2">
                    <Clock className="size-4 text-[var(--accent)]" />
                  </div>
                  Pickup Time
                </h3>
                <label className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-1.5 hover:bg-white/5 transition-all">
                  <span className="text-[12px] font-bold text-[var(--text-primary)]">{form.scheduled ? 'Scheduled' : 'ASAP'}</span>
                  <div className={`relative w-5 h-5 rounded-full border-2 transition-all ${
                    form.scheduled ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--text-secondary)]/40'
                  }`}>
                    {form.scheduled && <div className="absolute inset-0 flex items-center justify-center"><div className="size-1.5 bg-white rounded-full" /></div>}
                  </div>
                  <input type="checkbox" checked={form.scheduled} onChange={e => setForm(p => ({ ...p, scheduled: e.target.checked }))}
                    className="hidden" />
                </label>
              </div>
              {(form.scheduled || error?.includes('not currently available')) && (
                <input type="datetime-local" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                  className={INPUT_CLASS} placeholder="Select pickup time" />
              )}
            </div>

            {error && <p className="text-rose-500 text-[13px] font-semibold bg-rose-500/10 rounded-xl px-4 py-2.5">{error}</p>}

            <button onClick={handleGetQuote} disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/80 py-3.5 sm:py-4 text-[13px] sm:text-[14px] font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 transition-all active:scale-[0.98] min-h-[48px]">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-5" />}
              Get Quote & Compare
            </button>

            {/* Links */}
            <div className="flex flex-col gap-2.5 text-[12px] sm:text-[13px]">
              <button onClick={() => router.push('/delivery/track')} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)] font-semibold py-3 min-h-[44px] active:scale-[0.98] transition-all">
                Track an Existing Delivery
              </button>
              {user && <button onClick={() => router.push('/delivery/history')} className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold py-3 min-h-[44px] active:scale-[0.98] transition-all">
                View My Deliveries
              </button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getGuestSessionId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('auradime-guest-session');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('auradime-guest-session', id);
  }
  return id;
}
