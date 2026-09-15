'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';
import {
  Package, MapPin, Clock, CheckCircle2, XCircle, Truck, AlertTriangle, Search, Loader2, Zap, User, MessageCircle, Send,
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

// Countdown Timer Component
function CountdownTimer({ estimatedDelivery }) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!estimatedDelivery) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(estimatedDelivery).getTime();
      const difference = deadline - now;

      if (difference <= 0) {
        setTimeRemaining('Delivery time passed');
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        if (days > 0) {
          setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [estimatedDelivery]);

  if (!estimatedDelivery) return null;

  return (
    <div className="flex items-center gap-2">
      <Zap className="size-4 text-[var(--accent)]" />
      <span className="font-mono font-bold text-[var(--accent)]">{timeRemaining}</span>
    </div>
  );
}

function TrackDeliveryContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [code, setCode] = useState(codeParam);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

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

  const fetchMessages = async (shipmentId) => {
    try {
      const res = await api.get(`/messages/shipment/${shipmentId}`);
      if (res.data?.success) {
        setMessages(res.data.data?.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !shipment) return;
    try {
      const res = await api.post(`/messages/shipment/${shipment._id}`, {
        text: messageInput.trim(),
      });
      if (res.data?.success) {
        setMessageInput('');
        setMessages([...messages, res.data.data.message]);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  useEffect(() => {
    if (codeParam) fetchShipment(codeParam);
  }, [codeParam]);

  useEffect(() => {
    if (shipment?._id) {
      fetchMessages(shipment._id);
    }
  }, [shipment?._id]);

  // Auto-refresh every 30 seconds if shipment is not delivered
  useEffect(() => {
    if (!autoRefresh || !shipment || ['delivered', 'cancelled', 'failed'].includes(shipment.status)) return;

    const interval = setInterval(() => {
      fetchShipment(shipment.tracking_code);
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, shipment]);

  const config = shipment ? STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending : null;
  const isDelivered = shipment && ['delivered', 'cancelled', 'failed'].includes(shipment.status);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32 pt-4">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-[var(--text-primary)]">Track Delivery</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Real-time shipment tracking with live updates</p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchShipment(code)}
            className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px] font-mono font-semibold outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 md:text-[13px]"
            placeholder="Enter tracking code (e.g., AURA-XXXXXX)"
          />
          <button
            onClick={() => fetchShipment(code)}
            disabled={loading}
            className="shrink-0 rounded-xl bg-[var(--accent)] px-5 py-3 text-white font-semibold text-[13px] disabled:opacity-50 flex items-center gap-2 hover:opacity-90 transition-all"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Track
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 mb-6">
            <p className="text-rose-600 text-[13px] font-semibold">{error}</p>
          </div>
        )}

        {/* Shipment Details */}
        {shipment && config && (
          <div className="space-y-4">
            {/* Status Card - Enhanced */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 p-6 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 rounded-xl bg-[var(--accent)]/10">
                    <config.icon className="size-6 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Current Status</p>
                    <p className="text-[20px] font-bold text-[var(--text-primary)] mt-1">{config.label}</p>
                    <p className="text-[12px] font-mono text-[var(--text-secondary)] mt-2">{shipment.tracking_code}</p>
                  </div>
                </div>
                {shipment.estimated_delivery && !isDelivered && (
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Estimated Arrival</p>
                    <CountdownTimer estimatedDelivery={shipment.estimated_delivery} />
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">{new Date(shipment.estimated_delivery).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Quick Info */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--glass-border)] text-[12px]">
                <div>
                  <span className="text-[var(--text-secondary)]">Price</span>
                  <p className="font-bold text-[var(--text-primary)]">{shipment.price?.toLocaleString()} XAF</p>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Direction</span>
                  <p className="font-bold text-[var(--text-primary)]">{shipment.direction === 'send' ? 'Sending' : 'Pickup Request'}</p>
                </div>
                {shipment.logistics_id?.company_name && (
                  <div>
                    <span className="text-[var(--text-secondary)]">Provider</span>
                    <p className="font-bold text-[var(--text-primary)]">{shipment.logistics_id.company_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-6 space-y-4">
              <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Route</h3>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <MapPin className="size-4 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Pickup Location</p>
                  <p className="text-[13px] text-[var(--text-primary)] mt-1 font-semibold">{[shipment.pickup_address?.street, shipment.pickup_address?.quartier, shipment.pickup_address?.city].filter(Boolean).join(', ')}</p>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 to-rose-500" />
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <MapPin className="size-4 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Delivery Location</p>
                  <p className="text-[13px] text-[var(--text-primary)] mt-1 font-semibold">{[shipment.delivery_address?.street, shipment.delivery_address?.quartier, shipment.delivery_address?.city].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            </div>

            {/* Package */}
            {shipment.package_details && (
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-6">
                <h3 className="font-bold text-[var(--text-primary)] text-[14px] mb-4 flex items-center gap-2">
                  <Package className="size-5" /> Package Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                  <div>
                    <p className="text-[var(--text-secondary)] text-[11px]">Category</p>
                    <p className="font-bold text-[var(--text-primary)] mt-1 capitalize">{shipment.package_details.category}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)] text-[11px]">Weight</p>
                    <p className="font-bold text-[var(--text-primary)] mt-1 capitalize">{shipment.package_details.weight_tier?.replace('_', ' ')}</p>
                  </div>
                  {shipment.package_details.declared_value > 0 && (
                    <div>
                      <p className="text-[var(--text-secondary)] text-[11px]">Value</p>
                      <p className="font-bold text-[var(--text-primary)] mt-1">{shipment.package_details.declared_value?.toLocaleString()} XAF</p>
                    </div>
                  )}
                  {shipment.package_details.description && (
                    <div className="col-span-2 md:col-span-4">
                      <p className="text-[var(--text-secondary)] text-[11px]">Description</p>
                      <p className="text-[var(--text-primary)] mt-1">{shipment.package_details.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sender & Recipient Details */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-6">
              <h3 className="font-bold text-[var(--text-primary)] text-[14px] mb-4 flex items-center gap-2">
                <User className="size-5" /> Parties Involved
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sender/Booker */}
                <div className="rounded-xl bg-[var(--bg-primary)] p-4">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-3">Sender</p>
                  {shipment.booked_by ? (
                    <>
                      <p className="font-bold text-[var(--text-primary)]">{shipment.booked_by.name}</p>
                      {shipment.booked_by.phone && <p className="text-[12px] text-[var(--text-secondary)] mt-1">{shipment.booked_by.phone}</p>}
                      {shipment.booked_by.email && <p className="text-[12px] text-[var(--text-secondary)]">{shipment.booked_by.email}</p>}
                    </>
                  ) : shipment.guest_booker ? (
                    <>
                      <p className="font-bold text-[var(--text-primary)]">{shipment.guest_booker.name}</p>
                      {shipment.guest_booker.phone && <p className="text-[12px] text-[var(--text-secondary)] mt-1">{shipment.guest_booker.phone}</p>}
                      {shipment.guest_booker.email && <p className="text-[12px] text-[var(--text-secondary)]">{shipment.guest_booker.email}</p>}
                    </>
                  ) : (
                    <p className="text-[12px] text-[var(--text-secondary)]">—</p>
                  )}
                </div>

                {/* Recipient */}
                <div className="rounded-xl bg-[var(--bg-primary)] p-4">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-3">Recipient</p>
                  {shipment.other_party?.name ? (
                    <>
                      <p className="font-bold text-[var(--text-primary)]">{shipment.other_party.name}</p>
                      {shipment.other_party.phone && <p className="text-[12px] text-[var(--text-secondary)] mt-1">{shipment.other_party.phone}</p>}
                      {shipment.other_party.email && <p className="text-[12px] text-[var(--text-secondary)]">{shipment.other_party.email}</p>}
                    </>
                  ) : (
                    <p className="text-[12px] text-[var(--text-secondary)]">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Messaging */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-6">
              <h3 className="font-bold text-[var(--text-primary)] text-[14px] mb-4 flex items-center gap-2">
                <MessageCircle className="size-5" /> Messages
              </h3>
              <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-secondary)] text-center py-6">No messages yet. Start a conversation!</p>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className="rounded-lg bg-[var(--bg-primary)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[12px] text-[var(--text-primary)]">{msg.sender_name || 'Unknown'}</p>
                          <p className="text-[12px] text-[var(--text-primary)] mt-1 break-words">{msg.text}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-2">{new Date(msg.timestamp).toLocaleString()}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Type your message..."
                  className="flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}
                  className="shrink-0 rounded-lg bg-[var(--accent)] p-2 text-white disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>

            {/* Timeline */}
            {shipment.shipment_logs?.length > 0 && (
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-6">
                <h3 className="font-bold text-[var(--text-primary)] text-[14px] mb-4 flex items-center gap-2">
                  <Clock className="size-5" /> Status Timeline
                </h3>
                <div className="space-y-4">
                  {[...shipment.shipment_logs].reverse().map((log, i) => {
                    const logConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex items-center justify-center">
                          <div className="size-3 rounded-full bg-[var(--accent)] mt-1.5 ring-4 ring-[var(--accent)]/20" />
                        </div>
                        <div className="flex-1 pb-4 last:pb-0">
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] font-bold text-[var(--text-primary)] capitalize">{log.status?.replace(/_/g, ' ')}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">{new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                          {log.note && <p className="text-[11px] text-[var(--text-secondary)] mt-1">{log.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proof of delivery */}
            {shipment.proof_of_delivery?.timestamp && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <h3 className="font-bold text-emerald-600 text-[14px] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="size-5" /> Proof of Delivery
                </h3>
                <div className="text-[12px] space-y-2">
                  {shipment.proof_of_delivery.receiver_name && <p>Received by: <strong className="text-[var(--text-primary)]">{shipment.proof_of_delivery.receiver_name}</strong></p>}
                  {shipment.proof_of_delivery.note && <p>Note: <span className="text-[var(--text-primary)]">{shipment.proof_of_delivery.note}</span></p>}
                  <p className="text-emerald-600 font-semibold">{new Date(shipment.proof_of_delivery.timestamp).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link href="/delivery" className="inline-block rounded-xl bg-[var(--accent)] px-6 py-3 text-white font-semibold text-[13px] hover:opacity-90 transition-all">
            Book a Delivery
          </Link>
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
