"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles, SkipForward } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

/**
 * AuraAssistant
 * A non-blocking WhatsApp-style chat overlay that appears on first login.
 * Guides users to onboarding or lets them skip gracefully.
 */
export default function AuraAssistant({ user, onDismiss }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0); // 0=first bubble, 1=second bubble + CTAs
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show only for unauthenticated/non-onboarded customers
    if (!user) return;
    if (user.role !== 'customer') return;
    if (user.onboarded) return;
    if (sessionStorage.getItem('aura_assistant_shown')) return;

    // Delay slightly so homepage renders first
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!visible) return;
    // Second bubble appears after first
    const timer = setTimeout(() => setStep(1), 1600);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleSkip = async () => {
    sessionStorage.setItem('aura_assistant_shown', 'true');
    setDismissed(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 300);

    // Persist skip preference silently
    try {
      await api.patch('/users/me', { onboarding_skipped: true });
    } catch (e) { /* silent fail */ }
  };

  const handleStart = () => {
    sessionStorage.setItem('aura_assistant_shown', 'true');
    setVisible(false);
    router.push('/onboarding');
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-28 right-4 z-[500] w-[320px] max-w-[90vw]"
        >
          {/* Chat Window */}
          <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[var(--accent)] text-white">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black tracking-wide">Aura Assistant</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <p className="text-[9px] opacity-80">Online</p>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chat Bubbles */}
            <div className="p-4 space-y-3 min-h-[120px]">
              
              {/* First message */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-2 items-end"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[220px]">
                  <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
                    👋 Welcome to <span className="text-[var(--accent)] font-black">AuraMarket</span>
                  </p>
                </div>
              </motion.div>

              {/* Second message + CTAs */}
              <AnimatePresence>
                {step >= 1 && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2 items-end"
                    >
                      <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      </div>
                      <div className="bg-[var(--bg-secondary)] rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[220px]">
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          Your profile is calibrated. Ready to explore the <span className="font-bold text-[var(--text-primary)]">Aura Network</span>? 🚀
                        </p>
                      </div>
                    </motion.div>

                    {/* CTA Buttons */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex justify-end gap-2 pt-1"
                    >
                      <button
                        onClick={handleSkip}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all uppercase tracking-widest"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => {
                          sessionStorage.setItem('aura_assistant_shown', 'true');
                          setDismissed(true);
                          setVisible(false);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/30"
                      >
                        Explore Hub
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Typing indicator while waiting for step 2 */}
              {step === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-2 items-end"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0" />
                  <div className="bg-[var(--bg-secondary)] rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-50"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
