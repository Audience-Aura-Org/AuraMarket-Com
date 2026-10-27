"use client";

import { useState, useEffect, memo } from 'react';
import { 
  Package, User, Heart, Wallet, ChevronRight, 
  ShoppingBag, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="[&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-[var(--accent)] [&_a]:focus-visible:outline-offset-[-2px] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-[var(--accent)] [&_button]:focus-visible:outline-offset-[-2px] [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-[var(--accent)] h-full overflow-y-auto p-3 sm:p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Premium User Card */}
        <div className="relative overflow-hidden bg-[var(--bg-primary)]/80 rounded-3xl border border-[var(--glass-border)] p-3 sm:p-4 shadow-sm flex flex-col items-center justify-center text-center">
            {/* Dynamic Halo Glow */}
            

            <div className="relative group shrink-0 mb-6">

               <div className="size-28 md:size-32 rounded-3xl border-4 border-[var(--bg-secondary)] bg-[var(--bg-secondary)] overflow-hidden shadow-sm relative z-10 transition-[color,background-color,border-color,box-shadow] duration-150 ">
                 <img 
                   src={user?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'A'}`} 
                   className="size-full object-cover transition-[color,background-color,border-color,box-shadow] duration-150"
                   alt="" 
                 />
               </div>
            </div>
            
            <div className="min-w-0 w-full space-y-3 relative z-10">
              <h2 className="text-[12px] font-semibold text-[var(--text-primary)] tracking-normal break-words">{user?.name || 'Aura User'}</h2>
            </div>
        </div>

        {/* Action Grid - Upgraded Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3 mt-8">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : router.push(item.href || '#')}
              className="relative overflow-hidden bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)] border border-[var(--glass-border)] p-3 sm:p-4 rounded-3xl flex items-center gap-3 transition-[color,background-color,border-color,box-shadow] duration-150 group hover:shadow-md "
            >
              

              <div className="size-14 md:size-16 rounded-[1.5rem] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] text-[var(--text-secondary)] group-hover:text-white transition-[color,background-color,border-color,box-shadow] duration-150 shadow-sm z-10 shrink-0">
                <item.icon className="size-6 md:size-7 transition-[color,background-color,border-color,box-shadow] duration-150 " />
              </div>
              
              <div className="flex-1 text-left z-10 min-w-0">
                <h3 className="text-[12px] font-semibold text-[var(--text-primary)] tracking-normal truncate">{item.label}</h3>
                <p className="text-[10px] text-[var(--text-secondary)] opacity-80 tracking-tight mt-0.5 truncate">{item.desc}</p>
              </div>
              
              <div className="size-8 rounded-full bg-[var(--text-primary)]/5 flex items-center justify-center group-hover:opacity-100 transition-[color,background-color,border-color,box-shadow] duration-150 z-10 shrink-0">
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
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)] tracking-normal mb-4">Frequency History</h3>
        
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-24 w-full rounded-3xl bg-[var(--bg-primary)] animate-pulse" />)
        ) : orders.length > 0 ? (
          orders.map(order => (
            <Link 
              key={order._id} 
              href={`/orders/${order._id}`}
              className="bg-[var(--bg-primary)] border border-[var(--glass-border)] p-5 rounded-3xl flex items-center justify-between hover:border-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150 group"
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center group-hover:bg-[var(--accent)]/10 transition-colors">
                   <Package className="size-5 text-[var(--accent)] opacity-80 group-hover:opacity-100 transition-[color,background-color,border-color,box-shadow] duration-150" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-primary)]">#{order._id.slice(-6).toUpperCase()}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] opacity-80 tracking-tight">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[13px] font-bold tabular-nums [overflow-wrap:anywhere]">{order.total_amount?.toLocaleString() || order.total?.toLocaleString()} XAF</p>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <span className="text-[10px] font-semibold tracking-tight text-emerald-400">{order.order_status || order.status}</span>
                    <CheckCircle2 className="size-3 text-emerald-400" />
                  </div>
                </div>
                <ChevronRight className="size-4 text-[var(--text-secondary)] transition-[color,background-color,border-color,box-shadow] duration-150" />
              </div>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-secondary)]">
            <ShoppingBag className="size-10 mb-4 opacity-10" />
            <p className="text-[10px] font-semibold tracking-tight opacity-80">No Order Records</p>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto">
      <div className="px-4 md:px-8 lg:px-12 py-6">
        <h3 className="mb-6 text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">Saved items</h3>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-3xl bg-[var(--bg-primary)]" />
            ))}
          </div>
        ) : wishlist.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
            {wishlist.map((p) => (
              <ProductCard key={p._id} product={p} layout="grid" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12">
            <Heart className="mb-4 size-10 text-[var(--accent)] opacity-10" />
            <p className="text-[10px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-80 ">No saved items yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});
WishlistContent.displayName = 'WishlistContent';
