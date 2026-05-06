"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, ChevronLeft, Calendar, MapPin, 
  ShoppingBag, ShieldCheck, Truck, CheckCircle2, 
  AlertTriangle, MessageSquare, ExternalLink, ArrowRight,
  Info, Loader2, Wallet, XCircle, Star, Box, 
  CreditCard, Receipt, Clock, ArrowUpRight, Share2, 
  Printer, Eye, CornerDownRight, Scale, Phone, Store, Sparkles,
  Activity, Layers, Fingerprint, Navigation, History, Signal, Zap, User
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SingleOrderView({ orderId, onBack }) {
  const [order, setOrder] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeData, setDisputeData] = useState({ reason: 'item_not_received', description: '' });
  const [disputeLoading, setDisputeLoading] = useState(false);

  const [reviewModal, setReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '', product_id: null });
  const [reviewLoading, setReviewLoading] = useState(false);
  
  const { user } = useAuthStore();

  const fetchOrderManifest = async () => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) {
        setOrder(res.data.data.order);
        setShipments(res.data.data.shipments || []);
      }
    } catch (err) {
      toast.error("Failed to load order manifest.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    const toastId = toast.loading('Generating invoice PDF...');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('aura_token') : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/orders/${orderId}/invoice`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!response.ok) throw new Error('Invoice generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Invoice downloaded!', { id: toastId });
    } catch (err) {
      toast.error('Failed to download invoice.', { id: toastId });
    }
  };

  useEffect(() => {
    if (orderId) fetchOrderManifest();
  }, [orderId]);

  useEffect(() => {
    if (!orderId || !user?._id) return;
    const handleUpdate = (notif) => {
      if (notif.metadata?.order_id?.toString() === orderId.toString()) {
        fetchOrderManifest();
        toast.success(`Logistics update: ${notif.title || 'Manifest synced'}`, {
          icon: '⚡',
          style: { borderRadius: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)', fontSize: '11px', fontWeight: 'bold' }
        });
      }
    };
    socketService.on('notification', handleUpdate);
    return () => socketService.off('notification', handleUpdate);
  }, [orderId, user?._id]);

  const handleRaiseDispute = async (e) => {
    e.preventDefault();
    setDisputeLoading(true);
    try {
      const res = await api.post('/disputes', { order_id: orderId, reason: disputeData.reason, description: disputeData.description });
      if (res.data.success) {
        toast.success("Dispute formal protocol initiated.");
        setDisputeModal(false);
        fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Protocol handshake failed.");
    } finally {
      setDisputeLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirm("Confirm asset arrival? This releases escrowed funds to the vendor node.")) return;
    try {
      const res = await api.post(`/escrow/release/${orderId}`);
      if (res.data.success) {
        toast.success("Funds released. Order finalized.");
        fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Release vector blocked.");
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewLoading(true);
    try {
      const res = await api.post('/reviews', { order_id: orderId, product_id: reviewData.product_id, rating: reviewData.rating, comment: reviewData.comment });
      if (res.data.success) {
        toast.success("Feedback broadcasted to Aura network.");
        setReviewModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Protocol failure.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center">
      <div className="size-12 border-2 border-[var(--accent)]/10 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
      <p className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--accent)]">Syncing manifest...</p>
    </div>
  );

  if (!order) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
       <AlertTriangle className="size-12 text-red-500 mb-4 opacity-20" />
       <h1 className="text-2xl font-bold tracking-tighter mb-2">Manifest lost</h1>
       <button onClick={onBack} className="px-10 py-3 bg-[var(--accent)] text-white rounded-full text-[11px] lg:text-[12px] font-bold tracking-tight shadow-xl shadow-[var(--accent)]/20 transition-all">Return to ledger</button>
    </div>
  );

  const getStatusConfig = (orderStatus, shipmentStatus) => {
    // If we have a shipment status that indicates transit, prioritize it for the visual step
    if (['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(shipmentStatus?.toLowerCase())) {
      const labels = {
        assigned: 'Assigned to Carrier',
        picked_up: 'Picked Up',
        in_transit: 'In Transit',
        out_for_delivery: 'Out for Delivery'
      };
      return { 
        color: 'blue', 
        label: labels[shipmentStatus?.toLowerCase()] || 'In Transit', 
        icon: Truck, 
        step: 3 
      };
    }

    switch (orderStatus?.toLowerCase()) {
      case 'completed': 
      case 'delivered': return { color: 'emerald', label: 'Success', icon: CheckCircle2, step: 4 };
      case 'shipped': return { color: 'blue', label: 'In transit', icon: Truck, step: 3 };
      case 'processing': return { color: 'amber', label: 'Processing', icon: Clock, step: 2 };
      case 'placed': return { color: 'indigo', label: 'Initiated', icon: Package, step: 1 };
      case 'cancelled':
      case 'refunded': return { color: 'rose', label: 'Terminated', icon: XCircle, step: 0 };
      default: return { color: 'indigo', label: orderStatus ? orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1) : 'Unknown', icon: Package, step: 1 };
    }
  };

  const shipment = shipments[0];
  const status = getStatusConfig(order.order_status, shipment?.status);
  const isVendor = user?.role === 'vendor' || user?._id === order?.vendor_id?._id || user?._id === order?.vendor_id;
  const customer = order.customer_id;

  const STEPS = [
    { label: 'Ordered', icon: ShoppingBag },
    { label: 'Verified', icon: ShieldCheck },
    { label: 'Transit', icon: Truck },
    { label: 'Success', icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
         <div className="space-y-3">
            <button onClick={onBack} className="flex items-center gap-2 group w-fit">
               <div className="size-7 rounded-lg bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                  <ChevronLeft className="size-3" />
               </div>
               <span className="text-[10px] lg:text-[12px] font-bold tracking-widest capitalize opacity-40 group-hover:opacity-100 transition-opacity">Back</span>
            </button>
            <div className="flex items-center gap-3">
               <h1 className="text-2xl md:text-3xl font-black tracking-tighter leading-tight">
                  ORDER <span className="text-[var(--accent)]">MANIFEST</span>
               </h1>
               {isVendor && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] lg:text-[12px] font-black tracking-[0.2em] capitalize border border-[var(--accent)]/20 shadow-sm">MERCHANT</span>
               )}
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDownloadInvoice}
                className="size-10 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all group"
              >
                <Printer className="size-4 group-hover:scale-110 transition-transform" />
              </button>
              <button 
                className="size-10 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all group"
              >
                <Share2 className="size-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] backdrop-blur-2xl shadow-sm">
               <div className="size-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--glass-border)]">
                 <Fingerprint className="size-4 text-[var(--accent)]" />
               </div>
               <div className="space-y-0.5">
                 <p className="text-[10px] lg:text-[12px] font-bold tracking-[0.1em] text-[var(--text-secondary)] opacity-40 capitalize">Trace</p>
                 <h3 className="text-[10px] lg:text-[12px] font-bold font-mono tracking-widest capitalize text-[var(--accent)]">#{order._id.slice(-10)}</h3>
               </div>
               <div className="h-6 w-px bg-[var(--glass-border)]" />
               <div className="flex items-center gap-1.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] lg:text-[12px] font-black tracking-[0.1em] text-emerald-500 capitalize">Sync</span>
               </div>
            </div>
         </div>
      </div>

      <div className="mb-6">
         <div className="glass-panel p-6 md:p-8 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
               <Navigation className="size-32" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
               <div className="space-y-2">
                  <div className={`flex items-center gap-2 px-2 py-0.5 rounded-md border text-[10px] lg:text-[12px] font-black tracking-[0.15em] w-fit bg-${status.color}-500/10 text-${status.color}-500 border-${status.color}-500/20 capitalize`}>
                     <Signal className="size-2.5 animate-pulse" /> Telemetry Active
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter capitalize leading-none">{status.label}</h2>
               </div>

               <div className="flex flex-col gap-2 min-w-[180px]">
                  {order.order_status === 'shipped' && !isVendor && (
                    <button onClick={handleConfirmDelivery} className="w-full px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] lg:text-[12px] tracking-[0.1em] capitalize shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                       <CheckCircle2 className="size-3.5" /> CONFIRM ARRIVAL
                    </button>
                  )}
                  {isVendor && order.order_status === 'placed' && (
                    <button 
                      onClick={() => toast.success("Processing protocol initiated.")}
                      className="w-full px-8 py-3 bg-[var(--accent)] text-white rounded-xl font-black text-[10px] lg:text-[12px] tracking-[0.1em] capitalize shadow-lg shadow-[var(--accent)]/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       <Zap className="size-3.5" /> START PROCESSING
                    </button>
                  )}
                  <button onClick={() => setDisputeModal(true)} className="w-full px-8 py-3 bg-[var(--bg-primary)] text-rose-500 border border-rose-500/20 rounded-xl font-black text-[10px] lg:text-[12px] tracking-[0.1em] capitalize hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2 group">
                     <Scale className="size-3.5 group-hover:rotate-12 transition-transform" /> INTERVENTION
                  </button>
               </div>
            </div>

            <div className="relative pt-8 pb-4 px-4">
               <div className="absolute top-7 left-0 w-full h-[1px] bg-[var(--glass-border)]" />
               <div className="relative flex justify-between max-w-2xl mx-auto">
                  {STEPS.map((s, idx) => {
                     const isActive = status.step > idx;
                     const isCurrent = status.step === idx + 1;
                     return (
                       <div key={idx} className="flex flex-col items-center gap-2 relative z-10">
                          <div className={`size-8 rounded-lg flex items-center justify-center border transition-all duration-700 ${
                             isActive ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-md' : 
                             isCurrent ? 'bg-[var(--bg-primary)] border-[var(--accent)] text-[var(--accent)] animate-pulse' :
                             'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-20'
                          }`}>
                             <s.icon className="size-3.5" />
                          </div>
                          <span className={`text-[10px] lg:text-[12px] font-black tracking-[0.1em] capitalize ${isActive || isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-20'}`}>
                             {s.label}
                          </span>
                       </div>
                     );
                  })}
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-8 space-y-8">
            <div className="space-y-4">
               <div className="flex items-center gap-2 px-1">
                  <div className="h-2.5 w-[2px] bg-[var(--accent)]" />
                  <h3 className="text-[10px] lg:text-[12px] font-black tracking-[0.2em] text-[var(--text-secondary)] capitalize opacity-40">Operational Logs</h3>
               </div>

               <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
                  {shipment && shipment.shipment_logs?.length > 0 ? (
                    <div className="space-y-4">
                      {shipment.shipment_logs.slice().reverse().map((log, lIdx) => (
                         <div key={log._id} className="relative pl-6 border-l border-[var(--glass-border)] pb-4 last:pb-0 group">
                            <div className="absolute left-[-5px] top-0 size-2.5 rounded-full bg-[var(--bg-primary)] border-2 border-[var(--accent)] group-first:bg-[var(--accent)]" />
                            <div className="space-y-1">
                               <div className="flex items-center justify-between gap-4">
                                  <h4 className="text-[10px] lg:text-[12px] font-black tracking-tight text-[var(--text-primary)] capitalize">
                                     {log.status.replace('_', ' ')}
                                  </h4>
                                  <span className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-30 capitalize font-mono">
                                     {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </span>
                               </div>
                               {log.note && <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-50 leading-relaxed">{log.note}</p>}
                            </div>
                         </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 opacity-20">
                       <History className="size-8 mx-auto mb-3" />
                       <h4 className="text-[10px] lg:text-[12px] font-black tracking-[0.1em] capitalize">Sync Pending</h4>
                    </div>
                  )}
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex items-center gap-2 px-1">
                  <div className="h-2.5 w-[2px] bg-[var(--accent)]" />
                  <h3 className="text-[10px] lg:text-[12px] font-black tracking-[0.2em] text-[var(--text-secondary)] capitalize opacity-40">Manifested Assets</h3>
               </div>
               <div className="grid gap-3">
                  {order.products.map((item, idx) => (
                    <div key={item._id} className="group relative overflow-hidden bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-3 rounded-2xl flex flex-col md:flex-row items-center gap-4 hover:bg-[var(--bg-secondary)] transition-all">
                       <div className="relative size-16 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-sm shrink-0">
                          <img src={item.image || '/placeholder.png'} className="size-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt="" />
                       </div>
                       <div className="flex-1 text-center md:text-left space-y-1">
                          <Link href={`/stores/${order.vendor_id?._id || order.vendor_id}`} className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] lg:text-[12px] font-black tracking-[0.1em] text-[var(--text-secondary)] w-fit mx-auto md:mx-0 inline-flex items-center gap-1 capitalize"><Store className="size-2.5" /> {order.vendor_id?.store_name || 'NODE'}</Link>
                          <h3 className="text-sm font-black tracking-tight capitalize leading-none">{item.name} <span className="text-[var(--accent)] opacity-50 ml-2 font-mono">×{item.quantity}</span></h3>
                          <div className="text-[11px] lg:text-[12px] font-black text-[var(--accent)] font-mono">{(item.price || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-50">XAF</span></div>
                       </div>
                       <div className="flex flex-col gap-2 w-full md:w-auto">
                          {order.order_status === 'completed' && !isVendor && (
                             <button onClick={() => { setReviewData({ ...reviewData, product_id: item.product_id?._id || item.product_id }); setReviewModal(true); }} className="px-6 py-2 rounded-lg bg-[var(--accent)] text-white text-[10px] lg:text-[12px] font-black tracking-widest capitalize shadow-md shadow-[var(--accent)]/10 hover:scale-105 transition-all">FEEDBACK</button>
                          )}
                          <button className="px-6 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] text-[10px] lg:text-[12px] font-black tracking-widest capitalize hover:text-[var(--text-primary)] transition-colors">VERIFY</button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="lg:col-span-4 space-y-8">
            {/* Customer Details - Denser */}
            <div className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-3xl shadow-sm space-y-4 relative overflow-hidden">
               <h3 className="text-[10px] lg:text-[12px] font-black tracking-[0.2em] flex items-center gap-2 capitalize text-[var(--text-secondary)] opacity-40"><User className="size-3 text-[var(--accent)]" /> Client</h3>
               <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20 text-[var(--accent)] font-black text-sm capitalize">
                     {customer?.name?.[0] || 'C'}
                  </div>
                  <div className="min-w-0">
                     <h4 className="text-[12px] font-black tracking-tight truncate capitalize leading-none">{customer?.name || 'CONSIGNEE'}</h4>
                     <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 truncate capitalize tracking-tighter mt-1">{customer?.email || 'Offline'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]">
                  <Phone className="size-3 text-[var(--accent)]" />
                  <span className="text-[10px] lg:text-[12px] font-black font-mono tracking-widest text-[var(--text-primary)]">{order.shipping_address?.phone || customer?.phone || 'NO_DATA'}</span>
               </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 backdrop-blur-2xl shadow-sm space-y-4">
               <h3 className="text-[10px] lg:text-[12px] font-black tracking-[0.2em] flex items-center gap-2 capitalize text-[var(--text-secondary)] opacity-40"><Truck className="size-3 text-[var(--accent)]" /> Carrier</h3>
               {shipment && (shipment.logistics_id || shipment.logistics_company_id) ? (
                 <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] space-y-1">
                       <h4 className="text-[10px] lg:text-[12px] font-black tracking-widest capitalize">{(shipment.logistics_id?.company_name || shipment.logistics_company_id?.company_name || 'FIRM').slice(0, 20)}</h4>
                       <div className="flex items-center gap-2 text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40"><Phone className="size-2.5" /> {shipment.logistics_id?.contact_phone || 'SYNCING'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-between gap-3">
                       <code className="text-[10px] lg:text-[12px] font-black text-[var(--accent)] tracking-[0.1em]">{shipment.tracking_code || 'TC_PENDING'}</code>
                       <button onClick={() => { if(shipment.tracking_code) { navigator.clipboard.writeText(shipment.tracking_code); toast.success("Copied"); } }} className="size-5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all flex items-center justify-center"><Layers className="size-2.5" /></button>
                    </div>
                 </div>
               ) : (
                 <div className="text-center py-4 bg-[var(--bg-primary)]/20 rounded-xl border border-dashed border-[var(--glass-border)] opacity-30">
                    <p className="text-[10px] lg:text-[12px] font-black capitalize tracking-[0.2em]">ROUTING_PENDING</p>
                 </div>
               )}
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 backdrop-blur-2xl shadow-sm space-y-4">
               <h3 className="text-[10px] lg:text-[12px] font-black tracking-[0.2em] flex items-center gap-2 capitalize text-[var(--text-secondary)] opacity-40"><CreditCard className="size-3 text-[var(--accent)]" /> Settlement</h3>
               <div className="space-y-2 pb-4 border-b border-[var(--glass-border)]">
                  <div className="flex justify-between items-center text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize"><span>Assets</span><span className="font-mono">{(order.total_amount - (order.shipping_fee || 0)).toLocaleString()}</span></div>
                  <div className="flex justify-between items-center text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize"><span>Shipping</span><span className="font-mono">{(order.shipping_fee || 0).toLocaleString()}</span></div>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] lg:text-[12px] font-black text-[var(--accent)] capitalize">TOTAL</span>
                  <h2 className="text-xl font-black text-[var(--text-primary)] font-mono">{order.total_amount.toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-30">XAF</span></h2>
               </div>
               <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] space-y-2 shadow-inner">
                  <div className="flex items-center gap-2"><ShieldCheck className="size-2.5 text-emerald-500" /><p className="text-[10px] lg:text-[12px] font-black text-emerald-500 capitalize">Escrow Synced</p></div>
                  <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-full" /></div>
               </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl shadow-sm space-y-4">
               <h3 className="text-[10px] lg:text-[12px] font-black tracking-[0.2em] flex items-center gap-2 capitalize text-[var(--text-secondary)] opacity-40"><MapPin className="size-3 text-[var(--accent)]" /> Destination</h3>
               <div className="space-y-4">
                  <div className="space-y-2 bg-[var(--bg-secondary)]/50 p-4 rounded-xl border border-[var(--glass-border)]/30">
                     <h4 className="text-[12px] font-black capitalize tracking-tight text-[var(--text-primary)] mb-1">{order.shipping_address?.full_name || customer?.name || 'RECIPIENT'}</h4>
                     <div className="flex flex-col gap-1.5 text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)]">
                        <div className="flex items-start gap-2">
                           <MapPin className="size-3 text-[var(--accent)] mt-0.5 shrink-0" />
                           <span className="leading-relaxed opacity-90">
                              {[
                                 order.shipping_address?.street || order.shipping_address?.address,
                                 order.shipping_address?.quartier,
                                 order.shipping_address?.city,
                                 order.shipping_address?.region,
                                 order.shipping_address?.zipCode || order.shipping_address?.zip
                              ].filter(Boolean).join(', ') || 'DELIVERY_PROTOCOL_ACTIVE'}
                           </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                           <Phone className="size-3 text-[var(--accent)] opacity-70 shrink-0" />
                           <span className="font-mono tracking-widest opacity-90">{order.shipping_address?.phone || customer?.phone || 'NO_CONTACT_DATA'}</span>
                        </div>
                     </div>
                  </div>

                  {order.delivery_description && (
                     <div className="pt-3 border-t border-[var(--glass-border)] space-y-1.5">
                        <p className="text-[10px] lg:text-[12px] font-black text-[var(--text-secondary)] opacity-40 capitalize tracking-[0.2em]">LOGISTICS_PROTOCOL</p>
                        <p className="text-[10px] lg:text-[12px] font-medium text-indigo-400 leading-relaxed italic bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                           "{order.delivery_description}"
                        </p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>

      <AnimatePresence>
        {disputeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDisputeModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg glass-panel rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] p-10 shadow-2xl">
               <div className="space-y-8">
                  <h2 className="text-2xl font-bold tracking-tighter">Intervention</h2>
                  <form onSubmit={handleRaiseDispute} className="space-y-6">
                     <div className="space-y-3">
                        <label className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-secondary)] ml-3">Reason</label>
                        <select value={disputeData.reason} onChange={e => setDisputeData({ ...disputeData, reason: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-6 py-4 text-[11px] lg:text-[12px] font-bold tracking-tight outline-none focus:border-[var(--accent)] transition-all">
                           <option value="item_not_received">Asset not manifested</option>
                           <option value="different_from_description">Registry mismatch</option>
                           <option value="quality_issues">Structural defects</option>
                           <option value="other">Protocol violation</option>
                        </select>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-secondary)] ml-3">Manifest</label>
                        <textarea required rows={4} placeholder="Document violation..." value={disputeData.description} onChange={e => setDisputeData({ ...disputeData, description: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-xs font-medium outline-none focus:border-[var(--accent)] transition-all resize-none shadow-inner" />
                     </div>
                     <div className="flex gap-4">
                        <button type="button" onClick={() => setDisputeModal(false)} className="flex-1 py-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px] font-bold">Cancel</button>
                        <button disabled={disputeLoading} className="flex-[2] py-4 rounded-xl bg-rose-500 text-white font-bold text-[11px] lg:text-[12px] flex items-center justify-center gap-2">
                           {disputeLoading ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />} Execute
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReviewModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg glass-panel rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] p-10 shadow-2xl">
               <div className="space-y-8">
                  <h2 className="text-2xl font-bold tracking-tighter">Feedback Loop</h2>
                  <form onSubmit={handleSubmitReview} className="space-y-6">
                     <div className="space-y-3">
                        <label className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-secondary)] ml-3">Rating</label>
                        <div className="flex gap-2">
                           {[1, 2, 3, 4, 5].map(s => (
                              <button key={s} type="button" onClick={() => setReviewData({ ...reviewData, rating: s })} className={`size-12 rounded-xl border flex items-center justify-center transition-all ${reviewData.rating >= s ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>
                                 <Star className="size-5" />
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-secondary)] ml-3">Feedback</label>
                        <textarea required rows={4} placeholder="How was the asset?" value={reviewData.comment} onChange={e => setReviewData({ ...reviewData, comment: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-xs font-medium outline-none focus:border-[var(--accent)] transition-all resize-none shadow-inner" />
                     </div>
                     <div className="flex gap-4">
                        <button type="button" onClick={() => setReviewModal(false)} className="flex-1 py-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] lg:text-[12px] font-bold">Cancel</button>
                        <button disabled={reviewLoading} className="flex-[2] py-4 rounded-xl bg-[var(--accent)] text-white font-bold text-[11px] lg:text-[12px] flex items-center justify-center gap-2">
                           {reviewLoading ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Broadcast
                        </button>
                     </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
