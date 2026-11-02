'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import WhatsAppSupport from '@/components/logistics/WhatsAppSupport';
import AddressField from '@/components/location/AddressField';
import { FIELD, LABEL, SMALL_BUTTON, HINT } from '@/lib/formStyles';
import { useFeatureFlag } from '@/lib/featureFlags';
import {
  Package, Send, ArrowDownToLine, ChevronRight, MapPin, Clock, Wallet, Loader2,
  CheckCircle2, Check, Pencil, User as UserIcon, X, Smartphone, AlertCircle, Truck, CircleDot, Search,
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
  { value: 'light', label: 'Light (under 5 kg)' },
  { value: 'medium', label: 'Medium (5–15 kg)' },
  { value: 'heavy', label: 'Heavy (15–30 kg)' },
  { value: 'extra_heavy', label: 'Extra Heavy (30+ kg)' },
];

// Earliest selectable pickup: now, in the local "YYYY-MM-DDTHH:mm" format datetime-local expects.
const minPickupDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const CARD = 'space-y-5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 sm:p-6';

/** Section heading: icon, title, one-line hint, optional action on the right. */
function CardTitle({ id, icon: Icon, title, hint, action = null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {hint && <p className={`${HINT} text-[12px]`}>{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** One-tap choices instead of a dropdown. options: [{ value, label }]. */
function Chips({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className={LABEL}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={`inline-flex min-h-10 items-center rounded-xl border px-3 text-[12px] font-semibold transition-colors ${value === o.value ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

/** A selectable card (courier, payment method) with a radio dot. */
function Choice({ selected, onClick, icon: Icon, leading = null, title, sub, right = null }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${selected ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]/40'}`}>
      {leading || <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}><Icon className="size-5" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{title}</span>
        {sub && <span className="block truncate text-[12px] text-[var(--text-secondary)]">{sub}</span>}
      </span>
      {right}
      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--glass-border)]'}`}>{selected && <span className="size-1.5 rounded-full bg-white" />}</span>
    </button>
  );
}

export default function DeliveryPage() {
  const router = useRouter();
  const { user, walletBalance, refreshWalletBalance } = useAuthStore();
  const locationPickerEnabled = useFeatureFlag('location_picker');
  const displayedWalletBalance = Number(walletBalance ?? 0);
  const { t } = useLanguage();


  const [direction, setDirection] = useState('send');
  const [step, setStep] = useState(1); // Pickup, delivery, package, courier and payment, done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [zones, setZones] = useState([]);
  const [success, setSuccess] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null); // { gateway, reference }
  const paymentPollRef = useRef(null);

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
    payment_method: user ? 'wallet' : 'pawapay',
    momo_phone: '',
  });

  // Lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [editingMyBox, setEditingMyBox] = useState(false);
  const [editingOtherBox, setEditingOtherBox] = useState(false);
  const [findOpen, setFindOpen] = useState(false);

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

  // Track which direction was last autofilled so we distinguish an initial /
  // direction-change autofill from an async-data-load re-run.
  const autofillDirRef = useRef(null);

  // Autofill signed-in user's data to the correct side based on direction.
  // Full overwrite only happens on first mount or when direction changes.
  // Subsequent async data loads (zones, userAddresses) only fill EMPTY fields
  // so the user's manual selections are never wiped.
  useEffect(() => {
    if (!user || !zones.length) return;
    const allAddrs = userAddresses.length ? userAddresses : (user.addresses || []);
    const defaultAddr = allAddrs.find(a => a.isDefault) || allAddrs[0] || null;
    const loc = user.onboarding_location || {};
    const myPrefix  = direction === 'send' ? 'pickup' : 'dropoff';
    const otherPrefix = direction === 'send' ? 'dropoff' : 'pickup';

    const cityName = defaultAddr?.city || loc.city || '';
    const districtName = defaultAddr?.region || loc.zone || '';
    let quartierName = defaultAddr?.quartier || loc.quartier || '';
    let zoneId = defaultAddr?.zone_id || '';

    if (!zoneId && quartierName && quartiers.length) {
      const match = quartiers.find(z => z.name.toLowerCase() === quartierName.toLowerCase());
      if (match) {
        zoneId = match._id;
        quartierName = match.name;
      }
    }

    const isFirstOrDirectionChange = autofillDirRef.current !== direction;
    autofillDirRef.current = direction;

    setForm(prev => {
      const updates = { ...prev };

      if (isFirstOrDirectionChange) {
        // First mount or direction changed → full autofill of user's side
        updates[`${myPrefix}_name`] = user.name || '';
        updates[`${myPrefix}_phone`] = defaultAddr?.contact_phone || user.phone || '';
        updates[`${myPrefix}_email`] = user.email || '';
        updates.momo_phone = prev.momo_phone || defaultAddr?.contact_phone || user.phone || '';
        updates[`${myPrefix}_street`] = defaultAddr?.street || loc.address_description || '';
        updates[`${myPrefix}_city`] = cityName;
        updates[`${myPrefix}_district`] = districtName;
        updates[`${myPrefix}_quartier`] = quartierName;
        updates[`${myPrefix}_zone_id`] = zoneId;
        // Clear the other side on direction change (but not if lookup user selected)
        if (!prev.other_user_id) {
          updates[`${otherPrefix}_name`] = '';
          updates[`${otherPrefix}_phone`] = '';
          updates[`${otherPrefix}_email`] = '';
          updates[`${otherPrefix}_street`] = '';
          updates[`${otherPrefix}_city`] = '';
          updates[`${otherPrefix}_district`] = '';
          updates[`${otherPrefix}_quartier`] = '';
          updates[`${otherPrefix}_zone_id`] = '';
          updates.other_user_id = null;
        }
      } else {
        // Async data loaded (zones or userAddresses) — only fill EMPTY fields
        // so we never overwrite the user's manual quartier / zone_id selections.
        if (!prev[`${myPrefix}_name`]) updates[`${myPrefix}_name`] = user.name || '';
        if (!prev[`${myPrefix}_phone`]) updates[`${myPrefix}_phone`] = defaultAddr?.contact_phone || user.phone || '';
        if (!prev[`${myPrefix}_email`]) updates[`${myPrefix}_email`] = user.email || '';
        if (!prev.momo_phone) updates.momo_phone = defaultAddr?.contact_phone || user.phone || '';
        if (!prev[`${myPrefix}_street`]) updates[`${myPrefix}_street`] = defaultAddr?.street || loc.address_description || '';
        if (!prev[`${myPrefix}_city`]) updates[`${myPrefix}_city`] = cityName;
        if (!prev[`${myPrefix}_district`]) updates[`${myPrefix}_district`] = districtName;
        if (!prev[`${myPrefix}_quartier`]) updates[`${myPrefix}_quartier`] = quartierName;
        if (!prev[`${myPrefix}_zone_id`]) updates[`${myPrefix}_zone_id`] = zoneId;
        // Never clear the other side on async data loads
      }

      return updates;
    });
  }, [user, direction, userAddresses, zones]);

  // The "other" prefix is the side the other party fills
  const otherPrefix = direction === 'send' ? 'dropoff' : 'pickup';

  // Reset lookup state when direction changes (the "other" party side flips)
  useEffect(() => {
    setLookupResult(null);
    setLookupResults([]);
    setLookupQuery('');
    setLookupMsg('');
    setEditingOtherBox(false);
  }, [direction]);

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

  const quoteRequestRef = useRef(0);
  const formTopRef = useRef(null);
  // Payment edits keep the quote; trip edits invalidate it and any in-flight request.
  const quoteData = JSON.stringify(Object.fromEntries(Object.entries(form).filter(([key]) => !['payment_method', 'momo_phone'].includes(key))));

  const handleGetQuote = async (clearError = false) => {
    const request = ++quoteRequestRef.current;
    if (clearError) setError('');
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
        // Exact spots let distance-priced agencies quote the real trip.
        pickup_location: form.pickup_location || undefined,
        dropoff_location: form.dropoff_location || undefined,
      });
      if (request !== quoteRequestRef.current) return;
      if (res.data?.success && res.data.data.coverage && res.data.data.quotes?.length) {
        setQuotes(res.data.data.quotes);
        setSelectedQuote(res.data.data.quotes[0]); // Pre-select cheapest
      } else {
        setError(res.data?.data?.reason || 'No coverage for this route');
      }
    } catch (err) {
      if (request === quoteRequestRef.current) setError(err.response?.data?.message || 'Failed to get quote');
    }
    if (request === quoteRequestRef.current) setLoading(false);
  };

  useEffect(() => {
    setQuotes([]);
    setSelectedQuote(null);
    quoteRequestRef.current++;
    // Fixing what was missing clears the message (quote errors come back from the refetch).
    setError('');
  }, [direction, quoteData]);

  useEffect(() => {
    if (step === 4) handleGetQuote();
    else setLoading(false);
    return () => { quoteRequestRef.current++; };
  }, [step, direction, quoteData]);

  useEffect(() => {
    formTopRef.current?.scrollIntoView({ behavior: window.matchMedia('(min-width: 640px) and (prefers-reduced-motion: no-preference)').matches ? 'smooth' : 'instant', block: 'start' });
  }, [step]);

  const goToStep = (next) => { setError(''); setStep(next); };
  const handleContinue = () => {
    const prefix = step === 1 ? 'pickup' : 'dropoff';
    const missing = [];
    if (step <= 2) {
      if (!form[prefix + '_zone_id']) missing.push(STEPS[step - 1].toLowerCase() + ' place (select a quartier)');
      if (!form[prefix + '_name'].trim()) missing.push('name');
      if (!form[prefix + '_phone'].trim()) missing.push('phone');
    } else {
      if (!form.prohibited_confirmed) missing.push('confirmation that there are no prohibited items');
      if (form.scheduled && !form.scheduled_date) missing.push('scheduled pickup date and time');
    }
    if (missing.length) { setError('Please provide: ' + missing.join(', ') + '.'); return; }
    goToStep(step + 1);
  };

  // Poll the payment verify endpoint until confirmed or failed
  const startPaymentPolling = (gateway, reference, shipmentData) => {
    if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    let attempts = 0;
    const maxAttempts = 60; // ~5 minutes at 5s intervals
    paymentPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(paymentPollRef.current);
        paymentPollRef.current = null;
        setPendingPayment(prev => prev ? { ...prev, timedOut: true } : null);
        return;
      }
      try {
        const res = await api.get(`/payments/${gateway}/verify/${reference}`);
        const status = res.data?.status || res.data?.data?.status;
        if (status === 'SUCCESSFUL') {
          clearInterval(paymentPollRef.current);
          paymentPollRef.current = null;
          setPendingPayment(null);
          setSuccess(prev => prev ? { ...prev, payment_status: 'paid' } : prev);
        } else if (status === 'FAILED') {
          clearInterval(paymentPollRef.current);
          paymentPollRef.current = null;
          setPendingPayment(null);
          setError(res.data?.reason || 'Payment was declined. Please try again.');
          setStep(4);
        }
      } catch (_) { /* keep polling on network errors */ }
    }, 5000);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    };
  }, []);

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
          ...(form.pickup_location && { location: form.pickup_location }),
          ...(form.pickup_landmark && { landmark: form.pickup_landmark }),
        },
        dropoff_address: {
          name: form.dropoff_name, phone: form.dropoff_phone, email: form.dropoff_email,
          street: form.dropoff_street, city: form.dropoff_city,
          quartier: form.dropoff_quartier, zone_id: form.dropoff_zone_id,
          ...(form.dropoff_location && { location: form.dropoff_location }),
          ...(form.dropoff_landmark && { landmark: form.dropoff_landmark }),
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
        momo_phone: form.momo_phone || undefined,
      };

      if (!user) {
        payload.booker_name = form[`${myPfx}_name`];
        payload.booker_phone = form[`${myPfx}_phone`];
        payload.booker_email = form[`${myPfx}_email`];
        payload.guest_session_id = getGuestSessionId();
      }

      const res = await api.post('/p2p/book', payload);
      if (res.data?.success) {
        const { shipment: shipmentData, payment, payment_error } = res.data.data;
        if (payment?.reference) {
          // MoMo payment initiated — show waiting screen and poll for confirmation
          setSuccess(shipmentData);
          setPendingPayment(payment);
          setStep(5);
          startPaymentPolling(payment.gateway, payment.reference, shipmentData);
        } else if (payment_error) {
          setError(`Shipment booked but payment failed: ${payment_error}. Please try paying from your deliveries.`);
        } else {
          // Wallet payment — already paid
          setSuccess(shipmentData);
          setStep(5);
          if (form.payment_method === 'wallet') refreshWalletBalance?.();
        }
      } else {
        setError(res.data?.message || 'Booking failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book delivery');
    }
    setLoading(false);
  };

  // One side of the trip. Pickup is always the sender, delivery the recipient.
  // Filled sides (your own, or an Auradime user you found) fold into a summary with Edit.
  const renderAddressBox = (prefix, isMyBox) => {
    const isOther = !isMyBox;
    const isPickup = prefix === 'pickup';
    const person = isPickup ? 'Sender' : 'Recipient';
    const otherHasLookup = isOther && lookupResult && user;
    const editing = isMyBox ? editingMyBox : editingOtherBox;
    const setEditing = isMyBox ? setEditingMyBox : setEditingOtherBox;
    const hasPlace = Boolean(form[`${prefix}_zone_id`] || form[`${prefix}_location`]);
    const canSummarise = ((isMyBox && user) || otherHasLookup) && form[`${prefix}_name`] && hasPlace;
    const showSummary = canSummarise && !editing;
    const placeLine = [form[`${prefix}_street`], form[`${prefix}_quartier`], form[`${prefix}_city`]].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
    const who = isMyBox && user ? 'You' : otherHasLookup ? lookupResult.name?.split(' ')[0] : null;

    const clearLookup = () => {
      setLookupResult(null); setLookupResults([]); setLookupQuery(''); setLookupMsg(''); setEditingOtherBox(false); setFindOpen(false);
      setForm(p => ({
        ...p, other_user_id: null,
        [`${prefix}_name`]: '', [`${prefix}_phone`]: '', [`${prefix}_email`]: '',
        [`${prefix}_street`]: '', [`${prefix}_city`]: '', [`${prefix}_district`]: '',
        [`${prefix}_quartier`]: '', [`${prefix}_zone_id`]: '', [`${prefix}_location`]: null, [`${prefix}_landmark`]: '', [`${prefix}_address_id`]: '',
      }));
    };

    return (
      <section aria-labelledby={`${prefix}-title`} className={CARD}>
        <CardTitle
          id={`${prefix}-title`}
          icon={isPickup ? CircleDot : MapPin}
          title={`${isPickup ? 'Pickup' : 'Delivery'}${who ? ` · ${who}` : ''}`}
          hint={isPickup ? 'Where the rider collects the package' : 'Where the package goes'}
          action={showSummary ? (
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${isPickup ? 'pickup' : 'delivery'}`} className={`${SMALL_BUTTON} justify-center`}><Pencil className="size-4" /></button>
              {otherHasLookup && <button type="button" onClick={clearLookup} aria-label="Remove this person" className={`${SMALL_BUTTON} justify-center text-rose-500`}><X className="size-4" /></button>}
            </div>
          ) : null}
        />

        {showSummary ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--bg-secondary)] p-3">
            {otherHasLookup && lookupResult.avatar
              ? <img src={lookupResult.avatar} className="size-9 shrink-0 rounded-full object-cover" alt="" />
              : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[13px] font-bold text-[var(--accent)]">{(form[`${prefix}_name`] || '?')[0]}</span>}
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="truncate font-semibold">{form[`${prefix}_name`]}{form[`${prefix}_phone`] ? <span className="font-normal text-[var(--text-secondary)]"> · {form[`${prefix}_phone`]}</span> : null}</p>
              <p className="truncate text-[12px] text-[var(--text-secondary)]">{placeLine || '—'}</p>
              {form[`${prefix}_landmark`] && <p className="truncate text-[12px] italic text-[var(--text-secondary)]">“{form[`${prefix}_landmark`]}”</p>}
            </div>
          </div>
        ) : (
          <>
            {/* Send to (or collect from) someone on Auradime: fills their details in one go. */}
            {isOther && user && !lookupResult && (
              findOpen || lookupResults.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-[var(--glass-border)] p-3">
                  <div className="flex gap-2">
                    <input value={lookupQuery} onChange={e => setLookupQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      className={`${FIELD} min-w-0`} placeholder="Username, phone or email" aria-label="Find an Auradime user" autoFocus />
                    <button type="button" onClick={handleLookup} disabled={lookupLoading || lookupQuery.length < 3} className={`${SMALL_BUTTON} shrink-0`}>
                      {lookupLoading ? <Loader2 className="size-4 animate-spin" /> : 'Find'}
                    </button>
                  </div>
                  {lookupMsg && <p className="text-[12px] text-rose-500">{lookupMsg}</p>}
                  {lookupResults.length > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-[12px] text-[var(--text-secondary)]">Several accounts match. Choose one:</p>
                      {lookupResults.map(u => (
                        <button key={u._id} type="button" onClick={() => selectLookupUser(u)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--glass-border)] p-2.5 text-left hover:border-[var(--accent)]/40">
                          {u.avatar ? <img src={u.avatar} className="size-9 rounded-full object-cover" alt="" /> : <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[13px] font-bold text-[var(--accent)]">{u.name?.[0]}</span>}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">{u.name}</span>
                            <span className="block truncate text-[11px] text-[var(--text-secondary)]">{[u.username && `@${u.username}`, [u.address?.quartier, u.address?.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => { setFindOpen(false); setLookupResults([]); setLookupMsg(''); }} className={SMALL_BUTTON}>Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => setFindOpen(true)} className={SMALL_BUTTON}>
                  <UserIcon className="size-4 text-[var(--accent)]" /> Find the {person.toLowerCase()} on Auradime
                </button>
              )
            )}
            {otherHasLookup && (
              <p className="flex items-center gap-2 rounded-2xl bg-[var(--accent)]/5 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                <UserIcon className="size-4 text-[var(--accent)]" /> Linked to {lookupResult.name}
              </p>
            )}

            <div className="space-y-5">
              <h3 className={LABEL}>Where</h3>
              {locationPickerEnabled ? (
                // Saved places (only when there are some), a place search with map pin, and an optional description.
                <AddressField
                  label={isPickup ? 'Pickup place' : 'Delivery place'}
                  value={{ address_id: form[`${prefix}_address_id`] || '', zone_id: form[`${prefix}_zone_id`], quartier: form[`${prefix}_quartier`], district: form[`${prefix}_district`], city: form[`${prefix}_city`], location: form[`${prefix}_location`] || null, place_name: form[`${prefix}_street`] || '', landmark: form[`${prefix}_landmark`] || '' }}
                  onChange={(v) => setForm(p => ({
                    ...p,
                    [`${prefix}_address_id`]: v.address_id || '',
                    [`${prefix}_zone_id`]: v.zone_id || '', [`${prefix}_quartier`]: v.quartier || '', [`${prefix}_district`]: v.district || '',
                    [`${prefix}_city`]: v.city || p[`${prefix}_city`], [`${prefix}_location`]: v.location || null,
                    [`${prefix}_street`]: v.place_name || '', [`${prefix}_landmark`]: v.landmark || '',
                    // A saved address brings its contact when the fields are still empty.
                    ...(v.address_id ? { [`${prefix}_name`]: p[`${prefix}_name`] || v.recipient_name || '', [`${prefix}_phone`]: p[`${prefix}_phone`] || v.contact_phone || '' } : {}),
                  }))}
                />
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor={`${prefix}-city`}>City</label>
                    <select id={`${prefix}-city`} value={form[`${prefix}_city`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_city`]: e.target.value, [`${prefix}_district`]: '', [`${prefix}_quartier`]: '', [`${prefix}_zone_id`]: '' }))} className={FIELD}>
                      <option value="">Select city</option>
                      {cities.map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                    </select>
                  </div>
                  {getDistrictOpts(form[`${prefix}_city`]).length > 0 && (
                    <div>
                      <label className={LABEL} htmlFor={`${prefix}-district`}>District</label>
                      <select id={`${prefix}-district`} value={form[`${prefix}_district`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_district`]: e.target.value, [`${prefix}_quartier`]: '', [`${prefix}_zone_id`]: '' }))} className={FIELD}>
                        <option value="">Select district</option>
                        {getDistrictOpts(form[`${prefix}_city`]).map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                      </select>
                    </div>
                  )}
                  {getQuartierOpts(form[`${prefix}_district`], form[`${prefix}_city`]).length > 0 && (
                    <div>
                      <label className={LABEL} htmlFor={`${prefix}-quartier`}>Quartier</label>
                      <select id={`${prefix}-quartier`} value={form[`${prefix}_quartier`]} onChange={e => {
                        const zone = getQuartierOpts(form[`${prefix}_district`], form[`${prefix}_city`]).find(z => z.name === e.target.value);
                        setForm(p => ({ ...p, [`${prefix}_quartier`]: e.target.value, [`${prefix}_zone_id`]: zone?._id || '' }));
                      }} className={FIELD}>
                        <option value="">Select quartier</option>
                        {getQuartierOpts(form[`${prefix}_district`], form[`${prefix}_city`]).map(z => <option key={z._id} value={z.name}>{z.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div><label className={LABEL} htmlFor={`${prefix}-street`}>Street or landmark</label><input id={`${prefix}-street`} value={form[`${prefix}_street`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_street`]: e.target.value }))} className={FIELD} placeholder="Building, gate, landmark" /></div>
                </div>
              )}

            </div>
            <div className="space-y-5">
              <h3 className={LABEL}>Who</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div><label className={LABEL} htmlFor={`${prefix}-name`}>{person}&apos;s name</label><input id={`${prefix}-name`} value={form[`${prefix}_name`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_name`]: e.target.value }))} className={FIELD} placeholder="Full name" autoComplete="off" /></div>
                <div><label className={LABEL} htmlFor={`${prefix}-phone`}>Phone</label><input id={`${prefix}-phone`} type="tel" inputMode="tel" value={form[`${prefix}_phone`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_phone`]: e.target.value }))} className={`${FIELD} tabular-nums`} placeholder="677 12 34 56" autoComplete="off" /></div>
              </div>
              <details open={Boolean(form[`${prefix}_email`])}>
                <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--accent)]">+ Add email (optional)</summary>
                <input type="email" value={form[`${prefix}_email`]} onChange={e => setForm(p => ({ ...p, [`${prefix}_email`]: e.target.value }))} className={`${FIELD} mt-2`} placeholder="email@example.com" aria-label={`${person}'s email`} />
              </details>

            </div>

            {canSummarise && editing && (
              <button type="button" onClick={() => setEditing(false)} className={`${SMALL_BUTTON} w-full justify-center`}><Check className="size-4 text-emerald-600" /> Done</button>
            )}
          </>
        )}
      </section>
    );
  };

  // ── Payment strategy ──────────────────────────────────────────────
  const isMomo = ['pawapay', 'payunit', 'eversend'].includes(form.payment_method);

  const momoProviders = [
    {
      id: 'pawapay',
      label: 'PawaPay',
      badge: 'Primary',
      description: 'MTN / Orange Mobile Money in Cameroon via PawaPay.',
      icon: Smartphone,
    },
    {
      id: 'payunit',
      label: 'PayUnit',
      badge: 'Fallback',
      description: 'MTN Mobile Money and Orange Money via PayUnit.',
      icon: Smartphone,
    },
    {
      id: 'eversend',
      label: 'Eversend',
      badge: '500 XAF min',
      description: 'Mobile money collection with a 500 XAF minimum.',
      icon: Smartphone,
    },
  ];

  const selectedMomo = momoProviders.find(o => o.id === form.payment_method) || momoProviders[0];

  const selectPaymentMethod = (method) => {
    setForm(prev => ({
      ...prev,
      payment_method: method,
      momo_phone: prev.momo_phone || (user?.phone || ''),
    }));
  };

  const STEPS = ['Pickup', 'Delivery', 'Package', 'Courier & payment', 'Done'];
  const summaries = ['pickup', 'dropoff'].map(prefix => [form[prefix + '_name'], form[prefix + '_phone'], form[prefix + '_street'] || form[prefix + '_quartier']].filter(Boolean).join(' \u00b7 '));
  summaries.push([PACKAGE_CATEGORIES.find(o => o.value === form.category)?.label, WEIGHT_TIERS.find(o => o.value === form.weight_tier)?.label, form.scheduled ? form.scheduled_date.replace('T', ' ') : 'As soon as possible'].join(' \u00b7 '));
  summaries.push((selectedQuote?.provider_name || 'Courier') + ' \u00b7 ' + (success?.price || selectedQuote?.price || 0).toLocaleString() + ' XAF');
  const errorNote = error ? (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3.5">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
      <p className="flex-1 text-[13px] text-rose-600">{error}</p>
      <button type="button" onClick={() => setError('')} aria-label="Dismiss" className="shrink-0 rounded-lg p-1 text-rose-400 hover:bg-rose-500/10"><X className="size-4" /></button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32 pt-4 sm:pt-6">
      <WhatsAppSupport />
      <div ref={formTopRef} className="mx-auto w-full max-w-[640px] scroll-mt-6 space-y-6 px-3 sm:px-4">
        {/* Header with quick links */}
        <header className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white"><Truck className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-bold leading-tight">Pickup & Delivery</h1>
            <p className="text-[12px] text-[var(--text-secondary)]">Send or receive a package anywhere in Cameroon</p>
          </div>
          <Link href="/delivery/track" className={`${SMALL_BUTTON} shrink-0`}><Search className="size-4 text-[var(--accent)]" /> Track</Link>
        </header>

        {step === 1 && <div className="space-y-5">
            <div role="radiogroup" aria-label="What do you want to do?" className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-1">
              {[['send', 'Send a package', Send], ['request_pickup', 'Request a pickup', ArrowDownToLine]].map(([value, label, Icon]) => (
                <button key={value} type="button" role="radio" aria-checked={direction === value} onClick={() => setDirection(value)}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-colors ${direction === value ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
            <p className="-mt-2 text-[12px] text-[var(--text-secondary)]">
              {direction === 'send' ? 'A rider collects from you and delivers to someone.' : 'A rider collects from someone and brings it to you.'}
            </p>

        </div>}

        {/* Progress */}
        <div className="space-y-1.5" aria-live="polite">
          <p className="text-[12px] font-semibold">Step {step} of 5 &middot; {STEPS[step - 1]}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${(step / 5) * 100}%` }} /></div>
        </div>

        {step > 1 && <div className="space-y-3">
          {STEPS.slice(0, step - 1).map((title, index) => (
            <div key={title} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--glass-border)] p-3">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <p className="min-w-0 flex-1 truncate text-[12px]"><span className="font-semibold">{title}</span><span className="text-[var(--text-secondary)]"> &middot; {summaries[index]}</span></p>
              {step < 5 && <button type="button" className={SMALL_BUTTON} onClick={() => goToStep(index + 1)}>Edit</button>}
            </div>
          ))}
        </div>}

        {/* Steps 1-3: one set of details at a time */}
        {step <= 3 && (
          <div className="space-y-6">
            {step === 1 && renderAddressBox('pickup', direction === 'send')}
            {step === 2 && renderAddressBox('dropoff', direction === 'request_pickup')}

            {step === 3 && <section aria-labelledby="pkg-title" className={CARD}>
              <CardTitle id="pkg-title" icon={Package} title="Package" hint="Helps the courier bring the right vehicle" />
              <Chips label="Category" options={PACKAGE_CATEGORIES} value={form.category} onChange={(v) => setForm(p => ({ ...p, category: v }))} />
              <Chips label="Weight" options={WEIGHT_TIERS} value={form.weight_tier} onChange={(v) => setForm(p => ({ ...p, weight_tier: v }))} />
              <details className="group rounded-2xl border border-[var(--glass-border)] px-3.5 py-2.5" open={Boolean(form.description || form.declared_value)}>
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[var(--text-secondary)]">Description and value (optional) <span className="text-[16px] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className={LABEL} htmlFor="pkg-desc">What is it?</label><input id="pkg-desc" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={FIELD} placeholder="e.g. Two pairs of shoes" /></div>
                  <div><label className={LABEL} htmlFor="pkg-value">Value</label>
                    <div className="relative"><input id="pkg-value" inputMode="numeric" value={form.declared_value} onChange={e => setForm(p => ({ ...p, declared_value: e.target.value.replace(/[^0-9]/g, '') }))} className={`${FIELD} pr-14 tabular-nums`} placeholder="0" />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-secondary)]">XAF</span></div>
                  </div>
                </div>
              </details>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--bg-secondary)] p-3.5">
                <input type="checkbox" checked={form.prohibited_confirmed} onChange={e => setForm(p => ({ ...p, prohibited_confirmed: e.target.checked }))} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--text-primary)]">No prohibited items inside (weapons, drugs, dangerous or illegal goods).</span>
              </label>
              <div className="space-y-5 border-t border-[var(--glass-border)] pt-5">
                <h3 className={LABEL}>Pickup time</h3>
                <Chips label="When" options={[{ value: 'now', label: 'As soon as possible' }, { value: 'later', label: 'Schedule' }]} value={form.scheduled ? 'later' : 'now'}
                  onChange={(v) => setForm(p => ({ ...p, scheduled: v === 'later' }))} />
                {(form.scheduled || error?.includes('not currently available')) && (
                  <label className={`${LABEL} relative block`}>
                    <span className="sr-only">Pickup date and time</span>
                    <input type="datetime-local" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                      min={minPickupDateTime()} className={`${FIELD} appearance-none`} style={form.scheduled_date ? undefined : { color: 'transparent' }} />
                    {/* iOS Safari / Android WebView draw an empty datetime field as a blank box: show our own prompt */}
                    {!form.scheduled_date && (
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                        <Clock className="size-4 text-[var(--accent)]" /> Tap to choose the date and time
                      </span>
                    )}
                  </label>
                )}
              </div>
            </section>}

            {errorNote}

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" disabled={step === 1} onClick={() => goToStep(step - 1)} className={`${SMALL_BUTTON} min-h-12 justify-center`}>Back</button>
            <button type="button" onClick={handleContinue} disabled={loading}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white disabled:opacity-50">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null} Continue <ChevronRight className="size-4" />
            </button>
            </div>
            {user && <Link href="/delivery/history" className="block text-center text-[12px] font-semibold text-[var(--accent)]">My deliveries</Link>}
          </div>
        )}

        {/* Step 4: courier and payment */}
        {step === 4 && (
          <div className="space-y-6">
            <section aria-labelledby="courier-title" className={CARD}>
              <CardTitle id="courier-title" icon={Truck} title="Courier & payment" hint={loading ? 'Finding couriers for your trip...' : `${quotes.length} available for this trip`} />
              {loading && <p role="status" className={HINT}>Loading quotes...</p>}
              {!loading && !quotes.length && <button type="button" className={SMALL_BUTTON} onClick={() => handleGetQuote(true)}>Retry quotes</button>}
              <div role="radiogroup" aria-labelledby="courier-title" className="space-y-2">
                {quotes.map(q => (
                  <Choice key={q.provider_id} selected={selectedQuote?.provider_id === q.provider_id} onClick={() => setSelectedQuote(q)}
                    leading={q.provider_logo ? <img src={q.provider_logo} className="size-10 rounded-xl object-cover" alt="" /> : null}
                    icon={Truck} title={q.provider_name}
                    sub={[q.estimated_delivery_minutes && `~${q.estimated_delivery_minutes} min`, q.provider_rating > 0 && `★ ${q.provider_rating.toFixed(1)}`].filter(Boolean).join(' · ') || 'Delivery partner'}
                    right={<span className="shrink-0 text-[14px] font-bold tabular-nums">{q.price?.toLocaleString()} <span className="text-[11px] font-semibold text-[var(--text-secondary)]">XAF</span></span>} />
                ))}
              </div>
              {selectedQuote && (
                <div className="space-y-1.5 rounded-2xl bg-[var(--bg-secondary)] p-3.5 text-[13px]">
                  <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Delivery</span><span className="tabular-nums">{selectedQuote.base_price?.toLocaleString()} XAF</span></div>
                  {selectedQuote.platform_fee > 0 && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Service fee</span><span className="tabular-nums">{selectedQuote.platform_fee.toLocaleString()} XAF</span></div>}
                  <div className="flex justify-between border-t border-[var(--glass-border)] pt-1.5 font-bold"><span>Total</span><span className="tabular-nums text-[var(--accent)]">{selectedQuote.price?.toLocaleString()} XAF</span></div>
                </div>
              )}
              <div className="space-y-5 border-t border-[var(--glass-border)] pt-5">
                <h3 id="pay-title" className={LABEL}>Payment</h3>
                <p className={HINT}>Choose how you would like to pay.</p>
                <div role="radiogroup" aria-labelledby="pay-title" className="space-y-2">
                  {user && (
                    <Choice selected={form.payment_method === 'wallet'} onClick={() => setForm(prev => ({ ...prev, payment_method: 'wallet' }))}
                      icon={Wallet} title="Aura Wallet" sub={`Balance: ${displayedWalletBalance.toLocaleString()} XAF`} />
                  )}
                  <Choice selected={isMomo} onClick={() => { if (!isMomo) selectPaymentMethod('pawapay'); }}
                    icon={Smartphone} title="Mobile Money" sub="MTN or Orange Money: approve on your phone" />
                </div>
                {isMomo && (
                  <div className="space-y-5 rounded-2xl bg-[var(--bg-secondary)] p-4">
                    <Chips label="Pay with" options={momoProviders.map(o => ({ value: o.id, label: o.label }))} value={form.payment_method} onChange={selectPaymentMethod} />
                    <p className={HINT}>{selectedMomo.description}</p>
                    <div><label className={LABEL} htmlFor="momo-phone">Mobile Money number</label>
                      <input id="momo-phone" type="tel" inputMode="tel" value={form.momo_phone} onChange={e => setForm(prev => ({ ...prev, momo_phone: e.target.value }))} placeholder="6XX XXX XXX" className={`${FIELD} tabular-nums`} /></div>
                  </div>
                )}
              </div>
            </section>

            {errorNote}

            <div className="flex flex-col-reverse gap-3 sm:grid sm:grid-cols-[1fr_2fr]">
              <button type="button" onClick={() => goToStep(3)} className="min-h-12 rounded-2xl border border-[var(--glass-border)] text-[14px] font-semibold">Back</button>
              <button type="button" onClick={handleBook} disabled={loading || !selectedQuote}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white disabled:opacity-50">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirm & pay{selectedQuote ? ` ${selectedQuote.price?.toLocaleString()} XAF` : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: booked, or waiting for Mobile Money approval */}
        {step === 5 && success && (
          <div className="space-y-6">
            {pendingPayment && !pendingPayment.timedOut && (
              <section aria-labelledby="done-title" className={`${CARD} text-center`}>
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500 text-white"><Loader2 className="size-7 animate-spin" /></span>
                <h2 id="done-title" className="text-[16px] font-semibold">Approve the payment on your phone</h2>
                <p className="text-[13px] text-[var(--text-secondary)]">A Mobile Money prompt was sent. Enter your PIN to confirm.</p>
                <p className="text-[22px] font-bold tabular-nums text-amber-600">{(pendingPayment.gross_amount || success.price)?.toLocaleString()} XAF</p>
                {pendingPayment.collection_fee > 0 && <p className="text-[11px] text-[var(--text-secondary)]">Includes {pendingPayment.collection_fee?.toLocaleString()} XAF Mobile Money fee</p>}
              </section>
            )}
            {pendingPayment?.timedOut && (
              <section aria-labelledby="done-title" className={`${CARD} text-center`}>
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-500 text-white"><AlertCircle className="size-7" /></span>
                <h2 id="done-title" className="text-[16px] font-semibold">Payment not confirmed yet</h2>
                <p className="text-[13px] text-[var(--text-secondary)]">If you approved it, it may still go through. You can follow the delivery or try again.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => router.push(`/delivery/track?code=${success.tracking_code}`)} className="min-h-12 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white">Track</button>
                  <button type="button" onClick={() => { setPendingPayment(null); setStep(4); setSuccess(null); }} className="min-h-12 rounded-2xl border border-[var(--glass-border)] text-[14px] font-semibold">Try again</button>
                </div>
              </section>
            )}
            {!pendingPayment && (
              <section aria-labelledby="done-title" className={`${CARD} text-center`}>
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="size-7" /></span>
                <h2 id="done-title" className="text-[16px] font-semibold">Delivery booked</h2>
                <p className="text-[13px] text-[var(--text-secondary)]">We will tell you when a rider is on the way.</p>
                <div className="rounded-2xl bg-[var(--bg-secondary)] p-3.5">
                  <p className="text-[11px] text-[var(--text-secondary)]">Tracking code</p>
                  <p className="font-mono text-[18px] font-bold tracking-wider text-[var(--accent)]">{success.tracking_code}</p>
                </div>
              </section>
            )}
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-2xl border border-[var(--glass-border)] p-3.5"><p className="text-[11px] text-[var(--text-secondary)]">Amount</p><p className="mt-0.5 text-[16px] font-bold tabular-nums">{success.price?.toLocaleString()} XAF</p></div>
              <div className="rounded-2xl border border-[var(--glass-border)] p-3.5"><p className="text-[11px] text-[var(--text-secondary)]">Payment</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${success.payment_status === 'paid' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'}`}>{success.payment_status === 'paid' ? 'Paid' : 'Pending'}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => router.push(`/delivery/track?code=${success.tracking_code}`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white"><Package className="size-4" /> Track it</button>
              <button type="button" onClick={() => { goToStep(1); setSuccess(null); setPendingPayment(null); if (paymentPollRef.current) clearInterval(paymentPollRef.current); setQuotes([]); setSelectedQuote(null); }} className="min-h-12 rounded-2xl border border-[var(--glass-border)] text-[14px] font-semibold">Book another</button>
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
