'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';
import {
  Package, MapPin, Clock, CheckCircle2, XCircle, Truck, AlertTriangle, Search, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG = {
  pending:          { color: 'amber',   icon: Clock,         label: 'Pending' },
  assigned:         { color: 'blue',    icon: Truck,         label: 'Assigned' },
  picked_up:        { color: 'blue',    icon: Package,       label: 'Picked Up' },
  in_transit:       { color: 'blue',    icon: Truck,         label: 'In Transit' },
  out_for_delivery: { color: 'violet',  icon: MapPin,        label: 'Out for Delivery' },
  delivered:        { color: 'emerald', icon: CheckCircle2,  label: 'Delivered' },
  failed:           { color: 'rose',    icon: AlertTriangle, label: 'Failed' },
  cancelled:        { color: 'gray',    icon: XCircle,       label: 'Cancelled' },
};

function TrackDeliveryContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [code, setCode] = useState(codeParam);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [error, setError] = useState('');

  const fetchShipment = async (trackingCode) => {
    if (!trackingCode) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/p2p/track/${trackingCode.trim().toUpperCase()}`);
      if (res.data?.success) {
        setShipment(res.data.data.shipment);
      } else {
        setError('Shipment not found');
        setShipment(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Shipment not found');
      setShipment(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (codeParam) fetchShipment(codeParam);
  }, [codeParam]);

  const config = shipment ? STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32 pt-4">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Track Delivery</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Enter your tracking code to see delivery status</p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <input value={code} onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchShipment(code)}
            className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[16px] font-mono font-semibold outline-none transition-all focus:border-[var(--accent)] md:text-[14px]"
            placeholder="AURA-XXXXXX" />
          <button onClick={() => fetchShipment(code)} disabled={loading}
            className="shrink-0 rounded-xl bg-[var(--accent)] px-5 text-white font-semibold text-[13px] disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Track
          </button>
        </div>

        {error && <p className="text-rose-500 text-[13px] font-medium mb-4">{error}</p>}

        {/* Shipment Details */}
        {shipment && config && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className={`rounded-2xl border p-5 border-${config.color}-500/20 bg-${config.color}-500/5`}>
              <div className="flex items-center gap-3 mb-3">
                <config.icon className={`size-8 text-${config.color}-500`} />
                <div>
                  <p className={`text-lg font-bold text-${config.color}-600`}>{config.label}</p>
                  <p className="text-[12px] font-mono text-[var(--text-secondary)]">{shipment.tracking_code}</p>
                </div>
              </div>
              <div className="flex gap-4 text-[12px] text-[var(--text-secondary)]">
                <span>Price: <strong>{shipment.price?.toLocaleString()} XAF</strong></span>
                <span>Direction: <strong>{shipment.direction === 'send' ? 'Sending' : 'Pickup Request'}</strong></span>
              </div>
            </div>

            {/* Addresses */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)]">PICKUP</p>
                  <p className="text-[13px] text-[var(--text-primary)]">{[shipment.pickup_address?.street, shipment.pickup_address?.quartier, shipment.pickup_address?.city].filter(Boolean).join(', ')}</p>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-[var(--glass-border)] ml-2 h-4" />
              <div className="flex items-start gap-3">
                <MapPin className="size-4 text-rose-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)]">DELIVERY</p>
                  <p className="text-[13px] text-[var(--text-primary)]">{[shipment.delivery_address?.street, shipment.delivery_address?.quartier, shipment.delivery_address?.city].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            </div>

            {/* Package */}
            {shipment.package_details && (
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5">
                <h3 className="font-bold text-[var(--text-primary)] text-[14px] mb-2">Package</h3>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><span className="text-[var(--text-secondary)]">Category:</span> <strong className="capitalize">{shipment.package_details.category}</strong></div>
                  <div><span className="text-[var(--text-secondary)]">Weight:</span> <strong className="capitalize">{shipment.package_details.weight_tier?.replace('_', ' ')}</strong></div>
                  {shipment.package_details.declared_value > 0 && (
                    <div><span className="text-[var(--text-secondary)]">Value:</span> <strong>{shipment.package_details.declared_value?.toLocaleString()} XAF</strong></div>
                  )}
                  {shipment.package_details.description && (
                    <div className="col-span-2"><span className="text-[var(--text-secondary)]">Note:</span> {shipment.package_details.description}</div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            {shipment.shipment_logs?.length > 0 && (
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5">
                <h3 className="font-bold text-[var(--text-primary)] text-[14px] mb-3">Timeline</h3>
                <div className="space-y-3">
                  {[...shipment.shipment_logs].reverse().map((log, i) => {
                    const logConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`size-2 rounded-full bg-${logConfig.color}-500 mt-1.5 shrink-0`} />
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] capitalize">{log.status?.replace(/_/g, ' ')}</p>
                          {log.note && <p className="text-[11px] text-[var(--text-secondary)]">{log.note}</p>}
                          <p className="text-[10px] text-[var(--text-secondary)]">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proof of delivery */}
            {shipment.proof_of_delivery?.timestamp && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <h3 className="font-bold text-emerald-600 text-[14px] mb-2">Proof of Delivery</h3>
                <div className="text-[12px] space-y-1">
                  {shipment.proof_of_delivery.receiver_name && <p>Received by: <strong>{shipment.proof_of_delivery.receiver_name}</strong></p>}
                  {shipment.proof_of_delivery.note && <p>Note: {shipment.proof_of_delivery.note}</p>}
                  <p className="text-[var(--text-secondary)]">{new Date(shipment.proof_of_delivery.timestamp).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/delivery" className="text-[var(--accent)] text-[13px] font-semibold">Book a Delivery</Link>
        </div>
      </div>
    </div>
  );
}

export default function TrackDeliveryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
      </div>
    }>
      <TrackDeliveryContent />
    </Suspense>
  );
}
