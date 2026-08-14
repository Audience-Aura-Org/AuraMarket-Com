"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Star, Plus, MessageSquare, Clock } from 'lucide-react';
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
  const { vendor_id, name, price, thumbnail_url, rating, restaurant_name, restaurant_logo_url, category_id, prep_time_minutes } = meal;

  const router       = useRouter();
  const { openChat } = useChat();
  const { user }     = useAuthStore();
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(vendor_id?.toString());
  const [adding, setAdding] = useState(false);

  const theme     = FALLBACK_THEMES[strHash(name || '') % FALLBACK_THEMES.length];
  const mealInitial = (name || '?')[0].toUpperCase();
  const isPopular = rating >= 4.5;
  const initial   = (restaurant_name || '?')[0].toUpperCase();

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

  return (
    <div className="group relative rounded-[2rem] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1.5 backdrop-blur-xl flex flex-col h-full font-poppins">

      {/* ── Top bar: restaurant avatar + name + follow (mirrors ProductCard) ── */}
      <div className="grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-2 backdrop-blur-md sm:p-2.5 md:p-3 overflow-hidden">
        <Link
          href={`/dine/restaurant/${vendor_id}`}
          className="flex min-w-0 items-center gap-1.5 overflow-hidden group/vendor"
          onClick={e => e.stopPropagation()}
        >
          <div className="size-5 md:size-6 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-sm flex items-center justify-center">
            {restaurant_logo_url ? (
              <img src={restaurant_logo_url} alt={restaurant_name} className="size-full object-cover" />
            ) : (
              <span className="text-[10px] font-black text-[var(--text-secondary)]">{initial}</span>
            )}
          </div>
          <span
            className="block min-w-0 truncate text-[10px] sm:text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)] leading-none"
            title={restaurant_name}
          >
            {restaurant_name}
          </span>
        </Link>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }}
          disabled={followLoading}
          className={`shrink-0 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-semibold tracking-tight transition-all active:scale-95 shadow-sm border ${
            isFollowing
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'
          }`}
        >
          {isFollowing ? 'Following' : '+ Follow'}
        </button>
      </div>

      {/* ── Meal image ── */}
      <div className="relative overflow-hidden bg-[var(--accent)]/5" style={{ aspectRatio: '4 / 3' }}>
        {onSelect ? (
          <button
            onClick={() => onSelect(meal)}
            className="block h-full w-full text-left"
          >
            {thumbnail_url ? (
              <img
                src={thumbnail_url}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}>
                <div
                  className="absolute inset-0 opacity-[0.08]"
                  style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%)', backgroundSize: '24px 24px' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="select-none font-black text-white/70 leading-none"
                    style={{ fontSize: 'clamp(36px, 15cqw, 64px)', letterSpacing: '-0.03em', textShadow: '0 2px 16px rgba(0,0,0,0.18)' }}
                  >
                    {mealInitial}
                  </span>
                </div>
              </div>
            )}
          </button>
        ) : (
          <Link href={`/dine/restaurant/${vendor_id}`} className="block h-full w-full" onClick={e => e.stopPropagation()}>
            {thumbnail_url ? (
              <img
                src={thumbnail_url}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}>
                <div
                  className="absolute inset-0 opacity-[0.08]"
                  style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%)', backgroundSize: '24px 24px' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="select-none font-black text-white/70 leading-none"
                    style={{ fontSize: 'clamp(36px, 15cqw, 64px)', letterSpacing: '-0.03em', textShadow: '0 2px 16px rgba(0,0,0,0.18)' }}
                  >
                    {mealInitial}
                  </span>
                </div>
              </div>
            )}
          </Link>
        )}

        {isPopular && (
          <span className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <Star className="size-2.5 fill-white text-white" /> Popular
          </span>
        )}
      </div>

      {/* ── Info + buttons ── */}
      <div className="p-2 sm:p-2.5 md:p-3.5 flex flex-col flex-1 gap-2 md:gap-3">

        <div className="space-y-0.5 md:space-y-1">
          <h4
            className={`line-clamp-2 text-[11px] sm:text-[12px] md:text-[13px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight${onSelect ? ' cursor-pointer' : ''}`}
            onClick={onSelect ? () => onSelect(meal) : undefined}
          >
            {name}
          </h4>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[12px] sm:text-[13px] md:text-[15px] font-bold text-[var(--accent)] truncate">
              {price.toLocaleString()} XAF
            </span>
            {rating > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 shrink-0">
                <Star className="size-2.5 fill-amber-500 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {!!prep_time_minutes && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)] opacity-70">
              <Clock className="size-3 text-[var(--accent)] shrink-0" />
              <span className="truncate">Ready in {formatPrepTime(prep_time_minutes)}</span>
            </span>
          </div>
        )}

        {/* 3 action buttons */}
        <div className="grid grid-cols-3 items-center gap-1 md:gap-1.5 mt-auto">
          <button
            onClick={onSelect ? () => onSelect(meal) : handleAddToCart}
            disabled={!onSelect && adding}
            title="Add to cart"
            className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--accent)] text-white flex items-center justify-center gap-1 text-[9px] md:text-[10px] font-bold shadow-lg shadow-[var(--accent)]/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 px-1"
          >
            <Plus strokeWidth={3} className={`size-3 md:size-3.5 shrink-0 ${!onSelect && adding ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleMessage}
            title="Message restaurant"
            className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all"
          >
            <MessageSquare className="size-3.5 md:size-4 shrink-0" />
          </button>
          <button
            onClick={onSelect ? () => onSelect(meal) : handleBuyNow}
            disabled={!onSelect && adding}
            className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center text-[9px] md:text-[10px] font-bold hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-50 px-1"
          >
            <span className="truncate">Buy Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
