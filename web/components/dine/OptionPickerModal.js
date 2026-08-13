"use client";

import { useState } from 'react';
import { X, Plus, Minus, ShoppingBag, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

function computeDefaults(optionGroups = []) {
  const selections = {};
  for (const group of optionGroups) {
    const defaults = (group.options || [])
      .filter(o => o.is_default && o.is_available)
      .map(o => o.label);
    selections[group.name] = defaults;
  }
  return selections;
}

export default function OptionPickerModal({ meal, onClose, onAddToCart, adding }) {
  const optionGroups = meal?.meal?.option_groups || [];
  const [selections, setSelections] = useState(() => computeDefaults(optionGroups));
  const [quantity, setQuantity] = useState(1);

  const toggleOption = (groupName, optionLabel, maxSelect) => {
    setSelections(prev => {
      const current = prev[groupName] || [];
      if (current.includes(optionLabel)) {
        return { ...prev, [groupName]: current.filter(l => l !== optionLabel) };
      }
      if (current.length >= maxSelect) {
        // Single-select: replace; multi-select at limit: block
        if (maxSelect === 1) return { ...prev, [groupName]: [optionLabel] };
        return prev;
      }
      return { ...prev, [groupName]: [...current, optionLabel] };
    });
  };

  const totalDelta = optionGroups.reduce((acc, group) => {
    const groupSelections = selections[group.name] || [];
    return acc + (group.options || [])
      .filter(o => groupSelections.includes(o.label))
      .reduce((sum, o) => sum + (o.price_delta || 0), 0);
  }, 0);

  const totalPrice = (meal.price + totalDelta) * quantity;

  const invalidGroups = optionGroups.filter(
    g => g.is_required && (selections[g.name] || []).length < (g.min_select || 1)
  );
  const canAdd = invalidGroups.length === 0;

  const handleAdd = () => {
    if (!canAdd || adding) return;
    const selectedOptions = optionGroups.flatMap(group =>
      (group.options || [])
        .filter(o => (selections[group.name] || []).includes(o.label))
        .map(o => ({
          group_name:   group.name,
          option_label: o.label,
          price_delta:  o.price_delta || 0,
        }))
    );
    onAddToCart({ product_id: meal._id, quantity, selected_options: selectedOptions });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[700] max-h-[90vh] overflow-hidden rounded-t-[24px] bg-[var(--bg-primary)] border-t border-[var(--glass-border)] shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom,16px)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-[var(--glass-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 shrink-0 border-b border-[var(--glass-border)]">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="text-[15px] font-bold text-[var(--text-primary)] font-[Poppins]">{meal.name}</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              {meal.price.toLocaleString()} XAF base price
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Option groups */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {optionGroups.length === 0 ? (
            <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
              No customisation options for this meal.
            </p>
          ) : (
            optionGroups.map(group => (
              <div key={group.name}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-bold text-[var(--text-primary)] font-[Poppins]">
                    {group.name}
                  </h3>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                    group.is_required
                      ? 'bg-orange-500/10 text-orange-500'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}>
                    {group.is_required ? 'Required' : 'Optional'}
                    {' · '}
                    {group.min_select === group.max_select
                      ? `Pick ${group.max_select}`
                      : `Up to ${group.max_select}`}
                  </span>
                </div>
                <div className="space-y-2">
                  {(group.options || []).map(option => {
                    const isSelected = (selections[group.name] || []).includes(option.label);
                    const unavail = !option.is_available;
                    return (
                      <button
                        key={option.label}
                        onClick={() => !unavail && toggleOption(group.name, option.label, group.max_select)}
                        disabled={unavail}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-3 border transition-all ${
                          isSelected
                            ? 'border-orange-500/50 bg-orange-500/8'
                            : unavail
                            ? 'border-[var(--glass-border)] opacity-40 cursor-not-allowed'
                            : 'border-[var(--glass-border)] hover:border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-orange-500 bg-orange-500' : 'border-[var(--glass-border)]'
                          }`}>
                            {isSelected && <Check className="size-3 text-white stroke-[3]" />}
                          </div>
                          <span className="text-[12px] font-medium text-[var(--text-primary)]">
                            {option.label}
                          </span>
                        </div>
                        {option.price_delta > 0 && (
                          <span className="text-[11px] font-semibold text-orange-500">
                            +{option.price_delta.toLocaleString()} XAF
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {group.is_required && (selections[group.name] || []).length < (group.min_select || 1) && (
                  <p className="mt-1.5 text-[10px] text-orange-500 font-medium">
                    Please select at least {group.min_select || 1} option
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Quantity + Add footer */}
        <div className="shrink-0 border-t border-[var(--glass-border)] px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="size-8 rounded-full border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="text-[14px] font-bold text-[var(--text-primary)] w-5 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="size-8 rounded-full border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canAdd || adding}
            className={`w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-[13px] font-bold font-[Poppins] transition-all ${
              canAdd
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 active:scale-[0.99]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-not-allowed opacity-60'
            }`}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-4" />
              {adding ? 'Adding...' : 'Add to cart'}
            </span>
            <span>{totalPrice.toLocaleString()} XAF</span>
          </button>
        </div>
      </motion.div>
    </>
  );
}
