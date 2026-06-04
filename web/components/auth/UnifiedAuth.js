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
const LOGIN_ACTION_TIMEOUT_MS = 60000;

const withLoginTimeout = (promise, message) => {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ success: false, timedOut: true, message }), LOGIN_ACTION_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export default function UnifiedAuth() {
  const router = useRouter();
  const { sendOtp, verifyOtp, rememberedEmail, hasHydrated, resetLoading } = useAuthStore();
  const prefilledRef = useRef(false);

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    role: 'customer',
  });

  useEffect(() => {
    resetLoading?.();
    setSubmitting(false);
  }, [resetLoading]);

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
    if (user?.onboarded === false && role !== 'admin') router.push('/onboarding');
    else if (role === 'vendor') router.push('/vendor/dashboard');
    else if (role === 'admin') router.push('/admin/dashboard');
    else if (role === 'logistics') router.push('/logistics/dashboard');
    else router.push('/discovery');
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    if (submitting) return;
    setError('');
    const nextEmail = cleanEmail(email);
    if (!nextEmail) return;
    if (resendIn > 0) {
      setEmail(nextEmail);
      setOtp('');
      setStep('otp');
      setError('Enter the code we already sent. You can request a new one when the timer ends.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await withLoginTimeout(
        sendOtp(nextEmail),
        'The code request is taking too long. Please check your connection or try another network.'
      );
      if (!result.success) {
        const waitSeconds = Number(result.retryAfter || 0);
        if (waitSeconds > 0) {
          setEmail(nextEmail);
          setOtp('');
          setResendIn(waitSeconds);
          setStep('otp');
          setError('Enter the code we already sent. You can request a new one when the timer ends.');
        } else if (result.timedOut) {
          setEmail(nextEmail);
          setOtp('');
          setResendIn(60);
          setStep('otp');
          setError('If the code arrived, enter it here. You can resend when the timer ends.');
        } else {
          setError(result.message);
        }
        return;
      }

      setEmail(nextEmail);
      setOtp('');
      setResendIn(result.data?.resendAfterSeconds || 60);
      setStep('otp');
      toast.success('Verification code sent');
    } finally {
      setSubmitting(false);
      resetLoading?.();
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await withLoginTimeout(
        verifyOtp({ email, otp }),
        'Verification is taking too long. Please try again.'
      );

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
    } finally {
      setSubmitting(false);
      resetLoading?.();
    }
  };

  const completeSignup = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!profile.name || profile.name.trim().length < 2) return setError('Full name is required.');
    if (!profile.phone) return setError('Phone number is required.');

    setSubmitting(true);
    try {
      const result = await withLoginTimeout(
        verifyOtp({
          signupToken,
          name: profile.name,
          phone: profile.phone ? profile.phone.replace(/[\s-]/g, '') : '',
          role: profile.role,
        }),
        'Account setup is taking too long. Please try again.'
      );

      if (!result.success) {
        setError(result.message);
        return;
      }

      redirectAfterAuth(result.user);
    } finally {
      setSubmitting(false);
      resetLoading?.();
    }
  };

  const updateProfile = (patch) => setProfile((current) => ({ ...current, ...patch }));

  return (
    <div className="w-full max-w-[420px] mx-auto transition-all duration-700">
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[2rem] p-5 md:p-7 shadow-2xl relative max-h-[calc(100vh-3rem)] overflow-y-auto">
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
              {resendIn > 0 && (
                <CooldownNotice seconds={resendIn} />
              )}

              <SubmitButton
                loading={submitting}
                label={resendIn > 0 ? 'Enter code' : 'Send code'}
                icon={ArrowRight}
              />
              {resendIn > 0 && email && (
                <button
                  type="button"
                  onClick={() => {
                    setOtp('');
                    setStep('otp');
                    setError('Enter the code we already sent. You can request a new one when the timer ends.');
                  }}
                  className="w-full rounded-2xl border border-[var(--glass-border)] py-3 text-[11px] font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  I already have a code
                </button>
              )}
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
              {resendIn > 0 && (
                <CooldownNotice seconds={resendIn} />
              )}

              <SubmitButton loading={submitting} label="Verify code" icon={CircleCheck} />

              <button
                type="button"
                onClick={requestOtp}
                disabled={submitting || resendIn > 0}
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
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">Create your account</h2>
                <p className="text-[11px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">{email}</p>
              </div>

              <AuthField icon={User}>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={profile.name}
                  onChange={(event) => updateProfile({ name: event.target.value })}
                  placeholder="Full name"
                  autoComplete="name"
                  className={inputClass}
                />
              </AuthField>

              <AuthField icon={Phone}>
                <input
                  type="tel"
                  required
                  value={profile.phone}
                  onChange={(event) => updateProfile({ phone: event.target.value })}
                  placeholder="Phone number"
                  autoComplete="tel"
                  className={inputClass}
                />
              </AuthField>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/50">Continue as</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['customer', ShoppingBag],
                    ['vendor', Store],
                    ['logistics', Truck],
                  ].map(([role, Icon]) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => updateProfile({ role })}
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
              </div>

              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-3 text-center">
                <p className="text-[11px] font-semibold leading-relaxed text-[var(--text-secondary)] opacity-70">
                  After this, we will open the guided onboarding flow to finish your role setup.
                </p>
              </div>

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={submitting} label="Continue to onboarding" icon={ArrowRight} />
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

function SubmitButton({ loading, disabled = false, label, icon: Icon }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
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

function CooldownNotice({ seconds }) {
  return (
    <div className="rounded-2xl border border-[var(--accent)]/15 bg-[var(--accent)]/5 px-4 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]/70">Wait time</p>
      <p className="mt-1 text-[12px] font-semibold text-[var(--text-primary)]">
        You can request another code in {seconds}s.
      </p>
    </div>
  );
}
