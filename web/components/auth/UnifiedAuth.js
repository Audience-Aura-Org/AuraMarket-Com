"use client";
// Force cache bust: v3-clean-fix

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, User, Phone, 
  ArrowRight, ArrowLeft, Sparkles, 
  ChevronRight, ShoppingBag, Store, Truck,
  CircleCheck, Loader2, X, MapPin as AuraMapPin, Globe, Heart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import PasswordInput from '@/components/common/PasswordInput';

/**
 * UnifiedAuth
 * A WhatsApp-style identifier-first authentication hub.
 * Merges login and registration into one seamless, animated flow.
 */
export default function UnifiedAuth() {
  const router = useRouter();
  const { login, register, rememberedEmail, hasHydrated } = useAuthStore();

  // Step state: 'IDENTIFIER' -> 'CHALLENGE' (Existing/New) -> 'CALIBRATION' (New)
  const [step, setStep] = useState('IDENTIFIER'); 
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'customer'
  });

  // Pre-fill remembered email once when the store first hydrates.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (hasHydrated && rememberedEmail && !prefilledRef.current) {
      prefilledRef.current = true;
      setFormData(prev => ({ ...prev, email: rememberedEmail }));
    }
  }, [hasHydrated, rememberedEmail]);

  const nextStep = () => {
    if (step === 'IDENTIFIER') setStep('CHALLENGE');
  };

  const prevStep = () => {
    if (step === 'CHALLENGE') {
      setStep('IDENTIFIER');
      setIsNewUser(false);
    }
  };

  const handleIdentifierSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;
    nextStep();
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    
    // Force dismiss the mobile keyboard safely
    if (typeof document !== 'undefined') {
      const activeEl = document.activeElement;
      if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
      // Also blur any input elements to trigger OS keyboard collapse
      const inputs = document.querySelectorAll('input, button, select, textarea');
      inputs.forEach(input => {
        if (typeof input.blur === 'function') input.blur();
      });
    }

    // Wait a brief period for the browser/OS to process the keyboard collapse transition
    // and reset the viewport dimensions before we set loading or re-render.
    await new Promise(resolve => setTimeout(resolve, 250));

    setLoading(true);
    setError('');

    try {
      if (isNewUser) {
        // Registering
        const formattedData = {
          ...formData,
          phone: formData.phone ? formData.phone.replace(/[\s-]/g, '') : formData.phone
        };
        const result = await register(formattedData);
        if (result.success) {
          // Double check keyboard is down on success
          if (typeof document !== 'undefined' && document.activeElement) {
            document.activeElement.blur();
          }
          setTimeout(() => {
            handleRedirect();
          }, 600); // Give ample time for layout to fully settle before page transition
        } else {
          setError(result.message || 'Registration failed');
        }
      } else {
        // Logging in
        const result = await login({ email: formData.email, password: formData.password });
        if (result.success) {
          // Double check keyboard is down on success
          if (typeof document !== 'undefined' && document.activeElement) {
            document.activeElement.blur();
          }
          setTimeout(() => {
            handleRedirect();
          }, 600); // Give ample time for layout to fully settle before page transition
        }
        else setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = () => {
    const user = useAuthStore.getState().user;
    const role = user?.role?.toLowerCase();
    
    if (role === 'vendor') {
      router.push('/vendor/dashboard');
    } else if (role === 'admin') {
      router.push('/admin/dashboard');
    } else if (role === 'logistics') {
      router.push('/logistics/dashboard');
    } else {
      if (user?.onboarded === false) {
        router.push('/onboarding');
      } else {
        router.push('/discovery');
      }
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto transition-all duration-700">
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[2rem] p-5 md:p-7 shadow-2xl relative overflow-hidden">
        
        {/* Progress Bar (Aesthetic Dots) */}
        <div className="flex justify-center gap-1 mb-6">
          <div className="h-1 rounded-full transition-all duration-500 w-8 bg-[var(--accent)]" />
          <div className={`h-1 rounded-full transition-all duration-500 ${step === 'CHALLENGE' ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--accent)]/30'}`} />
        </div>

        <AnimatePresence mode="wait">
          {step === 'IDENTIFIER' ? (
            <motion.div
              key="identifier"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              <div className="text-center space-y-1">
                <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Welcome to Aura</h1>
                <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-60">
                  Enter your email to continue
                </p>
              </div>

              <form onSubmit={handleIdentifierSubmit} className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-colors group-focus-within:text-[var(--accent)]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="name@example.com"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[11px] lg:text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-white font-semibold text-[12px] shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="pt-4 border-t border-[var(--glass-border)] text-center">
                <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-50 mb-3">New to Aura Dime?</p>
                <button
                  onClick={() => {
                    setIsNewUser(true);
                    setStep('CHALLENGE');
                  }}
                  className="w-full py-3.5 rounded-2xl border border-[var(--accent)]/30 text-[var(--accent)] font-semibold text-[11px] lg:text-[12px] hover:bg-[var(--accent)]/5 transition-all"
                >
                  Create an account
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="challenge"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-2 text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all mb-2"
              >
                <ArrowLeft className="w-3 h-3" />
                Change email
              </button>

              <div className="space-y-0.5">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">
                  {isNewUser ? 'Create your account' : 'Enter your password'}
                </h2>
                <p className="text-[11px] lg:text-[12px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">
                  {formData.email}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] lg:text-[12px] font-semibold text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleFinalSubmit} className="space-y-4">
                {isNewUser && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Full Name"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[11px] lg:text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>

                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="Email Address"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[11px] lg:text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>

                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="Phone Number"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[11px] lg:text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                       {['customer', 'vendor', 'logistics'].map((r) => (
                         <button
                           key={r}
                           type="button"
                           onClick={() => setFormData({...formData, role: r})}
                           className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all ${
                             formData.role === r 
                             ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' 
                             : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                           }`}
                         >
                           {r === 'customer' && <ShoppingBag className="w-4 h-4" />}
                           {r === 'vendor' && <Store className="w-4 h-4" />}
                           {r === 'logistics' && <Truck className="w-4 h-4" />}
                           <span className="text-[11px] lg:text-[12px] font-semibold tracking-tighter">{r}</span>
                         </button>
                       ))}
                    </div>
                  </motion.div>
                )}

                <PasswordInput
                  required
                  icon={Lock}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  autoComplete={isNewUser ? 'new-password' : 'current-password'}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-12 pr-12 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all placeholder:text-[var(--text-secondary)]/30"
                />

                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setIsNewUser(!isNewUser)}
                    className="text-[11px] lg:text-[12px] font-medium text-[var(--accent)] hover:opacity-70 transition-all"
                  >
                    {isNewUser ? 'I already have an account' : 'I\'m new to Auradime'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-white font-semibold text-[12px] shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    isNewUser ? 'Join Aura' : 'Sign in'
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-8 text-center text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-[0.3em] opacity-40">
      </p>
    </div>
  );
}
