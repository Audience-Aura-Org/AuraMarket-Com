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
    { id: 'orders', label: 'Order History', icon: Package, desc: 'Track your packages', action: () => onSelectTab('orders'), color: 'emerald' },
    { id: 'wishlist', label: 'Saved Items', icon: Heart, desc: 'Your liked hardware', action: () => onSelectTab('wishlist'), color: 'rose' },
    { id: 'profile', label: 'Terminal Settings', icon: User, desc: 'Personal branding', href: '/profile', color: 'amber' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* User Card */}
        <div className="bg-[var(--bg-primary)] rounded-[2.5rem] border border-[var(--glass-border)] p-8 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent)]/5 rounded-full blur-3xl -z-0" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="size-20 rounded-full border-2 border-[var(--accent)]/20 p-1">
               <img 
                 src={user?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'A'}`} 
                 className="size-full rounded-full object-cover" 
                 alt="" 
               />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">{user?.name || 'Aura User'}</h2>
              <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] opacity-40">Node ID: {user?._id?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 gap-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : router.push(item.href || '#')}
              className="bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)] border border-[var(--glass-border)] p-5 rounded-3xl flex items-center gap-4 transition-all group"
            >
              <div className={`size-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all`}>
                <item.icon className="size-5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">{item.label}</h3>
                <p className="text-[10px] text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{item.desc}</p>
              </div>
              <ChevronRight className="size-4 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.3em] mb-4">Frequency History</h3>
        
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-24 w-full rounded-3xl bg-[var(--bg-primary)] animate-pulse" />)
        ) : orders.length > 0 ? (
          orders.map(order => (
            <div key={order._id} className="bg-[var(--bg-primary)] border border-[var(--glass-border)] p-5 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center">
                   <Package className="size-5 text-[var(--accent)] opacity-40" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">#{order._id.slice(-6).toUpperCase()}</p>
                  <p className="text-[9px] text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-[var(--text-primary)]">{order.total?.toLocaleString()} XAF</p>
                <div className="flex items-center gap-1.5 justify-end mt-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">{order.status}</span>
                  <CheckCircle2 className="size-3 text-emerald-400" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-secondary)]">
            <ShoppingBag className="size-10 mb-4 opacity-10" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Order Records</p>
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
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.3em] mb-6">Saved Hardware</h3>
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
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--text-secondary)]">Zero Savings Found</p>
             </div>
          )}
       </div>
    </motion.div>
  );
});
WishlistContent.displayName = 'WishlistContent';
