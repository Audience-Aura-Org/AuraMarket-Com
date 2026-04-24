"use client";

import { useState, useEffect } from 'react';
import { X, CheckCircle2, ShoppingBag, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BlurUpImage from './BlurUpImage';

/**
 * VariantSelectorModal - A premium popup for selecting product variants
 * before adding to cart or buying now.
 */
export default function VariantSelectorModal({ 
  isOpen, 
  onClose, 
  product, 
  onConfirm, 
  actionType = 'cart' 
}) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [currentVariant, setCurrentVariant] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product?.has_variants && product.variant_types?.length > 0) {
      const defaults = {};
      product.variant_types.forEach(type => {
        if (type.options?.length > 0) defaults[type.name] = type.options[0];
      });
      setSelectedOptions(defaults);
    }
  }, [product, isOpen]);

  useEffect(() => {
    if (product?.has_variants && product.sku_variants?.length > 0) {
      const match = product.sku_variants.find(v => 
        Object.entries(selectedOptions).every(([k, val]) => v.combination[k] === val)
      );
      setCurrentVariant(match || null);
    } else {
      setCurrentVariant(null);
    }
  }, [selectedOptions, product]);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(currentVariant || product);
    setLoading(false);
    onClose();
  };

  if (!product) return null;

  const displayPrice = currentVariant ? currentVariant.price : product.price;
  const inStock = currentVariant ? currentVariant.stock > 0 : product.stock > 0;
  const images = product.images || [];
  const mainImage = currentVariant?.image || images[0]?.url || images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[var(--bg-primary)] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[var(--glass-border)]"
          >
            {/* Header */}
            <div className="p-6 pb-0 flex items-center justify-between">
               <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Selection Required</h3>
               <button onClick={onClose} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--glass-border)] transition-colors">
                 <X className="size-5" />
               </button>
            </div>

            <div className="p-6 flex flex-col gap-8 max-h-[80vh] overflow-y-auto no-scrollbar">
              {/* Product Info Summary */}
              <div className="flex gap-6 items-center bg-[var(--bg-secondary)] p-4 rounded-3xl border border-[var(--glass-border)]">
                <div className="size-20 rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-black shrink-0">
                  <BlurUpImage src={mainImage} className="size-full" objectFit="contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-black text-[var(--text-primary)] truncate leading-tight mb-1">{product.name}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-[var(--accent)]">{displayPrice?.toLocaleString()} XAF</span>
                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${inStock ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {inStock ? 'In Stock' : 'Out of Stock'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Variant Options */}
              {product.has_variants && product.variant_types?.map((type) => (
                <div key={type.name} className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                      {type.name}
                    </span>
                    <span className="text-[9px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2.5 py-1 rounded-full uppercase">
                      {selectedOptions[type.name]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {type.options.map((option) => {
                      const isColor = type.name.toLowerCase() === 'color';
                      const hexCode = type.metadata?.[option];
                      const isActive = selectedOptions[type.name] === option;

                      if (isColor && hexCode) {
                        return (
                          <button
                            key={option}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [type.name]: option }))}
                            className={`group relative flex items-center justify-center size-10 rounded-full transition-all ${
                              isActive ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 scale-110' : 'ring-1 ring-[var(--glass-border)] hover:scale-105'
                            }`}
                          >
                            <div 
                              className="size-full rounded-full border border-black/10 shadow-inner"
                              style={{ backgroundColor: hexCode }}
                            />
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <CheckCircle2 className="size-4 text-white drop-shadow-md" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={option}
                          onClick={() => setSelectedOptions(prev => ({ ...prev, [type.name]: option }))}
                          className={`px-5 py-2.5 rounded-full text-[11px] font-bold border-2 transition-all ${
                            isActive
                              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-lg'
                              : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]/40 hover:text-[var(--text-primary)]'
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

            {/* Actions */}
            <div className="p-6 pt-0">
               <button 
                 onClick={handleConfirm}
                 disabled={loading || !inStock}
                 className={`w-full h-14 rounded-full flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${
                   actionType === 'buy'
                   ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white'
                   : 'bg-[var(--accent)] text-white hover:brightness-110'
                 } disabled:opacity-50 disabled:cursor-not-allowed`}
               >
                 {loading ? <Loader2 className="size-5 animate-spin" /> : actionType === 'buy' ? <Zap className="size-5" /> : <ShoppingBag className="size-5" />}
                 {actionType === 'buy' ? 'Proceed to Checkout' : 'Confirm & Add to Cart'}
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
