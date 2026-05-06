"use client";

import { useState, useEffect, memo } from 'react';
import { 
  Package, User, Heart, Wallet, ChevronRight, 
  ShoppingBag, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import dynamic from 'next/dynamic';

const ProductCard = dynamic(() => import('@/components/ProductCard'), { ssr: false });

// ── PROFILE TAB ──────────────────────────────────────────────────────────
export const ProfileContent = memo(({ user, onSelectTab }) => {
  const router = useRouter();

  const menuItems = [
    { id: 'wallet', label: 'Matrix Wallet', icon: Wallet, desc: 'Credits & balance', href: '/wallet', color: 'blue' },
    { id: 'orders', label: 'Order History', icon: Package, desc: 'Track full manifest', href: '/profile?tab=orders', color: 'emerald' },
    { id: 'wishlist', label: 'Liked Items', icon: Heart, desc: 'Your saved assets', href: '/profile?tab=wishlist', color: 'rose' },
    { id: 'profile', label: 'Terminal Settings', icon: User, desc: 'Personal branding', href: '/profile', color: 'amber' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Premium User Card */}
        <div className="relative overflow-hidden bg-[var(--bg-primary)]/80 backdrop-blur-3xl rounded-[3rem] border border-[var(--glass-border)] p-8 md:p-12 shadow-2xl flex flex-col items-center justify-center text-center">
            {/* Dynamic Halo Glow */}
            <div className="absolute inset-x-0 -top-24 h-64 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="relative group shrink-0 mb-6">
               <div className="absolute inset-0 bg-[var(--accent)]/40 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
               <div className="size-28 md:size-32 rounded-[2rem] border-4 border-[var(--bg-secondary)] bg-[var(--bg-secondary)] overflow-hidden shadow-2xl relative z-10 transition-transform duration-500 group-hover:scale-105">
                 <img 
                   src={user?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'A'}`} 
                   className="size-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                   alt="" 
                 />
               </div>
            </div>
            
            <div className="space-y-3 relative z-10">
              <h2 className="text-3xl md:text-5xl  font-bold text-[var(--text-primary)]  tracking-tighter shadow-sm">{user?.name || 'Aura User'}</h2>
            </div>
        </div>

        {/* Action Grid - Upgraded Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-8">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : router.push(item.href || '#')}
              className="relative overflow-hidden bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)] border border-[var(--glass-border)] p-5 md:p-6 rounded-[2rem] flex items-center gap-5 transition-all duration-300 group hover:shadow-xl hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)]/5 rounded-full blur-2xl transition-all duration-500 group-hover:bg-[var(--accent)]/10 group-hover:scale-150" />
              
              <div className="size-14 md:size-16 rounded-[1.5rem] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] text-[var(--text-secondary)] group-hover:text-white transition-all shadow-sm z-10 shrink-0">
                <item.icon className="size-6 md:size-7 transition-all duration-300 group-hover:scale-110" />
              </div>
              
              <div className="flex-1 text-left z-10 min-w-0">
                <h3 className="text-[13px] md:text-[15px]  font-bold text-[var(--text-primary)]  tracking-tighter truncate">{item.label}</h3>
                <p className="text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] text-[var(--text-secondary)] opacity-60 tracking-tight mt-0.5 truncate">{item.desc}</p>
              </div>
              
              <div className="size-8 rounded-full bg-[var(--text-primary)]/5 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-10 shrink-0">
                <ChevronRight className="size-4 text-[var(--text-primary)]" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
});
ProfileContent.displayName = 'ProfileContent';

// ── ORDERS TAB ───────────────────────────────────────────────────────────
export const OrdersContent = memo(({ user }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders').then(res => {
      if (res.data.success) setOrders(res.data.data.orders || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">
        <h3 className="text-sm  font-bold text-[var(--text-primary)]  tracking-[0.3em] mb-4">Frequency History</h3>
        
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-24 w-full rounded-3xl bg-[var(--bg-primary)] animate-pulse" />)
        ) : orders.length > 0 ? (
          orders.map(order => (
            <Link 
              key={order._id} 
              href={`/orders/${order._id}`}
              className="bg-[var(--bg-primary)] border border-[var(--glass-border)] p-5 rounded-3xl flex items-center justify-between hover:border-[var(--accent)] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center group-hover:bg-[var(--accent)]/10 transition-colors">
                   <Package className="size-5 text-[var(--accent)] opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <p className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-primary)]">#{order._id.slice(-6).toUpperCase()}</p>
                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-50 tracking-tight">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs  font-bold text-[var(--text-primary)]">{order.total_amount?.toLocaleString() || order.total?.toLocaleString()} XAF</p>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-emerald-400">{order.order_status || order.status}</span>
                    <CheckCircle2 className="size-3 text-emerald-400" />
                  </div>
                </div>
                <ChevronRight className="size-4 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-secondary)]">
            <ShoppingBag className="size-10 mb-4 opacity-10" />
            <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">No Order Records</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});
OrdersContent.displayName = 'OrdersContent';

// ── WISHLIST TAB ────────────────────────────────────────────────────────
export const WishlistContent = memo(({ user }) => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/wishlist').then(res => {
      if (res.data.success) setWishlist(res.data.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto px-4 py-6">
       <div className="max-w-4xl mx-auto">
          <h3 className="text-sm  font-bold text-[var(--text-primary)]  tracking-[0.3em] mb-6">Saved Hardware</h3>
          {loading ? (
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {[...Array(4)].map((_, i) => <div key={i} className="aspect-square rounded-3xl bg-[var(--bg-primary)] animate-pulse" />)}
             </div>
          ) : wishlist.length > 0 ? (
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {wishlist.map(p => <ProductCard key={p._id} product={p} />)}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center p-12">
                <Heart className="size-10 text-[var(--accent)] opacity-10 mb-4" />
                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40 text-[var(--text-secondary)]">Zero Savings Found</p>
             </div>
          )}
       </div>
    </motion.div>
  );
});
WishlistContent.displayName = 'WishlistContent';
