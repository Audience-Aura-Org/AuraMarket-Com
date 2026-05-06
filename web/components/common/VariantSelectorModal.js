"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, ShoppingBag, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * VariantSelectorModal
 * Compact, fully-accessible variant picker rendered via React Portal.
 * Works as a bottom-sheet on mobile, centered card on tablet/desktop.
 */
export default function VariantSelectorModal({
  isOpen,
  onClose,
  product,
  onConfirm,
  actionType = 'cart',
}) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [currentVariant, setCurrentVariant]   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [mounted, setMounted]                 = useState(false);

  /* ── Portal mount guard (SSR safe) ───────────────────────── */
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  /* ── Default-select first option of each variant type ──────── */
  useEffect(() => {
    if (!product?.has_variants) return;
    const defaults = {};
    product.variant_types?.forEach(t => {
      if (t.options?.length > 0) defaults[t.name] = t.options[0];
    });
    setSelectedOptions(defaults);
  }, [product, isOpen]);

  /* ── Match selected options to a SKU variant ────────────────── */
  useEffect(() => {
    if (product?.sku_variants?.length > 0) {
      const match = product.sku_variants.find(v =>
        Object.entries(selectedOptions).every(([k, val]) => v.combination[k] === val)
      );
      setCurrentVariant(match || null);
    } else {
      setCurrentVariant(null);
    }
  }, [selectedOptions, product]);

  /* ── ESC to close ───────────────────────────────────────────── */
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  /* ── Lock body scroll while open ────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(currentVariant || product);
    setLoading(false);
    onClose();
  };

  if (!product || !mounted) return null;

  const displayPrice = currentVariant?.price ?? product.price;
  const inStock      = currentVariant ? currentVariant.stock > 0 : product.stock > 0;
  const images       = product.images || [];
  const mainImage    = currentVariant?.image
    || (typeof images[0] === 'string' ? images[0] : images[0]?.url)
    || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────── */}
          <motion.div
            key="vsm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
          />

          {/* ── Sheet ────────────────────────────────────── */}
          <motion.div
            key="vsm-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Select options for ${product.name}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={[
              'fixed bottom-0 inset-x-0 z-[9999]',
              'bg-[var(--bg-primary)]',
              'rounded-t-[1.75rem]',
              'border-t border-[var(--glass-border)]',
              'shadow-[0_-20px_60px_rgba(0,0,0,0.3)]',
              'flex flex-col',
              /* max height — leaves room for notch/nav */
              'max-h-[82vh]',
              /* On wide screens: cap width & center */
              'sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2',
              'sm:w-full sm:max-w-md',
              'sm:rounded-[1.75rem]',
              'sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2',
            ].join(' ')}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--glass-border)]" />
            </div>

            {/* ── Header ─────────────────────────────────── */}
            <div className="px-5 pt-3 pb-3 sm:pt-5 flex items-center justify-between shrink-0 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-3 min-w-0">
                {/* Thumbnail */}
                <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0">
                  <img src={mainImage} className="size-full object-cover" alt="" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] truncate leading-tight">{product.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-[var(--accent)]">{displayPrice?.toLocaleString()} XAF</span>
                    <span className={`text-[11px] lg:text-[12px] font-bold tracking-tight px-1.5 py-0.5 rounded-full ${inStock ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {inStock ? 'In stock' : 'Out of stock'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-colors shrink-0 ml-2"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* ── Scrollable options ─────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
              {product.has_variants && product.variant_types?.map((type) => (
                <div key={type.name}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] lg:text-[12px] font-bold  tracking-[0.15em] text-[var(--text-secondary)]">
                      {type.name}
                    </span>
                    {selectedOptions[type.name] && (
                      <span className="text-[11px] lg:text-[12px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                        {selectedOptions[type.name]}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {type.options.map((option) => {
                      const isColor  = type.name.toLowerCase() === 'color';
                      const hexCode  = type.metadata?.[option];
                      const isActive = selectedOptions[type.name] === option;

                      if (isColor && hexCode) {
                        return (
                          <button
                            key={option}
                            onClick={() => setSelectedOptions(p => ({ ...p, [type.name]: option }))}
                            aria-label={`${option} color`}
                            aria-pressed={isActive}
                            className={`relative size-9 rounded-full transition-all ${isActive ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] scale-110' : 'ring-1 ring-[var(--glass-border)] hover:scale-105'}`}
                          >
                            <div className="absolute inset-0 rounded-full border border-black/10" style={{ backgroundColor: hexCode }} />
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <CheckCircle2 className="size-4 text-white drop-shadow" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={option}
                          onClick={() => setSelectedOptions(p => ({ ...p, [type.name]: option }))}
                          aria-pressed={isActive}
                          className={`px-4 py-2 rounded-xl text-[11px] lg:text-[12px] font-bold border transition-all ${
                            isActive
                              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]'
                              : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Fixed footer / CTA ─────────────────────── */}
            <div className="px-5 pt-3 pb-6 sm:pb-5 shrink-0 border-t border-[var(--glass-border)]">
              <button
                onClick={handleConfirm}
                disabled={loading || !inStock}
                className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2.5 text-[11px] lg:text-[12px] font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                  actionType === 'buy'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white'
                    : 'bg-[var(--accent)] text-white hover:brightness-110'
                }`}
              >
                {loading
                  ? <Loader2 className="size-4 animate-spin" />
                  : actionType === 'buy'
                    ? <Zap className="size-4" />
                    : <ShoppingBag className="size-4" />
                }
                {actionType === 'buy' ? 'Proceed to Checkout' : 'Add to Cart'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
