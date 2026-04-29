"use client";
// Force cache bust: v3-esm-path-fix

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

// ESM deep imports for reliable Turbopack resolution
import { 
  Package, ChevronLeft, Calendar, MapPin, 
  ShoppingBag, ShieldCheck, Truck, CheckCircle2, 
  AlertTriangle, MessageSquare, ExternalLink, ArrowRight,
  Info, Loader2, Wallet, XCircle, Star, Box, 
  CreditCard, Receipt, Clock, ArrowUpRight, Share2, 
  Printer, Eye, CornerDownRight, Scale, Phone, Store, Sparkles
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '@/services/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
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
      const res = await api.get(`/orders/${id}`);
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
      const response = await fetch(`${baseUrl}/orders/${id}/invoice`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!response.ok) throw new Error('Invoice generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
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
    if (id) {
      fetchOrderManifest();
    }
  }, [id]);

  // Real-time Status Sync: Listen for notification events for this order
  useEffect(() => {
    if (!id || !user?._id) return;

    const handleUpdate = (notif) => {
      if (notif.metadata?.order_id?.toString() === id.toString()) {
        fetchOrderManifest();
        toast.success(`Protocol Update: ${notif.title || 'Order Synchronized'}`, {
          icon: '⚡',
          style: { borderRadius: '16px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }
        });
      }
    };

    socketService.on('notification', handleUpdate);
    return () => socketService.off('notification', handleUpdate);
  }, [id, user?._id]);

  const handleRaiseDispute = async (e) => {
    e.preventDefault();
    setDisputeLoading(true);
    try {
      const res = await api.post('/disputes', { 
        order_id: id, 
        reason: disputeData.reason, 
        description: disputeData.description 
      });
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
      const res = await api.post(`/escrow/release/${id}`);
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
      const res = await api.post('/reviews', { 
        order_id: id, 
        product_id: reviewData.product_id,
        rating: reviewData.rating, 
        comment: reviewData.comment 
      });
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

  if (loading) return <LoadingSpinner fullScreen />;

  if (!order) return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center p-6 text-center">
       <AlertTriangle className="size-16 text-red-500 mb-6 opacity-20" />
       <h1 className="text-3xl font-black uppercase tracking-tighter">Manifest Lost</h1>
       <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 mt-4 font-mono">Order ID: {id}</p>
       <Link href="/discovery" className="mt-8 px-10 py-4 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[var(--accent)]/30 transition-all hover:scale-105 active:scale-95">Return to Network</Link>
    </div>
  );

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'shipped': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'processing': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'cancelled': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative overflow-x-hidden pb-40">
      {/* Dynamic Background */}
      <div className="fixed top-[-20%] right-[-10%] size-[1200px] bg-[var(--accent)]/5 rounded-full blur-[200px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] left-[-5%] size-[800px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none -z-0" />
      
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 relative z-10">
        
        {/* Navigation & Global ID */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 md:mb-20 gap-8">
           <Link href="/profile" className="flex items-center gap-4 group w-fit">
             <div className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all shadow-lg backdrop-blur-xl group-hover:-translate-x-1">
               <ChevronLeft className="size-6" />
             </div>
             <div>
               <p className="text-[9px] font-black tracking-widest uppercase opacity-40">Back to Sequence</p>
               <h4 className="text-xs font-black uppercase tracking-tight">Identity Profile</h4>
             </div>
           </Link>

           <div className="flex items-center gap-6 p-4 rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] backdrop-blur-md">
              <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)] shadow-inner">
                <Box className="size-5 text-[var(--accent)]" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Secure Manifest ID</p>
                <h3 className="text-[11px] font-black uppercase tracking-widest font-mono">#{order._id.toUpperCase()}</h3>
              </div>
              <div className="h-8 w-px bg-[var(--glass-border)]" />
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[9px] font-black tracking-widest uppercase text-emerald-500">Live Sync</span>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-14">
           
           {/* LEFT COLUMN: The Core Data */}
           <div className="lg:col-span-8 space-y-8 md:space-y-12">
              
              {/* HERO STATUS PANEL */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative glass-panel p-8 md:p-14 rounded-[3.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-[40px] shadow-2xl overflow-hidden group"
              >
                 <div className="absolute top-0 right-0 p-8 md:p-12 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                    <Package className="size-64 md:size-80" />
                 </div>

                 <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                    <div className="space-y-6">
                       <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase border shadow-sm ${getStatusColor(order.order_status)}`}>
                         Protocol: {order.order_status}
                       </span>
                       <div className="space-y-2">
                          <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-none text-transparent bg-clip-text bg-gradient-to-br from-[var(--text-primary)] to-[var(--text-primary)]/40">
                             {order.order_status}
                          </h1>
                          <div className="flex flex-wrap items-center gap-4 text-[var(--text-secondary)]">
                             <div className="flex items-center gap-2">
                                <Clock className="size-4 opacity-40" />
                                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                             </div>
                             <div className="size-1 rounded-full bg-[var(--glass-border)]" />
                             <div className="flex items-center gap-2">
                                <Receipt className="size-4 opacity-40" />
                                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex flex-col gap-4">
                       {order.order_status === 'shipped' && (
                         <button 
                           onClick={handleConfirmDelivery}
                           className="px-10 py-5 bg-emerald-500 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                         >
                           <CheckCircle2 className="size-4" />
                           Confirm Arrival
                         </button>
                       )}
                       {['pending', 'processing', 'shipped'].includes(order.order_status) && (
                         <button 
                           onClick={() => setDisputeModal(true)}
                           className="px-10 py-5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-xl flex items-center justify-center gap-3"
                         >
                           <Scale className="size-4" />
                           Raise Intervention
                         </button>
                       )}
                    </div>
                 </div>
              </motion.div>

              {/* ASSET MANIFEST (Items) */}
              <div className="space-y-8">
                 <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                       <ShoppingBag className="size-5 text-[var(--accent)]" />
                       <h3 className="text-xs font-black uppercase tracking-[0.3em]">Asset Manifest</h3>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest font-mono">LTS-SYNC v4.2</span>
                 </div>

                 <div className="grid grid-cols-1 gap-4 md:gap-6">
                    {order.products.map((item, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={item._id} 
                        className="group relative overflow-hidden glass-panel p-4 md:p-6 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 backdrop-blur-3xl transition-all duration-500 flex flex-col md:flex-row items-center gap-6 shadow-lg"
                      >
                         <div className="relative size-24 md:size-32 rounded-[2rem] overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-700">
                            <img 
                              src={item.image || item.product_id?.images?.[0]?.url || item.product_id?.images?.[0] || '/placeholder.png'} 
                              className="size-full object-cover" 
                              alt={item.name || ''} 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         </div>

                         <div className="flex-1 text-center md:text-left min-w-0 space-y-2">
                            <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-2 md:gap-4 mb-2">
                               <Link href={`/products/${item.product_id?._id || '#'}`} className="inline-block group/link">
                                  <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest opacity-60 flex items-center justify-center md:justify-start gap-2">
                                     <CornerDownRight className="size-3" />
                                     Item Registry
                                  </p>
                               </Link>
                               {(item.product_id?.vendor_id || order.vendor_id) && (
                                 <Link href={`/stores/${item.product_id?.vendor_id?._id || item.product_id?.vendor_id || order.vendor_id?._id || ''}`} className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] w-fit mx-auto md:mx-0">
                                   <Store className="size-3" />
                                   {item.product_id?.vendor_id?.branding?.store_name || item.product_id?.vendor_id?.name || order.vendor_id?.store_name || order.vendor_id?.user_id?.name || 'Authorized Merchant'}
                                 </Link>
                               )}
                            </div>
                            
                            <Link href={`/products/${item.product_id?._id || '#'}`} className="group/link">
                               <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter group-hover/link:text-[var(--accent)] transition-colors truncate">
                                  {item.name || item.product_id?.name || 'Archived Item'}
                               </h3>
                            </Link>
                            {item.variant && (
                              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-2">
                                {Object.entries(item.variant).map(([k, v]) => (
                                  <span key={k} className="text-[9px] font-black bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded-lg uppercase border border-[var(--accent)]/10">
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-center md:justify-start gap-4">
                               <div className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                                     Qty: <span className="text-[var(--text-primary)] font-black">{item.quantity}</span>
                                  </p>
                               </div>
                               <div className="px-3 py-1 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10">
                                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">
                                     Price: <span className="font-black">{(item.price || 0).toLocaleString()} ₳</span>
                                  </p>
                               </div>
                            </div>
                         </div>

                         <div className="flex flex-col gap-2 w-full md:w-auto">
                            {order.order_status === 'completed' && (
                               <button 
                                 onClick={() => { setReviewData({ ...reviewData, product_id: item.product_id?._id }); setReviewModal(true); }}
                                 className="px-6 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                               >
                                  <Star className="size-3" />
                                  Broadcast Feedback
                               </button>
                            )}
                            <button className="px-6 py-3 rounded-2xl bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] text-[9px] font-black uppercase tracking-widest hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-2">
                               <ShieldCheck className="size-3 opacity-40" />
                               Verify Quality
                            </button>
                         </div>
                      </motion.div>
                    ))}
                 </div>
              </div>

              {/* LOGISTICS TIMELINE */}
              <div className="space-y-8">
                 <div className="flex items-center gap-4 px-4">
                    <Truck className="size-5 text-[var(--accent)]" />
                    <h3 className="text-xs font-black uppercase tracking-[0.3em]">Logistics Progression</h3>
                 </div>

                 <div className="glass-panel p-8 md:p-12 rounded-[3.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-3xl shadow-xl space-y-10">
                    {shipments.length > 0 ? (
                      <div className="space-y-8">
                        {shipments.map((ship, sIdx) => (
                           <div key={ship._id} className="relative pl-10 border-l-2 border-[var(--glass-border)] pb-8 last:pb-0">
                              <div className="absolute left-[-11px] top-0 size-5 rounded-full bg-[var(--bg-primary)] border-4 border-[var(--accent)] shadow-[0_0_15px_var(--accent)]" />
                              <div className="space-y-4">
                                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                       <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">
                                          {ship.shipping_carrier || 'Independent Courier'}
                                       </h4>
                                       <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 mt-1">Carrier Identification</p>
                                    </div>
                                    <div className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center gap-3">
                                       <Info className="size-3.5 text-[var(--accent)]" />
                                       <code className="text-[10px] font-black uppercase tracking-widest">{ship.tracking_number}</code>
                                    </div>
                                 </div>

                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                       <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 mb-2">Transit Method</p>
                                       <p className="text-[10px] font-black uppercase tracking-widest">{ship.shipping_method || 'Ground Standard'}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                       <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 opacity-50 mb-2">Node Dispatch</p>
                                       <p className="text-[10px] font-black uppercase tracking-widest font-mono">{ship.shipped_at ? new Date(ship.shipped_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Awaiting Sync'}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 space-y-4 opacity-40">
                         <div className="size-16 rounded-3xl bg-[var(--accent)]/5 flex items-center justify-center mx-auto mb-4 border border-[var(--glass-border)]">
                            <Clock className="size-8" />
                         </div>
                         <h4 className="text-xs font-black uppercase tracking-[0.2em]">Synchronization Pending</h4>
                         <p className="text-[10px] font-medium max-w-[240px] mx-auto">Waiting for vendor node to manifest tracking identification.</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           {/* RIGHT COLUMN: Summary & Operations */}
           <div className="lg:col-span-4 space-y-8">
              
              {/* FINANCIAL BREAKDOWN */}
              <div className="sticky top-12 space-y-8">
                 <div className="glass-panel p-8 md:p-10 rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl shadow-2xl space-y-8">
                    <div className="pb-6 border-b border-[var(--glass-border)]">
                       <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                          <CreditCard className="size-4 text-[var(--accent)]" />
                          Ledger Summary
                       </h3>
                       <div className="space-y-4">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                             <span>Asset Subtotal</span>
                             <span className="text-[var(--text-primary)]">{(order.total_amount - (order.shipping_fee || 0)).toLocaleString()} ₳</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                             <span>Logistics Protocol</span>
                             <span className="text-[var(--text-primary)]">{(order.shipping_fee || 0).toLocaleString()} ₳</span>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Final Settlement</p>
                          <h2 className="text-3xl font-black tracking-tighter uppercase">{order.total_amount.toLocaleString()} ₳</h2>
                       </div>
                       <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] space-y-3">
                          <div className="flex items-center gap-3">
                             <div className="size-6 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                                <Wallet className="size-3 text-[var(--accent)]" />
                             </div>
                             <p className="text-[9px] font-black uppercase tracking-widest">Escrow Protection Active</p>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden">
                             <div className="h-full bg-[var(--accent)] rounded-full w-[100%] animate-pulse shadow-[0_0_10px_var(--accent)]" />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* DESTINATION DATA */}
                 <div className="glass-panel p-8 md:p-10 rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl shadow-xl space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3">
                       <MapPin className="size-4 text-[var(--accent)]" />
                       Delivery Node
                    </h3>
                    <div className="space-y-6">
                       <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                          <h4 className="text-[11px] font-black uppercase tracking-widest mb-1">{order.shipping_address?.full_name || user?.name}</h4>
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] leading-relaxed">{order.shipping_address?.address || 'Quartier specified during onboarding'}</p>
                          <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest mt-2">{order.shipping_address?.city}, {order.shipping_address?.quartier}</p>
                       </div>
                       <div className="flex items-center gap-3 px-2">
                          <Phone className="size-3.5 text-[var(--text-secondary)] opacity-40" />
                          <span className="text-[10px] font-bold font-mono tracking-widest">{order.shipping_address?.phone || user?.phone || 'No contact provided'}</span>
                       </div>
                    </div>
                 </div>

                 {/* ACTION PANEL */}
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                       onClick={handleDownloadInvoice}
                       className="p-5 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex flex-col items-center justify-center gap-2 hover:bg-[var(--accent)] hover:text-white transition-all group"
                     >
                        <Receipt className="size-5 opacity-40 group-hover:opacity-100" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Invoice PDF</span>
                     </button>
                    <button 
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: `Order Manifest #${order._id.toUpperCase()}`,
                            text: `Checking the status of my Aura Market order.`,
                            url: window.location.href,
                          });
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                          toast.success("Manifest link copied to clipboard");
                        }
                      }}
                      className="p-5 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex flex-col items-center justify-center gap-2 hover:bg-[var(--accent)] hover:text-white transition-all group"
                    >
                       <Share2 className="size-5 opacity-40 group-hover:opacity-100" />
                       <span className="text-[8px] font-black uppercase tracking-widest">Transmit</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* DISPUTE MODAL */}
      <AnimatePresence>
        {disputeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-8">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setDisputeModal(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-xl glass-panel rounded-[3.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] p-8 md:p-12 shadow-2xl overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 pointer-events-none">
                  <Scale className="size-48" />
               </div>

               <div className="relative space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Initiate Intervention</h2>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">Escrow funds will be frozen during adjudication.</p>
                  </div>

                  <form onSubmit={handleRaiseDispute} className="space-y-6">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black tracking-widest uppercase opacity-40 ml-4">Intervention Reason</label>
                       <select 
                         value={disputeData.reason}
                         onChange={e => setDisputeData({ ...disputeData, reason: e.target.value })}
                         className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all appearance-none uppercase tracking-widest"
                       >
                         <option value="item_not_received">Item not manifested</option>
                         <option value="different_from_description">Registry mismatch</option>
                         <option value="quality_issues">Biological/Structural defects</option>
                         <option value="other">Other logical breach</option>
                       </select>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black tracking-widest uppercase opacity-40 ml-4">Detailed Manifest</label>
                       <textarea 
                         required
                         rows={4}
                         placeholder="Describe the protocol violation in detail..."
                         value={disputeData.description}
                         onChange={e => setDisputeData({ ...disputeData, description: e.target.value })}
                         className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-3xl px-6 py-5 text-sm font-medium outline-none focus:border-[var(--accent)] transition-all resize-none"
                       />
                    </div>

                    <div className="flex gap-4">
                       <button 
                        type="button" onClick={() => setDisputeModal(false)}
                        className="flex-1 py-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
                       >
                         Cancel
                       </button>
                       <button 
                        disabled={disputeLoading}
                        className="flex-[2] py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                         {disputeLoading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                         Execute Protocol
                       </button>
                    </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REVIEW MODAL */}
      <AnimatePresence>
        {reviewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-8">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setReviewModal(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-xl glass-panel rounded-[3.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] p-8 md:p-12 shadow-2xl overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 pointer-events-none">
                  <Star className="size-48" />
               </div>

               <div className="relative space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Broadcast Feedback</h2>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">Help calibrate the Aura marketplace node registry.</p>
                  </div>

                  <form onSubmit={handleSubmitReview} className="space-y-8">
                    <div className="flex flex-col items-center gap-6 p-8 rounded-[2.5rem] bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-inner">
                       <span className="text-[9px] font-black tracking-[0.4em] uppercase text-[var(--accent)]">Protocol Rating</span>
                       <div className="flex gap-4">
                          {[1,2,3,4,5].map((num) => (
                            <button 
                              key={num} type="button" 
                              onClick={() => setReviewData({ ...reviewData, rating: num })}
                              className={`size-12 rounded-xl flex items-center justify-center transition-all ${reviewData.rating >= num ? 'bg-[var(--accent)] text-white shadow-lg scale-110' : 'bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40'}`}
                            >
                               <Star className={`size-6 ${reviewData.rating >= num ? 'fill-current' : ''}`} />
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black tracking-widest uppercase opacity-40 ml-4">Registry Comment</label>
                       <textarea 
                         required
                         rows={4}
                         placeholder="Document your experience with this asset arrival..."
                         value={reviewData.comment}
                         onChange={e => setReviewData({ ...reviewData, comment: e.target.value })}
                         className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-3xl px-6 py-5 text-sm font-medium outline-none focus:border-[var(--accent)] transition-all resize-none shadow-inner"
                       />
                    </div>

                    <div className="flex gap-4">
                       <button 
                        type="button" onClick={() => setReviewModal(false)}
                        className="flex-1 py-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
                       >
                         Discard
                       </button>
                        <button 
                         disabled={reviewLoading}
                         className="flex-[2] py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {reviewLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                          Submit Broadcast
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
