"use client";

import { useState } from 'react';
import { Plus, Zap, ShoppingBag, Store, Activity, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const ACTIONS = {
  vendor: [
    { label: 'Add Product', icon: ShoppingBag, href: '/vendor/products/new', color: 'bg-emerald-500' },
    { label: 'Post Story', icon: Activity, href: '/vendor/stories/new', color: 'bg-purple-500' },
    { label: 'Messages', icon: MessageCircle, href: '/messages', color: 'bg-blue-500' },
  ],
  admin: [
    { label: 'Review Users', icon: Zap, href: '/admin/users', color: 'bg-amber-500' },
    { label: 'Audit Logs', icon: Activity, href: '/admin/audit', color: 'bg-rose-500' },
  ],
  logistics: [
    { label: 'New Manifest', icon: Store, href: '/logistics/manifests', color: 'bg-indigo-500' },
  ]
};

export default function QuickActionsFAB({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const roleActions = ACTIONS[role] || [];

  if (roleActions.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[600] lg:hidden">
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col items-end gap-3 mb-4">
            {roleActions.map((action, idx) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3"
                >
                  <span className="px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/80 backdrop-blur-xl border border-[var(--glass-border)] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] shadow-xl">
                    {action.label}
                  </span>
                  <div className={`size-12 rounded-2xl ${action.color} text-white flex items-center justify-center shadow-lg shadow-${action.color.split('-')[1]}-500/20`}>
                    <action.icon className="size-5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`size-14 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 shadow-2xl ${
          isOpen 
            ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] rotate-45' 
            : 'bg-[var(--accent)] text-white hover:scale-110 active:scale-95 shadow-[var(--accent)]/40'
        }`}
      >
        {isOpen ? <X className="size-6" /> : <Plus className="size-6" />}
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
