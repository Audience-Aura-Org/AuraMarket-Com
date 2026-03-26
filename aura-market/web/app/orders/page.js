"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Package, ChevronRight, Search, 
  Filter, Clock, CheckCircle2, 
  Truck, XCircle, AlertCircle, ShoppingBag,
  ArrowRight, ShieldCheck, Wallet
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?._id) {
      api.get('/orders/my-orders')
        .then(res => {
          if (res.data.success) setOrders(res.data.data.orders);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user?._id]);

  const filteredOrders = orders.filter(o => filter === 'all' || o.order_status === filter);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'shipped': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'processing': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'cancelled':
      case 'refunded': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="size-3" />;
      case 'shipped': return <Truck className="size-3" />;
      case 'processing': return <Clock className="size-3" />;
      case 'cancelled':
      case 'refunded': return <XCircle className="size-3" />;
      default: return <Package className="size-3" />;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
      <div className="size-12 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all duration-500 pb-32">
      {/* Dynamic Aura Background */}
      <div className="fixed top-[-10%] right-[-10%] size-[800px] bg-[var(--accent)]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] size-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <main className="max-w-6xl mx-auto px-6 py-16 relative z-10">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
              Your <span className="text-[var(--accent)]">Orders</span>
            </h1>
            <div className="flex items-center gap-3">
               <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-60">Synchronized with Aura Protocol</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-primary)]/40 backdrop-blur-xl p-2 rounded-2xl border border-[var(--glass-border)] shadow-sm">
             {['all', 'placed', 'processing', 'shipped', 'completed', 'cancelled'].map(f => (
               <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  filter === f 
                  ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
               >
                 {f}
               </button>
             ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 glass-panel rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-xl">
            <div className="size-24 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] opacity-20 shadow-inner">
               <ShoppingBag className="size-10" />
            </div>
            <div className="space-y-2">
               <h3 className="text-xl font-black uppercase tracking-tight">No Order Records Found</h3>
               <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">Your transaction manifest is currently empty</p>
            </div>
            <Link href="/shop" className="px-10 py-4 bg-[var(--accent)] text-white font-black text-[10px] tracking-[0.3em] rounded-2xl shadow-xl shadow-[var(--accent)]/30 hover:scale-[1.05] active:scale-95 transition-all uppercase">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => (
              <div 
                onClick={() => router.push(`/orders/${order._id}`)}
                key={order._id}
                className="group p-6 rounded-[36px] bg-[var(--bg-primary)]/80 border border-[var(--glass-border)] hover:border-[var(--accent)]/40 hover:shadow-2xl hover:shadow-[var(--accent)]/5 transition-all duration-500 backdrop-blur-md flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden cursor-pointer"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 size-24 bg-[var(--accent)]/5 rounded-full blur-2xl group-hover:bg-[var(--accent)]/10 transition-all" />

                {/* Left: Product Images Group */}
                <div className="flex -space-x-8">
                   {(order.products || []).slice(0, 3).map((p, i) => (
                     <div key={i} className="size-16 md:size-20 rounded-2xl overflow-hidden border-2 border-[var(--bg-primary)] shadow-xl relative group-hover:translate-y-[-4px] transition-transform duration-500" style={{ zIndex: 10 - i }}>
                        <img src={p.image || '/placeholder.png'} className="size-full object-cover" alt="" />
                     </div>
                   ))}
                   {(order.products || []).length > 3 && (
                     <div className="size-16 md:size-20 rounded-2xl bg-[var(--bg-secondary)] border-2 border-[var(--bg-primary)] flex items-center justify-center text-[9px] font-black tracking-widest text-[var(--text-secondary)] shadow-xl" style={{ zIndex: 0 }}>
                        +{(order.products || []).length - 3}
                     </div>
                   )}
                </div>

                {/* Center: Info */}
                <div className="flex-1 space-y-3">
                   <div className="flex flex-wrap items-center gap-3">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${getStatusColor(order.order_status)}`}>
                         {getStatusIcon(order.order_status)}
                         {order.order_status}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[8px] font-black uppercase tracking-widest opacity-60">
                         <Clock className="size-3" />
                         {new Date(order.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </div>
                   </div>
                   <div>
                      <h4 className="text-base font-black truncate max-w-[300px] uppercase tracking-tight group-hover:text-[var(--accent)] transition-colors">
                        {(order.products || [])[0]?.name || 'N/A'} {(order.products || []).length > 1 ? `& ${(order.products || []).length - 1} more` : ''}
                      </h4>
                       <div className="mt-1">
                         {order.vendor_id && (
                           <Link 
                             href={`/stores/${order.vendor_id._id}`}
                             className="flex items-center gap-1.5 group/vendor"
                             onClick={(e) => e.stopPropagation()}
                           >
                             <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                               <img 
                                 src={order.vendor_id?.user_id?.branding?.logo || order.vendor_id?.store?.logo || order.vendor_id?.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${order.vendor_id?.store_name}&backgroundColor=var(--accent)`} 
                                 className="size-full object-cover"
                                 alt="Store"
                               />
                             </div>
                             <span className="text-[9px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[120px]">
                               {order.vendor_id?.store_name}
                             </span>
                           </Link>
                         )}
                       </div>
                   </div>
                </div>

                {/* Right: Price & CTA */}
                <div className="flex items-center md:flex-col md:items-end justify-between gap-4 py-4 md:py-0 border-t md:border-t-0 md:border-l border-[var(--glass-border)] md:pl-10">
                   <div className="md:text-right">
                      <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-40 mb-1">Total Value</p>
                      <p className="text-xl font-black font-mono text-[var(--accent)]">{(order.total_amount || 0).toLocaleString()} XAF</p>
                   </div>
                   <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] group-hover:bg-[var(--accent)] group-hover:text-white group-hover:translate-x-1 transition-all">
                      <ChevronRight className="size-5" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { title: 'Secure Escrow', desc: 'Every payment is held in protocol until you confirm success.', icon: ShieldCheck, color: 'text-emerald-500' },
             { title: 'Global Logistics', desc: 'Real-time tracking for every asset movement from fulfillment nodes.', icon: Truck, color: 'text-[var(--accent)]' },
             { title: 'Instant Refunds', desc: 'Resolution protocols ensure funds return if assets fail delivery.', icon: Wallet, color: 'text-indigo-500' }
           ].map((info) => (
             <div key={info.title} className="p-8 rounded-[40px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/30 space-y-4 hover:translate-y-[-4px] transition-all">
                <div className={`size-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)] shadow-sm ${info.color}`}>
                   <info.icon className="size-6" />
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em]">{info.title}</h5>
                <p className="text-[9px] font-semibold text-[var(--text-secondary)] leading-relaxed opacity-60 uppercase tracking-widest">{info.desc}</p>
             </div>
           ))}
        </div>

      </main>
    </div>
  );
}


