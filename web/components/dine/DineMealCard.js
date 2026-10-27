"use client";

import Link from 'next/link';
import { restaurantHref } from '@/lib/restaurantRoutes';
import { useState } from 'react';
import { Star, Plus, MessageSquare, Clock, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import { useAuthStore } from '@/hooks/useAuth';
import { useFollow } from '@/hooks/useFollow';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { cartStore } from '@/services/cartStore';

const FALLBACK_THEMES = [
  { from: '#ea580c', to: '#fbbf24' },
  { from: '#be185d', to: '#fb7185' },
  { from: '#7c3aed', to: '#c084fc' },
  { from: '#0f766e', to: '#2dd4bf' },
  { from: '#166534', to: '#86efac' },
  { from: '#1e40af', to: '#818cf8' },
];


function strHash(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}

function formatPrepTime(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h} hr`;
  }
  const d = Math.floor(mins / 1440);
  return `${d} day${d !== 1 ? 's' : ''}`;
}

export default function DineMealCard({ meal, onSelect = null }) {
  const { vendor_id, name, price, thumbnail_url, rating, restaurant_name, restaurant_logo_url, category_id, prep_time_minutes, restaurant_open } = meal;

  const router       = useRouter();
  const { openChat } = useChat();
  const { user }     = useAuthStore();
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(vendor_id?.toString());
  const [adding, setAdding] = useState(false);

  const theme     = FALLBACK_THEMES[strHash(name || '') % FALLBACK_THEMES.length];
  const mealInitial = (name || '?')[0].toUpperCase();
  const isPopular = rating >= 4.5;
  const initial   = (restaurant_name || '?')[0].toUpperCase();
  // restaurant_open is provided by the backend; default true so legacy items still work
  const restaurantClosed = restaurant_open === false;

  const handleAddToCart = async () => {
    if (!user) { router.push('/login'); return; }
    setAdding(true);
    try {
      const res = await api.post('/cart', { product_id: meal._id, quantity: 1, booking_type: 'delivery' });
      if (res.data.success) {
        cartStore.setCart(res.data.data?.cart);
        toast.success('Added to cart!');
      }
    } catch (err) {
      const code = err.response?.data?.code;
      const msg =
        code === 'DIFFERENT_RESTAURANT'   ? 'Dine-in orders are limited to one restaurant. Clear your cart first.' :
        code === 'BOOKING_TYPE_MISMATCH'  ? err.response.data.message :
        code === 'MIXED_CART'             ? err.response.data.message :
        (err.response?.data?.message || 'Could not add to cart.');
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = () => {
    if (!user) { router.push('/login'); return; }
    router.push(`/checkout?productId=${meal._id}&quantity=1`);
  };

  const handleMessage = () => {
    openChat(vendor_id || null, {
      _id: meal._id, name, price,
      images: thumbnail_url ? [{ url: thumbnail_url }] : [],
    }, null, false);
  };

  const imageFallback = (e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-product.svg'; };
  const mealImage = thumbnail_url ? (
    <img src={thumbnail_url} alt={name} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={imageFallback} />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}>
      <span className="select-none text-[40px] font-bold leading-none text-white/70">{mealInitial}</span>
    </div>
  );
  const secondaryButton = 'h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="group relative min-w-0 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm hover:border-[var(--accent)]/30 hover:shadow-md transition-[color,background-color,border-color,box-shadow] duration-150 overflow-hidden flex flex-col h-full font-poppins">

      {/* ── Top bar: restaurant avatar + name + follow (mirrors ProductCard) ── */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 px-3 py-2.5 sm:px-4 overflow-hidden">
        <Link
          href={restaurantHref(vendor_id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="size-5 md:size-6 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 flex items-center justify-center">
            {restaurant_logo_url ? (
              <img src={restaurant_logo_url} alt={restaurant_name} className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{initial}</span>
            )}
          </div>
          <span
            className="block min-w-0 truncate text-[10px] font-semibold text-[var(--text-primary)] leading-none"
            title={restaurant_name}
          >
            {restaurant_name}
          </span>
        </Link>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }}
          disabled={followLoading}
          className={`shrink-0 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] duration-150 shadow-sm border ${
            isFollowing
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'
          }`}
        >
          {isFollowing ? 'Following' : '+ Follow'}
        </button>
      </div>

      {/* ── Meal image ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--accent)]/5">
        {onSelect ? (
          <button onClick={() => onSelect(meal)} className="block h-full w-full text-left" aria-label={name}>
            {mealImage}
          </button>
        ) : (
          <Link href={restaurantHref(vendor_id)} className="block h-full w-full" onClick={e => e.stopPropagation()}>
            {mealImage}
          </Link>
        )}

        {isPopular && (
          <span className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
            <Star className="size-2.5 fill-white text-white" /> Popular
          </span>
        )}

        {restaurantClosed && (
          <span className="absolute top-2.5 right-2.5 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
            Closed — Pre-order
          </span>
        )}
      </div>

      {/* ── Info + buttons ── */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2 md:gap-3">

        <div className="space-y-0.5 md:space-y-1">
          <h4
            className={`line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight${onSelect ? ' cursor-pointer' : ''}`}
            onClick={onSelect ? () => onSelect(meal) : undefined}
          >
            {name}
          </h4>
          <div className="flex items-baseline justify-between gap-1">
            <span className="min-w-0 text-[13px] font-bold tabular-nums text-[var(--text-primary)] [overflow-wrap:anywhere]">
              {price.toLocaleString()}{' '}
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">XAF</span>
            </span>
            {rating > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                <Star className="size-2.5 fill-amber-500 text-amber-500" />
                <span className="text-[10px]">{rating.toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>

        {!!prep_time_minutes && (
          <span className="flex items-center gap-1 text-[9px] font-normal text-[var(--text-secondary)] opacity-70">
            <Clock className="size-2.5 shrink-0" />
            <span className="truncate text-[9px]">Ready in {formatPrepTime(prep_time_minutes)}</span>
          </span>
        )}

        {/* 3 action buttons */}
        <div className="grid grid-cols-3 items-center gap-1 md:gap-1.5 mt-auto">
          <button
            onClick={onSelect ? () => onSelect(meal) : handleAddToCart}
            disabled={!onSelect && adding}
            title="Add to cart"
            aria-label="Add to cart"
            className="h-9 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-sm shadow-[var(--accent)]/25 hover:brightness-110 transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus strokeWidth={3} className={`size-3.5 shrink-0 ${!onSelect && adding ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleMessage}
            title="Message restaurant"
            aria-label="Message restaurant"
            className={`${secondaryButton} text-[var(--text-secondary)]`}
          >
            <MessageSquare className="size-3.5 shrink-0" />
          </button>
          <button
            onClick={onSelect ? () => onSelect(meal) : handleBuyNow}
            disabled={!onSelect && adding}
            title="Buy now"
            aria-label="Buy now"
            className={`${secondaryButton} text-[var(--text-primary)]`}
          >
            <ShoppingCart className="size-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
