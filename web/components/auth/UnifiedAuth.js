"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Loader2,
  Mail,
  Phone,
  ShoppingBag,
  Store,
  Truck,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';

const cleanEmail = (value) => value.trim().toLowerCase();
const inputClass = 'w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30';

export default function UnifiedAuth() {
  const router = useRouter();
  const { sendOtp, verifyOtp, rememberedEmail, hasHydrated, loading } = useAuthStore();
  const prefilledRef = useRef(false);

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    role: 'customer',
  });

  useEffect(() => {
    if (hasHydrated && rememberedEmail && !prefilledRef.current) {
      prefilledRef.current = true;
      setEmail(rememberedEmail);
    }
  }, [hasHydrated, rememberedEmail]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const redirectAfterAuth = (user) => {
    const role = user?.role?.toLowerCase();
    if (role === 'vendor') router.push('/vendor/dashboard');
    else if (role === 'admin') router.push('/admin/dashboard');
    else if (role === 'logistics') router.push('/logistics/dashboard');
    else if (user?.onboarded === false) router.push('/onboarding');
    else router.push('/discovery');
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    setError('');
    const nextEmail = cleanEmail(email);
    if (!nextEmail) return;

    const result = await sendOtp(nextEmail);
    if (!result.success) {
      setError(result.message);
      if (result.retryAfter) setResendIn(result.retryAfter);
      return;
    }

    setEmail(nextEmail);
    setOtp('');
    setResendIn(result.data?.resendAfterSeconds || 60);
    setStep('otp');
    toast.success('Verification code sent');
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError('');
    const result = await verifyOtp({ email, otp });

    if (!result.success) {
      setError(result.message);
      if (result.retryAfter) setResendIn(result.retryAfter);
      return;
    }

    if (result.signupRequired) {
      setSignupToken(result.signupToken);
      setStep('signup');
      return;
    }

    redirectAfterAuth(result.user);
  };

  const completeSignup = async (event) => {
    event.preventDefault();
    setError('');

    const result = await verifyOtp({
      signupToken,
      name: profile.name,
      phone: profile.phone ? profile.phone.replace(/[\s-]/g, '') : '',
      role: profile.role,
    });

    if (!result.success) {
      setError(result.message);
      return;
    }

    redirectAfterAuth(result.user);
  };

  return (
    <div className="w-full max-w-[420px] mx-auto transition-all duration-700">
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[2rem] p-5 md:p-7 shadow-2xl relative overflow-hidden">
        <div className="flex justify-center gap-1 mb-6">
          {['email', 'otp', 'signup'].map((id) => (
            <div
              key={id}
              className={`h-1 rounded-full transition-all duration-500 ${
                step === id ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-[var(--accent)]/30'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={requestOtp}
              className="space-y-5"
            >
              <div className="text-center space-y-1">
                <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Welcome to Aura Dime</h1>
                <p className="text-[11px] text-[var(--text-secondary)] opacity-60">
                  Enter your email and we will send a verification code.
                </p>
              </div>

              <AuthField icon={Mail}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </AuthField>

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={loading} label="Send code" icon={ArrowRight} />
            </motion.form>
          )}

          {step === 'otp' && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={verifyCode}
              className="space-y-5"
            >
              <BackButton onClick={() => setStep('email')} label="Change email" />

              <div className="space-y-1">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">Check your email</h2>
                <p className="text-[11px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">{email}</p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 px-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/20"
              />

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={loading} label="Verify code" icon={CircleCheck} />

              <button
                type="button"
                onClick={requestOtp}
                disabled={loading || resendIn > 0}
                className="w-full py-3 rounded-2xl border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] disabled:opacity-45"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
            </motion.form>
          )}

          {step === 'signup' && (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={completeSignup}
              className="space-y-5"
            >
              <BackButton onClick={() => setStep('otp')} label="Back to code" />

              <div className="space-y-1">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">Complete your profile</h2>
                <p className="text-[11px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">{email}</p>
              </div>

              <AuthField icon={User}>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  placeholder="Full name"
                  autoComplete="name"
                  className={inputClass}
                />
              </AuthField>

              <AuthField icon={Phone}>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                  placeholder="Phone number"
                  autoComplete="tel"
                  className={inputClass}
                />
              </AuthField>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ['customer', ShoppingBag],
                  ['vendor', Store],
                  ['logistics', Truck],
                ].map(([role, Icon]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setProfile({ ...profile, role })}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all ${
                      profile.role === role
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-semibold tracking-tighter capitalize">{role}</span>
                  </button>
                ))}
              </div>

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={loading} label="Enter Auradime" icon={ArrowRight} />
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AuthField({ icon: Icon, children }) {
  return (
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-colors group-focus-within:text-[var(--accent)]">
        <Icon className="w-5 h-5" />
      </div>
      {children}
    </div>
  );
}

function SubmitButton({ loading, label, icon: Icon }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-white font-semibold text-[12px] shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{label}</span><Icon className="w-4 h-4" /></>}
    </button>
  );
}

function BackButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all mb-2"
    >
      <ArrowLeft className="w-3 h-3" />
      {label}
    </button>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-semibold text-center">
      {message}
    </div>
  );
}
