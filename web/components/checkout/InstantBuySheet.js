'use client';
/**
 * Instant Buy Now: pay by Mobile Money first, give the delivery details after.
 *
 *   pay      area (prices the delivery) · delivery · total · MoMo number · Pay
 *   waiting  approve the prompt on the phone (polls like checkout)
 *   details  guests: name, phone, exact spot · signed-in: confirm saved address
 *   done     order number; guests are invited to create an account
 *
 * Visitors without an account get a hidden guest session (lib/guestSession);
 * the order and payment use the normal checkout endpoints.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Smartphone, X } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { clearGuestSession, ensureGuestSession } from '@/lib/guestSession';
import { authConfigFor, failInstantOrder, placeInstantOrder, sendDeliveryDetails } from '@/lib/instantBuy';
import { initiateSmartCameroonCollection, pollTransactionStatus } from '@/services/paymentProvider';
import { detectPawaPayProvider, estimateMobileMoneyFee, useMobileMoneyFeeRates } from '@/lib/mobileMoneyFees';
import AddressField, { loadSavedAddresses, spotFromSaved } from '@/components/location/AddressField';
import NetworkLogo from '@/components/wallet/NetworkLogo';
import { FIELD, LABEL } from '@/lib/formStyles';

const SELLER = 'vendor_managed';
const fmt = (n) => Number(n || 0).toLocaleString('fr-CM');
// "Bépanda" matches "bepanda": lower case, accents dropped.
const fold = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const BUTTON = 'flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white transition-opacity disabled:opacity-40';

export default function InstantBuySheet({ open, item, quantity = 1, variant, selectedOptions = [], fulfilmentType = null, onClose }) {
  const user = useAuthStore((s) => s.user);
  const feeRates = useMobileMoneyFeeRates();
  const needsAddress = !['pickup', 'dine_in'].includes(fulfilmentType);

  const [step, setStep] = useState('pay');
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [pickingArea, setPickingArea] = useState(false);
  const [firms, setFirms] = useState([]);
  const [intercity, setIntercity] = useState(false);
  const [firmId, setFirmId] = useState(SELLER);
  const [choosing, setChoosing] = useState(false);
  const [phone, setPhone] = useState(user?.phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [orderIds, setOrderIds] = useState([]);
  const [paid, setPaid] = useState(0);
  const [details, setDetails] = useState({ full_name: user?.name || '', phone: '', spot: {} });
  const stopPolling = useRef(null);
  const configRef = useRef({});

  useEffect(() => () => stopPolling.current?.(), []);

  // Areas, and the saved default address for signed-in buyers.
  useEffect(() => {
    if (!open || !needsAddress) return;
    let active = true;
    api.get('/logistics/zones').then((res) => {
      if (!active) return;
      const list = (res?.data?.data?.zones || []).filter((z) => z.type === 'quartier');
      setZones(list);
      if (!user) return;
      loadSavedAddresses().then((saved) => {
        if (!active) return;
        const def = saved.find((a) => a.isDefault) || saved[0];
        if (!def) return;
        const match = list.find((z) => z.name.toLowerCase() === String(def.quartier || '').toLowerCase());
        if (match) setZoneId(match._id);
        setDetails((d) => ({ ...d, full_name: def.recipient_name || d.full_name, phone: def.contact_phone || d.phone, spot: spotFromSaved(def) }));
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [open, needsAddress, user]);

  const zone = zones.find((z) => z._id === zoneId) || null;
  const areaMatches = useMemo(() => {
    const q = fold(areaQuery);
    if (!q) return [];
    return zones.filter((z) => fold(z.name).includes(q) || fold(z.parent_id?.name).includes(q)).slice(0, 8);
  }, [zones, areaQuery]);
  const pickArea = (id) => { setZoneId(id); setAreaQuery(''); setPickingArea(false); };

  // Delivery companies for the area. Distance-priced ones need the exact spot, so they stay in full checkout.
  useEffect(() => {
    if (!zone) return;
    let active = true;
    const params = new URLSearchParams({ vendor_ids: String(item?.vendorId || ''), quartier: zone.name, zone_id: zone._id });
    api.get(`/logistics/compatible-firms?${params}`).then((res) => {
      if (!active) return;
      const data = res?.data?.data || {};
      setIntercity(Boolean(data.is_intercity));
      setFirms((data.firms || []).filter((f) => f.pricing_mode !== 'distance' && f.fee_estimate != null));
      setFirmId(SELLER);
    }).catch(() => { if (active) setFirms([]); });
    return () => { active = false; };
  }, [zone, item?.vendorId]);

  const firm = firms.find((f) => f._id === firmId) || null;
  const subtotal = Number(item?.price || 0) * quantity;
  const delivery = firm ? Number(firm.fee_estimate || 0) : 0;
  const provider = detectPawaPayProvider(phone);
  const gateway = provider === 'ORANGE_MONEY_CMR' && !feeRates.pawapay_orange_enabled ? 'payunit' : 'pawapay';
  const total = useMemo(
    () => estimateMobileMoneyFee(subtotal + delivery, gateway, { provider, rates: feeRates }).grossAmount,
    [subtotal, delivery, gateway, provider, feeRates],
  );
  const canPay = phone.replace(/\D/g, '').length >= 9 && (!needsAddress || zone) && !intercity && !busy;

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const order = {
        productId: item.productId, quantity, variant, selected_options: selectedOptions,
        area: zone ? { quartier: zone.name, zone_id: zone._id } : {}, logisticsCompanyId: firmId, phone,
        fulfilment_type: fulfilmentType || undefined,
      };
      const place = async () => {
        if (!user) await ensureGuestSession();
        configRef.current = authConfigFor(user);
        return placeInstantOrder(order, configRef.current);
      };
      let placed;
      try {
        placed = await place();
      } catch (err) {
        // A guest session the server no longer knows (expired, cleaned up): start a new one, once.
        if (user || err?.response?.status !== 401) throw err;
        clearGuestSession();
        placed = await place();
      }
      const ids = placed.orderIds;
      const config = configRef.current;
      setOrderIds(ids);
      const res = await initiateSmartCameroonCollection({ amount: total, currency: 'XAF', phone, country: 'CM', order_ids: ids }, config);
      const reference = res?.data?.reference || res?.data?.transaction_id;
      if (!res?.success || !reference) throw new Error(res?.message || 'The payment could not start.');
      setPaid(Number(res.data?.gross_amount) || total);
      setDetails((d) => ({ ...d, phone: d.phone || phone }));
      setStep('waiting');
      stopPolling.current = pollTransactionStatus(res.gateway || gateway, reference, {
        onSuccess: () => setStep(needsAddress ? 'details' : 'done'),
        onFailed: ({ reason } = {}) => fail(ids, reason || 'The payment was declined.'),
        onTimeout: () => fail(ids, 'The payment was not approved in time.'),
      }, 5000, 300000, config);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'The payment could not start.');
      setStep('pay');
    } finally {
      setBusy(false);
    }
  };

  const fail = (ids, reason) => {
    failInstantOrder(ids, reason, configRef.current);
    setError(reason);
    setStep('failed');
  };

  const sendDetails = async () => {
    setBusy(true);
    setError('');
    try {
      const { spot } = details;
      await sendDeliveryDetails(orderIds[0], {
        full_name: details.full_name.trim() || undefined,
        phone: details.phone.trim(),
        landmark: spot.landmark || undefined,
        place_name: spot.place_name || undefined,
        location: spot.location || undefined,
      }, configRef.current);
      setStep('done');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save the address. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open || !item) return null;
  const canClose = step !== 'waiting' && !busy;
  const orderRef = orderIds[0] ? `#${String(orderIds[0]).slice(-6).toUpperCase()}` : '';

  return (
    <div className="fixed inset-0 z-[9500] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Buy now">
      <div className="absolute inset-0" onClick={() => canClose && onClose?.()} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] font-poppins shadow-2xl sm:max-w-md sm:rounded-[2rem]">
        <div className="mb-4 flex items-center gap-3">
          {item.image && <img src={item.image} alt="" className="size-12 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">{quantity} × {fmt(item.price)} XAF</p>
          </div>
          {canClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-full bg-[var(--bg-secondary)]">
              <X className="size-4" />
            </button>
          )}
        </div>

        {step === 'pay' && (
          <div className="space-y-4">
            {needsAddress && (
              zone && !pickingArea ? (
                // Saved or chosen area: shown, not asked again.
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 py-3 text-sm">
                  <span className="min-w-0 truncate"><span className="text-xs text-[var(--text-secondary)]">Delivering to</span> <span className="font-semibold">{zone.name}</span></span>
                  <button type="button" onClick={() => setPickingArea(true)} aria-label="Change area" className="shrink-0 text-xs font-semibold text-[var(--accent)]">Change</button>
                </div>
              ) : (
                <div>
                  <label htmlFor="ib-area" className={LABEL}>Delivery area</label>
                  <input id="ib-area" type="search" value={areaQuery} onChange={(e) => setAreaQuery(e.target.value)} placeholder="Search your area, e.g. Akwa" autoComplete="off" className={FIELD} role="combobox" aria-expanded={areaMatches.length > 0} aria-controls="ib-area-list" />
                  {areaMatches.length > 0 && (
                    <div id="ib-area-list" role="listbox" aria-label="Areas" className="mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1">
                      {areaMatches.map((z) => (
                        <button key={z._id} type="button" role="option" aria-selected={z._id === zoneId} aria-label={z.name} onClick={() => pickArea(z._id)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)]">
                          <span className="font-medium">{z.name}</span>
                          {z.parent_id?.name && <span className="text-[11px] text-[var(--text-secondary)]">{z.parent_id.name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {areaQuery.trim() && zones.length > 0 && areaMatches.length === 0 && (
                    <p className="mt-1.5 text-xs text-[var(--text-secondary)]">No area found. Try another spelling.</p>
                  )}
                </div>
              )
            )}

            {needsAddress && zone && !intercity && (
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span><span className="text-[var(--text-secondary)]">Delivery: </span><span className="font-semibold">{firm ? `${firm.company_name} · ${fmt(delivery)} XAF` : 'Seller delivers'}</span></span>
                  {firms.length > 0 && <button type="button" onClick={() => setChoosing((v) => !v)} className="font-semibold text-[var(--accent)]">Change</button>}
                </div>
                {choosing && (
                  <div className="mt-2 space-y-1.5" role="radiogroup" aria-label="Delivery">
                    {[{ _id: SELLER, company_name: 'Seller delivers', fee_estimate: 0 }, ...firms].map((f) => (
                      <label key={f._id} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs hover:bg-[var(--bg-primary)]">
                        <span className="flex items-center gap-2">
                          <input type="radio" name="ib-firm" checked={firmId === f._id} onChange={() => { setFirmId(f._id); setChoosing(false); }} aria-label={`${f.company_name} ${fmt(f.fee_estimate)} XAF`} />
                          {f.company_name}
                        </span>
                        <span className="tabular-nums text-[var(--text-secondary)]">{f._id === SELLER ? 'No agency fee' : `${fmt(f.fee_estimate)} XAF`}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {intercity && (
              <p className="rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-700">
                This area is in another city.{' '}
                <Link href={`/checkout?productId=${item.productId}&quantity=${quantity}`} className="font-semibold underline">Continue in checkout</Link>
              </p>
            )}

            <div>
              <label htmlFor="ib-phone" className={LABEL}>Mobile Money number</label>
              <div className="relative">
                <input id="ib-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" className={`${FIELD} pr-14`} />
                <NetworkLogo phone={phone} />
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-red-500" role="alert">{error}</p>}
            <button type="button" onClick={pay} disabled={!canPay} className={BUTTON}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : `Pay ${fmt(total)} XAF`}
            </button>
            <p className="text-center text-[11px] text-[var(--text-secondary)]">
              {needsAddress ? 'You give the exact spot right after paying.' : 'Mobile Money fee included.'}{' '}
              <Link href={`/checkout?productId=${item.productId}&quantity=${quantity}`} className="font-semibold text-[var(--accent)]">More payment options</Link>
            </p>
          </div>
        )}

        {step === 'waiting' && (
          <div className="space-y-3 py-6 text-center">
            <Smartphone className="mx-auto size-10 text-[var(--accent)]" />
            <p className="text-sm font-semibold">Approve the prompt on your phone</p>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">{fmt(paid)} XAF to {phone}</p>
            <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-secondary)]" />
          </div>
        )}

        {step === 'failed' && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm font-semibold text-red-500">{error}</p>
            <button type="button" onClick={() => { setError(''); setStep('pay'); }} className={BUTTON}>Try again</button>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 tabular-nums">
              <CheckCircle2 className="size-5" /> Payment confirmed · {fmt(paid)} XAF
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{user ? 'Check where we deliver.' : 'Where should we deliver?'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ib-name" className={LABEL}>Your name</label>
                <input id="ib-name" value={details.full_name} onChange={(e) => setDetails((d) => ({ ...d, full_name: e.target.value }))} className={FIELD} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="ib-contact" className={LABEL}>Phone</label>
                <input id="ib-contact" type="tel" value={details.phone} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} className={FIELD} autoComplete="tel" />
              </div>
            </div>
            <AddressField label="Exact spot" value={details.spot} showSaved={Boolean(user)} onChange={(spot) => setDetails((d) => ({ ...d, spot }))} />
            {error && <p className="text-xs font-semibold text-red-500" role="alert">{error}</p>}
            <button type="button" onClick={sendDetails} disabled={busy || !details.phone.trim()} className={BUTTON}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : user ? 'Confirm address' : 'Send delivery details'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <div>
              <p className="text-base font-semibold">Order placed</p>
              <p className="text-xs text-[var(--text-secondary)]">Order {orderRef} · the seller has been told.</p>
            </div>
            {user ? (
              <Link href={`/orders/${orderIds[0]}`} className={BUTTON}>View order</Link>
            ) : (
              <Link href="/login" className={BUTTON}>Create an account to keep your orders</Link>
            )}
            <button type="button" onClick={onClose} className="text-xs font-semibold text-[var(--text-secondary)]">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
