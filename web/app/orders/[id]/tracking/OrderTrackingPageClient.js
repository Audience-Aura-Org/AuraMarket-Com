"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Truck, CheckCircle2, MapPin,
  ArrowLeft, Phone, MessageCircle, AlertCircle,
  Clock, ShieldCheck, Loader2, RefreshCw
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';

const STATUS_STEP_MAP = {
  pending: 0,
  placed: 0,
  confirmed: 1,
  processing: 1,
  shipped: 2,
  in_transit: 2,
  out_for_delivery: 2,
  delivered: 3,
  completed: 3,
};

const STEP_ICONS = [Package, Clock, Truck, CheckCircle2];

const POLL_MS = 30_000;

export default function OrderTrackingPageClient() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId || orderId === '__placeholder__') return;
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data?.success) setOrder(res.data.data || res.data.order || null);
    } catch (err) {
      setError('Unable to load order details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchOrder();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchOrder(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchOrder]);

  const status = order?.status || 'pending';
  const activeStep = STATUS_STEP_MAP[status] ?? 0;
  const trackingNumber = order?.tracking_number || order?.order_number || orderId;

  const steps = [
    {
      label: 'Order Placed',
      desc: order?.status === 'pending' ? 'Awaiting vendor confirmation' : 'Vendor confirmed your order',
      time: order?.created_at ? new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    },
    {
      label: 'Processing',
      desc: 'Vendor is preparing your items',
      time: order?.confirmed_at ? new Date(order.confirmed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    },
    {
      label: 'In Transit',
      desc: order?.logistics_company ? `On its way with ${order.logistics_company}` : 'On its way to you',
      time: order?.shipped_at ? new Date(order.shipped_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    },
    {
      label: 'Delivered',
      desc: 'Secure hand-over completed',
      time: order?.delivered_at ? new Date(order.delivered_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    },
  ];

  const statusLabel = {
    pending: 'Pending',
    placed: 'Order Placed',
    confirmed: 'Processing',
    processing: 'Processing',
    shipped: 'In Transit',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    completed: 'Delivered',
  }[status] || status;

  const deliveryAddress = order?.delivery_address;
  const locationLine = deliveryAddress
    ? [deliveryAddress.quartier, deliveryAddress.city, deliveryAddress.region].filter(Boolean).join(', ')
    : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-gray-900">Track Order #{trackingNumber?.toString().slice(-6) || '—'}</h1>
        <button onClick={fetchOrder} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <main className="max-w-xl mx-auto px-6 py-8">
        {loading && !order ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div className="glass p-8 rounded-[40px] mb-8 border border-white/60 shadow-xl shadow-indigo-100/50 relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px]" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl ${activeStep === 3 ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200 animate-pulse'}`}>
                  {(() => { const Icon = STEP_ICONS[activeStep] || Truck; return <Icon className="w-10 h-10" />; })()}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{statusLabel}</h2>
                {order?.estimated_delivery && (
                  <p className="text-gray-500 font-medium mt-1">
                    Expected: <span className="text-gray-900 font-bold">{new Date(order.estimated_delivery).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-10 pl-4 relative">
              <div className="absolute left-[33px] top-4 bottom-4 w-1 bg-gray-100 rounded-full" />
              {steps.map((s, i) => (
                <div key={i} className="flex gap-8 relative group">
                  <div className={`z-10 w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-4 border-white shadow-md transition-all ${i <= activeStep ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-300'}`}>
                    {i < activeStep
                      ? <CheckCircle2 className="w-5 h-5" />
                      : i === activeStep
                        ? <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                        : <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className={`font-bold tracking-tight ${i <= activeStep ? 'text-gray-900' : 'text-gray-300'}`}>{s.label}</h4>
                      <span className="text-[11px] font-semibold text-gray-300 tracking-tight">{s.time}</span>
                    </div>
                    <p className={`text-sm font-medium leading-relaxed ${i <= activeStep ? 'text-gray-500' : 'text-gray-200'}`}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Controls */}
            <div className="mt-12 space-y-4">
              {locationLine && (
                <div className="p-6 rounded-[32px] bg-white border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-300">Delivery Address</p>
                      <p className="font-bold text-gray-900">{locationLine}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button className="p-5 rounded-[32px] bg-white border border-gray-100 flex flex-col items-center justify-center gap-3 group hover:bg-indigo-50 transition-all">
                  <Phone className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                  <span className="text-xs font-bold text-gray-900">Call Driver</span>
                </button>
                <button className="p-5 rounded-[32px] bg-white border border-gray-100 flex flex-col items-center justify-center gap-3 group hover:bg-purple-50 transition-all">
                  <MessageCircle className="w-6 h-6 text-gray-400 group-hover:text-purple-600" />
                  <span className="text-xs font-bold text-gray-900">Chat Dealer</span>
                </button>
              </div>
            </div>

            {/* Security / Escrow Info */}
            <div className="mt-10 p-6 rounded-[32px] bg-green-50/50 border border-green-100 flex items-center gap-4">
              <ShieldCheck className="w-10 h-10 text-green-600 shrink-0" />
              <p className="text-xs font-bold text-green-800 leading-relaxed">
                Funds for this order are held in Aura Escrow. Only confirm delivery once you have the item in hand and are satisfied.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
