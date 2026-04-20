"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, ChevronLeft, Calendar, 
  MapPin, ShoppingBag, ShieldCheck, 
  Truck, CheckCircle2, AlertTriangle, 
  MessageSquare, ExternalLink, ArrowRight,
  Info, Loader2, Wallet, XCircle, Star
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import { toast } from 'react-hot-toast';

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

  useEffect(() => {
    if (id) {
      fetchOrderManifest();
    }
  }, [id]);

  // Real-time Status Sync: Listen for notification events for this order
  useEffect(() => {
    if (!id || !user?._id) return;

    const handleUpdate = (notif) => {
      // If the notification metadata contains our current order_id, refresh!
      if (notif.metadata?.order_id?.toString() === id.toString()) {
        console.log(`[Matrix Sync] Order ${id} updated remotely. Refreshing manifest...`);
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
        // Refresh order data if status changed
        const orderRes = await api.get(`/orders/${id}`);
        if (orderRes.data.success) {
          setOrder(orderRes.data.data.order);
          setShipments(orderRes.data.data.shipments || []);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Protocol handshake failed.");
    } finally {
      setDisputeLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirm("Have you received the assets in the described condition? This will release Escrow funds.")) return;
    try {
      const res = await api.post(`/escrow/release/${id}`);
      if (res.data.success) {
        toast.success("Funds released locally. Order completed.");
        const orderRes = await api.get(`/orders/${id}`);
        if (orderRes.data.success) {
          setOrder(orderRes.data.data.order);
          setShipments(orderRes.data.data.shipments || []);
        }
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
        toast.success("Feedback successfully broadcasted.");
        setReviewModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit protocol.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
      <div className="size-12 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center p-6 text-center">
       <AlertTriangle className="size-16 text-red-500 mb-6 opacity-20" />
       <h1 className="text-2xl font-black uppercase tracking-tighter">Manifest Lost</h1>
       <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 mt-2 font-mono">Order ID: {id}</p>
       <Link href="/orders" className="mt-8 px-8 py-3 bg-[var(--accent)] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[var(--accent)]/30 transition-all hover:scale-105 active:scale-95">Return to Index</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all duration-500 pb-32">
      {/* Background Decor */}
      <div className="fixed top-[-10%] right-[-10%] size-[1000px] bg-[var(--accent)]/5 rounded-full blur-[180px] pointer-events-none -z-0" />
      
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-16 px-2">
           <Link href="/orders" className="flex items-center gap-3 group transition-all">
             <div className="size-10 rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all shadow-sm backdrop-blur-md">
               <ChevronLeft className="size-5" />
             </div>
             <span className="text-[10px] font-black tracking-widest uppercase">Order Index</span>
           </Link>
           <div className="flex items-center gap-4">
              <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40">ORDER ARCHIVE: {order._id.slice(-8).toUpperCase()}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
           
           {/* LEFT: Order Manifest & Details */}
           <div className="lg:col-span-8 space-y-12">
              
              {/* Status Banner */}
              <div className="glass-panel p-10 rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden group hover:bg-[var(--bg-primary)]/60 transition-all duration-700">
                 <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--accent)]/10" />
                 
                 <div className="space-y-4">
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.4em] opacity-40 ml-1">Current Protocol State</p>
                    <div className="flex items-center gap-6">
                       <div className="size-20 rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-inner">
                          {order.order_status === 'completed' ? <CheckCircle2 className="size-10 text-emerald-500" /> : <Package className="size-10" />}
                       </div>
                       <div className="space-y-1">
                          <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">{order.order_status}</h2>
                          <div className="flex items-center gap-3">
                             <Calendar className="size-3 text-[var(--text-secondary)]" />
                             <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-60">Authorized {new Date(order.createdAt).toLocaleDateString()} @ {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {order.order_status === 'shipped' && (
                   <button 
                    onClick={handleConfirmDelivery}
                    className="px-10 h-16 bg-[var(--accent)] text-white font-black text-[10px] tracking-[0.3em] rounded-2xl shadow-xl shadow-[var(--accent)]/30 hover:scale-[1.05] active:scale-95 transition-all uppercase flex items-center gap-3 group/confirm"
                   >
                     Confirm Receipt <CheckCircle2 className="size-4 group-hover/confirm:scale-110 transition-all" />
                   </button>
                 )}

                 {order.order_status === 'completed' && (
                    <div className="flex items-center gap-4 py-3 px-6 bg-emerald-500/10 border border-emerald-500/10 rounded-2xl text-emerald-600">
                       <ShieldCheck className="size-5" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Escrow Released</span>
                    </div>
                 )}
              </div>

              {/* Product Grid */}
              <div className="space-y-6 px-1">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black uppercase tracking-tighter">Asset Manifest</h3>
                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">{(order.products || []).length} Vector Elements</p>
                 </div>
                 
                 <div className="grid gap-4">
                    {(order.products || []).map((item, idx) => (
                      <div key={idx} className="p-5 rounded-[32px] bg-[var(--bg-primary)]/80 border border-[var(--glass-border)] flex items-center gap-6 group hover:border-[var(--accent)]/40 transition-all backdrop-blur-sm">
                         <div className="size-20 rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex-shrink-0 relative group-hover:scale-105 transition-transform duration-500 shadow-sm">
                            <img src={item.image || '/placeholder.png'} className="size-full object-cover" alt="" />
                            <div className="absolute top-0 right-0 size-6 bg-black text-white flex items-center justify-center text-[9px] font-black rounded-bl-xl border-l border-b border-white/20">x{item.quantity}</div>
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className="text-base font-black truncate max-w-[400px] uppercase tracking-tight group-hover:text-[var(--accent)] transition-colors">{item.name}</h4>
                            <p className="text-[10px] font-black text-[var(--accent)] opacity-60 font-mono mt-1">{(item.price || 0).toLocaleString()} XAF <span className="text-[var(--text-secondary)] text-[8px] opacity-40 mx-2">|</span> ID: {item.product_id?._id?.slice(-8).toUpperCase() || 'NODE-GENERAL'}</p>
                         </div>
                         <div className="flex items-center gap-2">
                           {order.order_status === 'completed' && (
                             <button
                               onClick={() => {
                                 setReviewData({ rating: 5, comment: '', product_id: item.product_id?._id || item.product_id });
                                 setReviewModal(true);
                               }}
                               className="px-4 py-3 rounded-xl border border-[var(--accent)]/30 text-[var(--accent)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm flex items-center gap-2"
                             >
                               <Star className="size-3" /> Rate
                             </button>
                           )}
                           <Link href={`/products/${item.product_id?._id || item.product_id}`} className="size-10 h-[42px] px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] opacity-40 hover:opacity-100 hover:text-[var(--accent)] transition-all">
                              <ExternalLink className="size-4" />
                           </Link>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

               {/* Fulfillment Manifest */}
               {shipments.length > 0 && (
                 <div className="space-y-8 px-1 pt-8 border-t border-[var(--glass-border)]">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-black uppercase tracking-tighter">Fulfillment Matrix</h3>
                      <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-[0.2em]">{shipments.length} Active Nodes</p>
                   </div>
                   
                   <div className="grid gap-6">
                      {shipments.map((shp, idx) => (
                        <div key={shp._id} className="glass-panel p-8 rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 relative overflow-hidden group">
                           <div className={`absolute top-0 left-0 w-1.5 h-full ${
                             shp.status === 'delivered' ? 'bg-emerald-500' : 
                             shp.status === 'failed' ? 'bg-rose-500' : 'bg-[var(--accent)]'
                           }`} />
                           
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                              <div className="flex items-center gap-6">
                                 <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-inner">
                                    <Truck className="size-8" />
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-40">Shipment Signature</p>
                                    <h4 className="text-lg font-black tracking-tight font-mono">{shp.tracking_code}</h4>
                                    <div className="flex items-center gap-2">
                                       {shp.vendor_id && (
                                         <Link 
                                           href={`/stores/${shp.vendor_id._id}`}
                                           className="flex items-center gap-1.5 group/vendor"
                                         >
                                           <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                                             <img 
                                               src={shp.vendor_id?.user_id?.branding?.logo || shp.vendor_id?.store?.logo || shp.vendor_id?.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${shp.vendor_id?.store_name}&backgroundColor=var(--accent)`} 
                                               className="size-full object-cover"
                                               alt="Store"
                                             />
                                           </div>
                                           <span className="text-[9px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[120px]">
                                             {shp.vendor_id?.store_name}
                                           </span>
                                         </Link>
                                       )}
                                    </div>
                                 </div>
                              </div>

                              <div className="flex flex-col md:items-end gap-2">
                                 <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                   shp.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                   shp.status === 'failed' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                   ['in_transit', 'out_for_delivery'].includes(shp.status) ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                                   'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20 shadow-sm shadow-[var(--accent)]/5'
                                 }`}>
                                    {shp.status.replace(/_/g, ' ')}
                                 </span>
                                 <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase opacity-40">Carrier: {shp.logistics_id?.company_name || shp.logistics_company_id?.company_name || 'Node Assigned'}</p>
                              </div>
                           </div>
                           
                           <div className="mt-8 h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--glass-border)] shadow-inner">
                              <div className={`h-full transition-all duration-1000 ${
                                shp.status === 'delivered' ? 'bg-emerald-500' : 
                                shp.status === 'failed' ? 'bg-rose-500' : 'bg-[var(--accent)]'
                              }`} 
                              style={{ 
                                width: shp.status === 'delivered' ? '100%' : 
                                       shp.status === 'out_for_delivery' ? '75%' : 
                                       shp.status === 'in_transit' ? '50%' : 
                                       shp.status === 'picked_up' ? '25%' : '10%' 
                              }} />
                           </div>
                        </div>
                      ))}
                   </div>
                 </div>
               )}

              {/* Dispute Control Node */}
              {['placed', 'processing', 'shipped', 'delivered'].includes(order.order_status) && (
                 <div className="bg-red-500/5 border border-red-500/10 p-10 rounded-[48px] flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden group">
                    <div className="absolute inset-y-0 left-0 w-1 bg-red-500/40" />
                    <div className="space-y-3">
                       <h5 className="text-[11px] font-black text-red-600 uppercase tracking-[0.3em] flex items-center gap-2">
                          <AlertTriangle className="size-4" /> Protocol Dispute
                       </h5>
                       <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60 leading-relaxed max-w-[400px] uppercase tracking-widest">Contest this transaction if the assets fail delivery or do not match the manifest description.</p>
                    </div>
                    <button 
                      onClick={() => setDisputeModal(true)}
                      className="px-8 h-14 rounded-2xl border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/5"
                    >
                      Raise Dispute
                    </button>
                 </div>
              )}

              {order.order_status === 'refund_pending' && (
                 <div className="bg-amber-500/5 border border-amber-500/10 p-10 rounded-[48px] flex items-center gap-6">
                    <AlertTriangle className="size-8 text-amber-500 animate-pulse" />
                    <div>
                       <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Dispute Protocol Initialized</h5>
                       <p className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-60 uppercase tracking-widest mt-1">Admin oversight requested. Escrow funds locked in stasis.</p>
                    </div>
                 </div>
              )}
           </div>

           {/* RIGHT: Fulfillment Analysis */}
           <div className="lg:col-span-4 space-y-8 h-fit sticky top-24">
              
              {/* Payment Summary */}
              <div className="glass-panel p-10 rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 size-32 bg-[var(--accent)]/10 rounded-full blur-[80px]" />
                 
                 <h3 className="text-xl font-black mb-10 tracking-tighter uppercase leading-none">Transaction <span className="text-[var(--accent)]">Matrix</span></h3>
                 
                 <div className="space-y-6 border-b border-[var(--glass-border)] pb-8 mb-8">
                    <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                       <span>Subtotal</span>
                       <span className="text-[var(--text-primary)] font-mono">{((order.subtotal) || 0).toLocaleString()} XAF</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                       <span>Fulfillment Fee</span>
                       <span className="text-[var(--text-primary)] font-mono">{((order.shipping_fee) || 0).toLocaleString()} XAF</span>
                    </div>
                    {order.discount > 0 && (
                       <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-emerald-500 uppercase">
                          <span>Discount Matrix</span>
                          <span className="font-mono">-{order.discount.toLocaleString()} XAF</span>
                       </div>
                    )}
                 </div>

                 <div className="flex justify-between items-end mb-10">
                    <div>
                       <p className="text-[9px] font-black text-[var(--accent)] uppercase tracking-[0.4em] mb-1 opacity-40">Settlement Total</p>
                       <p className="text-4xl font-black text-[var(--text-primary)] tracking-tighter leading-none font-mono">
                          {(order.total_amount || 0).toLocaleString()} 
                       </p>
                    </div>
                    <p className="text-xs font-black text-[var(--text-primary)] uppercase opacity-30 mb-0.5">XAF</p>
                 </div>

                 <div className="flex items-center gap-4 py-4 px-6 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl shadow-inner">
                    <Wallet className="size-5 text-[var(--accent)] opacity-60" />
                    <div>
                       <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-40">Value Protocol</p>
                       <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-tight">{order.payment_method === 'wallet' ? 'Aura Escrow' : order.payment_method}</p>
                    </div>
                 </div>
              </div>

              {/* Delivery Node */}
              <div className="glass-panel p-10 rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="size-10 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/20"><MapPin className="size-5" /></div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Fulfillment Node</h3>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">Consignee</p>
                       <p className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{order.shipping_address?.name || user?.name}</p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">Target Coordinates</p>
                       <p className="text-[11px] font-bold text-[var(--text-primary)] leading-relaxed uppercase tracking-widest">{order.shipping_address?.quartier || order.shipping_address?.street}, {order.shipping_address?.city}</p>
                       <p className="text-[9px] font-black text-[var(--accent)] uppercase tracking-[0.3em] mt-1">{order.shipping_address?.phone || user?.phone}</p>
                    </div>
                 </div>
              </div>

              {/* Logistics Comms */}
              <div className="flex flex-col gap-2">
                 <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.4em] mb-1 opacity-40 ml-4">Authorized Channel</p>
                  <Link 
                    href={`/chat?vendorId=${order.vendor_id?._id || order.vendor_id?.user_id}`}
                    className="w-full p-6 rounded-[32px] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-between group/chat hover:bg-[var(--accent)] hover:text-white transition-all overflow-hidden relative shadow-xl"
                  >
                      <div className="flex items-center gap-4 relative z-10">
                         <div className="size-16 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 shadow-inner group-hover:border-white/20">
                            <img 
                              src={order.vendor_id?.user_id?.branding?.logo || order.vendor_id?.store?.logo || order.vendor_id?.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${order.vendor_id?.store_name}&backgroundColor=var(--accent)`} 
                              className="size-full object-cover"
                              alt="Store"
                            />
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.4em] mb-1 opacity-40 group-hover:opacity-100">Authorized Node</p>
                            <h4 className="text-sm font-black uppercase tracking-tight">Channel: {order.vendor_id?.store_name}</h4>
                         </div>
                      </div>
                      <div className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)] group-hover:bg-white/10 group-hover:border-white/20 transition-all z-10">
                         <MessageSquare className="size-4" />
                      </div>
                      <div className="absolute top-0 right-0 size-32 bg-[var(--accent)]/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                  </Link>
              </div>
           </div>
        </div>

      </main>

      {/* DISPUTE PROTOCOL MODAL */}
      {disputeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/40 animate-in fade-in duration-300">
           <div className="glass-panel w-full max-w-xl p-10 rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-4xl relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 size-40 bg-red-500/5 rounded-full blur-[80px]" />
              
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20"><AlertTriangle className="size-6" /></div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Initiate <span className="text-red-500">Dispute</span></h3>
                 </div>
                 <button onClick={() => setDisputeModal(false)} className="text-[var(--text-secondary)] hover:text-red-500 transition-all"><XCircle className="size-6" /></button>
              </div>

              <form onSubmit={handleRaiseDispute} className="space-y-8">
                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-[var(--text-secondary)] tracking-widest uppercase ml-1 opacity-40">Dispute Vector</label>
                    <select 
                      value={disputeData.reason}
                      onChange={e => setDisputeData({...disputeData, reason: e.target.value})}
                      className="w-full px-8 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-red-500/40 outline-none text-[11px] font-black uppercase tracking-widest appearance-none cursor-pointer"
                    >
                       <option value="item_not_received">Item Not Received</option>
                       <option value="item_not_as_described">Not As Described</option>
                       <option value="faulty_item">Faulty / Defective</option>
                       <option value="unauthorized_transaction">Unauthorized Access</option>
                       <option value="other">Other Fault</option>
                    </select>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-[var(--text-secondary)] tracking-widest uppercase ml-1 opacity-40">Manifest Conflict (Description)</label>
                    <textarea 
                      placeholder="Detail the failure points in the shipment..."
                      rows={4}
                      value={disputeData.description}
                      onChange={e => setDisputeData({...disputeData, description: e.target.value})}
                      className="w-full px-8 py-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-red-500/40 outline-none text-xs font-bold resize-none"
                    />
                 </div>

                 <div className="flex items-center gap-6 pt-4">
                    <button 
                      type="button"
                      onClick={() => setDisputeModal(false)}
                      className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-red-500"
                    >
                      Abort Handshake
                    </button>
                    <button 
                      type="submit"
                      disabled={disputeLoading || !disputeData.description}
                      className="flex-1 h-16 bg-red-500 text-white rounded-2xl font-black text-[10px] tracking-[0.3em] uppercase shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      {disputeLoading ? <Loader2 className="size-5 animate-spin" /> : <>Execute Dispute Protocol <ArrowRight className="size-4" /></>}
                    </button>
                 </div>

                 <div className="pt-6 border-t border-[var(--glass-border)] flex items-center gap-4">
                    <Info className="size-4 text-red-500" />
                    <p className="text-[8px] font-semibold text-[var(--text-secondary)] leading-tight uppercase tracking-widest opacity-40">Funds will be locked in stasis while an admin verifies the coordinates and manifest.</p>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/40 animate-in fade-in duration-300">
           <div className="glass-panel w-full max-w-xl p-10 rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-4xl relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 size-40 bg-[var(--accent)]/5 rounded-full blur-[80px]" />
              
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20"><Star className="size-6" /></div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Leave <span className="text-[var(--accent)]">Feedback</span></h3>
                 </div>
                 <button onClick={() => setReviewModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all"><XCircle className="size-6" /></button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-8">
                 <div className="flex justify-center mb-8 gap-2">
                   {[1, 2, 3, 4, 5].map((star) => (
                     <button
                       type="button"
                       key={star}
                       onClick={() => setReviewData({ ...reviewData, rating: star })}
                       className={`size-12 rounded-full flex items-center justify-center transition-all ${
                         star <= reviewData.rating ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-110' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-amber-500 opacity-50 hover:bg-amber-500/10'
                       }`}
                     >
                       <Star className="size-5" />
                     </button>
                   ))}
                 </div>

                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-[var(--text-secondary)] tracking-widest uppercase ml-1 opacity-40">Review Testimony</label>
                    <textarea 
                      placeholder="Share your experience with this product..."
                      rows={4}
                      required
                      value={reviewData.comment}
                      onChange={e => setReviewData({...reviewData, comment: e.target.value})}
                      className="w-full px-8 py-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)]/40 outline-none text-xs font-bold resize-none"
                    />
                 </div>

                 <div className="flex items-center gap-6 pt-4">
                    <button 
                      type="submit"
                      disabled={reviewLoading || !reviewData.comment}
                      className="flex-1 h-16 bg-[var(--accent)] text-white rounded-2xl font-black text-[10px] tracking-[0.3em] uppercase shadow-xl shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 group"
                    >
                      {reviewLoading ? <Loader2 className="size-5 animate-spin" /> : <>Broadcast Feedback <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" /></>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
