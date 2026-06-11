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
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

const cleanEmail = (value) => value.trim().toLowerCase();
const inputClass = 'w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all placeholder:text-[var(--text-secondary)]/30';
const LOGIN_ACTION_TIMEOUT_MS = 60000;
const OTP_PENDING_KEY = 'aura_pending_otp_email';
const SIGNUP_STATE_KEY = 'aura_pending_signup_state';

const withLoginTimeout = (promise, message) => {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ success: false, timedOut: true, message }), LOGIN_ACTION_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export default function UnifiedAuth() {
  const router = useRouter();
  const { sendOtp, verifyOtp, fetchMe, rememberedEmail, hasHydrated, isAuthenticated, user, resetLoading } = useAuthStore();
  const { t, label } = useLanguage();
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
    try {
      const isSignupResume = window.location.search.includes('signup=1');
      const pendingSignup = isSignupResume
        ? JSON.parse(sessionStorage.getItem(SIGNUP_STATE_KEY) || 'null')
        : null;
      if (pendingSignup?.signupToken && pendingSignup?.email) {
        setEmail(pendingSignup.email);
        setSignupToken(pendingSignup.signupToken);
        setStep('signup');
        return;
      } else if (!isSignupResume) {
        sessionStorage.removeItem(SIGNUP_STATE_KEY);
      }

      const pendingEmail = sessionStorage.getItem(OTP_PENDING_KEY);
      if (pendingEmail) {
        setEmail(pendingEmail);
        setStep('otp');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step !== 'email') return;
    if (hasHydrated && rememberedEmail && !prefilledRef.current) {
      prefilledRef.current = true;
      setEmail(rememberedEmail);
    }
  }, [hasHydrated, rememberedEmail, step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const getAuthDestination = (nextUser) => {
    const role = nextUser?.role?.toLowerCase();
    if (nextUser?.onboarded === false && role !== 'admin') return '/onboarding';
    if (role === 'vendor') return '/vendor/dashboard';
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'logistics') return '/logistics/dashboard';
    return '/discovery';
  };

  const redirectAfterAuth = (nextUser) => {
    const destination = getAuthDestination(nextUser);
    router.replace(destination);

    window.setTimeout(() => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (path === '/login' || path === '/' || path === '/register') {
        window.location.assign(destination);
      }
    }, 700);
  };

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) return;
    redirectAfterAuth(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, isAuthenticated, user?._id]);

  const requestOtp = async (event) => {
    event?.preventDefault();
    if (submitting) return;
    setError('');
    const nextEmail = cleanEmail(email);
    if (!nextEmail) return;
    try {
      sessionStorage.removeItem(SIGNUP_STATE_KEY);
    } catch {}
    if (resendIn > 0) {
      setEmail(nextEmail);
      setOtp('');
      setStep('otp');
      setError(t('login.existingCodeNotice'));
      return;
    }

    setEmail(nextEmail);
    setOtp('');
    setStep('otp');
    try {
      sessionStorage.setItem(OTP_PENDING_KEY, nextEmail);
    } catch {}
    setSubmitting(true);
    try {
      const result = await withLoginTimeout(
        sendOtp(nextEmail),
        t('login.requestTimeout')
      );
      if (!result.success) {
        const waitSeconds = Number(result.retryAfter || 0);
        if (waitSeconds > 0) {
          setEmail(nextEmail);
          setOtp('');
          setResendIn(waitSeconds);
          setStep('otp');
          setError(t('login.existingCodeNotice'));
        } else if (result.timedOut) {
          setResendIn(60);
          setError(t('login.codeArrivedNotice'));
        } else {
          setStep('email');
          setError(result.message);
        }
        return;
      }

      setResendIn(result.data?.resendAfterSeconds || 60);
      setError('');
      toast.success(t('login.codeSent'));
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
        t('login.verifyTimeout')
      );

      if (!result.success) {
        setError(result.message);
        if (result.retryAfter) setResendIn(result.retryAfter);
        return;
      }

      if (result.signupRequired) {
        if (!result.signupToken) {
          setError(t('login.verifyTimeout'));
          return;
        }
        const verifiedEmail = result.email || email;
        try {
          sessionStorage.setItem(SIGNUP_STATE_KEY, JSON.stringify({
            email: verifiedEmail,
            signupToken: result.signupToken,
            savedAt: Date.now(),
          }));
          sessionStorage.removeItem(OTP_PENDING_KEY);
        } catch {}
        setEmail(verifiedEmail);
        setSignupToken(result.signupToken);
        setStep('signup');
        window.setTimeout(() => {
          if (window.location.pathname.replace(/\/+$/, '') === '/login' && !window.location.search.includes('signup=1')) {
            window.location.replace('/login?signup=1');
          }
        }, 150);
        return;
      }

      try {
        sessionStorage.removeItem(OTP_PENDING_KEY);
        sessionStorage.removeItem(SIGNUP_STATE_KEY);
      } catch {}
      let verifiedUser = result.user;
      if (!verifiedUser) {
        const me = await fetchMe?.({ force: true });
        verifiedUser = me?.user;
      }
      if (!verifiedUser) {
        setError(t('login.verifyTimeout'));
        return;
      }
      redirectAfterAuth(verifiedUser);
    } finally {
      setSubmitting(false);
      resetLoading?.();
    }
  };

  const completeSignup = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!profile.name || profile.name.trim().length < 2) return setError(t('login.fullNameRequired'));
    if (!profile.phone) return setError(t('login.phoneRequired'));

    setSubmitting(true);
    try {
      const result = await withLoginTimeout(
        verifyOtp({
          email,
          signupToken,
          name: profile.name,
          phone: profile.phone ? profile.phone.replace(/[\s-]/g, '') : '',
          role: profile.role,
        }),
        t('login.setupTimeout')
      );

      if (!result.success) {
        setError(result.message);
        return;
      }

      try {
        sessionStorage.removeItem(OTP_PENDING_KEY);
        sessionStorage.removeItem(SIGNUP_STATE_KEY);
      } catch {}
      let verifiedUser = result.user;
      if (!verifiedUser) {
        const me = await fetchMe?.({ force: true });
        verifiedUser = me?.user;
      }
      if (!verifiedUser) {
        setError(t('login.setupTimeout'));
        return;
      }
      redirectAfterAuth(verifiedUser);
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
                <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">{t('login.welcome')}</h1>
                <p className="text-[11px] text-[var(--text-secondary)] opacity-60">
                  {t('login.emailHelp')}
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
                label={resendIn > 0 ? t('login.enterCode') : t('login.sendCode')}
                icon={ArrowRight}
              />
              {resendIn > 0 && email && (
                <button
                  type="button"
                  onClick={() => {
                    setOtp('');
                    setStep('otp');
                    setError(t('login.existingCodeNotice'));
                  }}
                  className="w-full rounded-2xl border border-[var(--glass-border)] py-3 text-[11px] font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {t('login.haveCode')}
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
              <BackButton
                onClick={() => {
                  try {
                    sessionStorage.removeItem(SIGNUP_STATE_KEY);
                  } catch {}
                  setStep('email');
                }}
                label={t('login.changeEmail')}
              />

              <div className="space-y-1">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">{t('login.checkEmail')}</h2>
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

              <SubmitButton loading={submitting} label={t('login.verifyCode')} icon={CircleCheck} />

              <button
                type="button"
                onClick={requestOtp}
                disabled={submitting || resendIn > 0}
                className="w-full py-3 rounded-2xl border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] disabled:opacity-45"
              >
                {resendIn > 0 ? t('login.resendIn', undefined, { seconds: resendIn }) : t('login.resendCode')}
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
              <BackButton
                onClick={() => {
                  try {
                    sessionStorage.removeItem(SIGNUP_STATE_KEY);
                    sessionStorage.setItem(OTP_PENDING_KEY, email);
                  } catch {}
                  setSignupToken('');
                  setStep('otp');
                }}
                label={t('login.enterCode')}
              />

              <div className="space-y-1">
                <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">{t('login.createAccount')}</h2>
                <p className="text-[11px] font-semibold text-[var(--accent)] truncate max-w-full opacity-80">{email}</p>
              </div>

              <AuthField icon={User}>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={profile.name}
                  onChange={(event) => updateProfile({ name: event.target.value })}
                  placeholder={t('login.fullName')}
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
                  placeholder={t('login.phoneNumber')}
                  autoComplete="tel"
                  className={inputClass}
                />
              </AuthField>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/50">{t('login.continueAs')}</p>
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
                      <span className="text-[11px] font-semibold tracking-tighter capitalize">{t(`role.${role}`, label(role))}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-3 text-center">
                <p className="text-[11px] font-semibold leading-relaxed text-[var(--text-secondary)] opacity-70">
                  {t('login.onboardingHint')}
                </p>
              </div>

              {error && <ErrorMessage message={error} />}

              <SubmitButton loading={submitting} label={t('login.continueOnboarding')} icon={ArrowRight} />
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-5 border-t border-[var(--glass-border)] pt-4 text-center">
          <p className="mx-auto max-w-[320px] text-[10px] font-medium leading-relaxed text-[var(--text-secondary)]/70">
            {t('login.legalPrefix')}{' '}
            <Link href="/terms" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              {t('login.terms')}
            </Link>
            ,{' '}
            <Link href="/privacy" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              {t('login.privacy')}
            </Link>
            , {t('login.legalMiddle')}{' '}
            <Link href="/cookies" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              {t('login.cookies')}
            </Link>
            , {t('login.legalSuffix')}{' '}
            <Link href="/refund-policy" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              {t('login.legalCenter')}
            </Link>
            .
          </p>
        </div>
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
