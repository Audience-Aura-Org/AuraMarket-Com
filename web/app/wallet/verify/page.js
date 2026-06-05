"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  AlertTriangle, ArrowLeft, Wallet, RotateCcw, X,
  Smartphone, ChevronRight
} from 'lucide-react';
import { pollTransactionStatus, recheckTransaction } from '@/services/paymentProvider';
import api from '@/services/api';
import Link from 'next/link';
import cartStore from '@/services/cartStore';
import { useAuthStore } from '@/hooks/useAuth';

// ── Payment State Machine ─────────────────────────────────────────────────────
// States: 'loading' | 'pending' | 'successful' | 'failed' | 'timeout' | 'recheck'

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);

  const ref = searchParams.get('ref');
  const gateway = searchParams.get('gateway');
  const type = searchParams.get('type'); // 'checkout' | 'deposit'

  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('Initiating payment verification...');
  const [reason, setReason] = useState('');
  const [balanceAdded, setBalanceAdded] = useState(0);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const stopPollingRef = useRef(null);

  useEffect(() => {
    if (!ref) {
      setState('failed');
      setMessage('No transaction reference found.');
      setReason('Please go back and try again.');
      return;
    }

    if (gateway === 'eversend') {
      setState('pending');
      setMessage('Payment request sent to your phone. Please approve the prompt to continue.');

      // Start polling
      const stopFn = pollTransactionStatus(
        gateway,
        ref,
        {
          onPending: ({ message: msg }) => {
            setState('pending');
            setMessage(msg || 'Payment is being processed. Please approve on your phone...');
          },
          onSuccess: ({ data, message: msg }) => {
            setState('successful');
            setMessage(msg || 'Payment confirmed! Your transaction is complete.');
            setBalanceAdded(data?.balance_added || 0);
            refreshWalletBalance?.();
            if (type === 'checkout') cartStore.clearCart();
          },
          onFailed: ({ reason: r }) => {
            setState('failed');
            setReason(r || 'Payment was declined. Please try again.');
            setMessage('Your payment could not be processed.');
          },
          onTimeout: () => {
            setState('timeout');
            setMessage('Payment verification timed out. The request may still be processing on the gateway.');
          },
        },
        5000,  // poll every 5s
        600000  // 10 min max before timeout
      );

      stopPollingRef.current = stopFn;

    } else if (gateway === 'mesomb') {
      // MeSomb — poll our own /api/payments/mesomb/verify/:ref endpoint
      setState('pending');
      setMessage('A USSD prompt has been sent to your phone. Approve it to complete payment.');

      let timeoutId;
      let attempts = 0;
      const MAX_ATTEMPTS = 120; // 120 × 5s = 10 min

      const poll = async () => {
        try {
          attempts++;
          const res = await api.get(`/payments/mesomb/verify/${ref}`);
          const { status, reason: r } = res.data?.data || {};

          if (status === 'SUCCESSFUL') {
            setState('successful');
            setMessage('Payment confirmed! Your account has been updated.');
            refreshWalletBalance?.();
            if (type === 'checkout') cartStore.clearCart();
            return;
          }
          if (status === 'FAILED') {
            setState('failed');
            setReason(r || 'Payment was declined or expired. Please try again.');
            setMessage('Your payment could not be processed.');
            return;
          }
          // Still pending
          if (attempts >= MAX_ATTEMPTS) {
            setState('timeout');
            setMessage('Verification is taking longer than expected. If you have already approved the prompt, your payment will be processed shortly. You can also use the Recheck button below.');
            return;
          }
          timeoutId = setTimeout(poll, 5000);
        } catch {
          timeoutId = setTimeout(poll, 6000);
        }
      };

      timeoutId = setTimeout(poll, 5000);
      stopPollingRef.current = () => clearTimeout(timeoutId);

    } else {
      // Paystack or other — legacy redirect verify
      setState('successful');
    }

    return () => {
      if (stopPollingRef.current) stopPollingRef.current();
    };
  }, [ref, gateway, type, refreshWalletBalance]);


  const handleRecheck = async () => {
    if (!ref) return;
    setRecheckLoading(true);
    setState('recheck');
    setMessage(`Re-checking payment status from ${gateway}...`);

    let result;
    if (gateway === 'mesomb') {
      try {
        const res = await api.get(`/payments/mesomb/verify/${ref}`);
        result = res.data?.data || { status: 'PENDING' };
      } catch {
        result = { status: 'PENDING', message: 'Could not reach server. Try again.' };
      }
    } else {
      result = await recheckTransaction(gateway, ref);
    }

    setRecheckLoading(false);
    if (result.status === 'SUCCESSFUL') {
      setState('successful');
      setMessage(result.message || 'Payment confirmed!');
      setBalanceAdded(result.data?.balance_added || 0);
      refreshWalletBalance?.();
      if (type === 'checkout') cartStore.clearCart();
    } else if (result.status === 'FAILED') {
      setState('failed');
      setReason(result.reason || result.message || 'Payment failed.');
      setMessage('Your payment could not be confirmed.');
    } else {
      setState('timeout');
      setMessage(result.message || 'Still processing. Check back shortly.');
    }
  };

  const stateConfig = {
    loading: {
      icon: <Loader2 className="size-10 animate-spin text-[var(--accent)]" />,
      bg: 'bg-[var(--accent)]/5',
      border: 'border-[var(--accent)]/20',
      title: 'Connecting...',
      color: 'text-[var(--accent)]',
    },
    pending: {
      icon: <div className="relative"><Smartphone className="size-10 text-[var(--accent)]" /><span className="absolute -top-1 -right-1 size-3 bg-[var(--accent)] rounded-full animate-pulse" /></div>,
      bg: 'bg-[var(--accent)]/5',
      border: 'border-[var(--accent)]/20',
      title: 'Awaiting Approval',
      color: 'text-[var(--accent)]',
    },
    recheck: {
      icon: <RotateCcw className="size-10 text-blue-500 animate-spin" />,
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20',
      title: 'Rechecking...',
      color: 'text-blue-500',
    },
    successful: {
      icon: <CheckCircle2 className="size-10 text-emerald-500" />,
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/20',
      title: 'Payment Confirmed',
      color: 'text-emerald-500',
    },
    failed: {
      icon: <XCircle className="size-10 text-red-500" />,
      bg: 'bg-red-500/5',
      border: 'border-red-500/20',
      title: 'Payment Failed',
      color: 'text-red-500',
    },
    timeout: {
      icon: <AlertTriangle className="size-10 text-amber-500" />,
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      title: 'Verification Timed Out',
      color: 'text-amber-500',
    },
  };

  const cfg = stateConfig[state] || stateConfig.loading;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4 py-12 text-[var(--text-primary)]">
      
      {/* Back nav */}
      <div className="absolute top-6 left-6">
        <Link href={type === 'checkout' ? '/orders' : '/wallet'} className="flex items-center gap-2 text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft className="size-4" />
          {type === 'checkout' ? 'View Orders' : 'Back to Wallet'}
        </Link>
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.4 }}
            className={`rounded-[2.5rem] border ${cfg.bg} ${cfg.border} p-10 shadow-2xl backdrop-blur-xl`}
          >
            {/* Icon */}
            <div className="flex justify-center mb-8">
              <div className={`size-20 rounded-[2rem] ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                {cfg.icon}
              </div>
            </div>

            {/* Title & message */}
            <div className="text-center space-y-3 mb-8">
              <h1 className={`text-2xl  font-bold tracking-tighter ${cfg.color}`}>{cfg.title}</h1>
              <p className="text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight leading-relaxed opacity-70">
                {message}
              </p>
              {reason && (
                <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[11px] lg:text-[12px]  font-semibold text-red-400 tracking-tight">{reason}</p>
                </div>
              )}
            </div>

            {/* Success — balance info */}
            {state === 'successful' && balanceAdded > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <Wallet className="size-5 text-emerald-500 shrink-0" />
                <p className="text-[12px]  font-semibold text-emerald-500 tracking-tight">
                  +{balanceAdded.toLocaleString()} XAF added to your wallet
                </p>
              </div>
            )}

            {/* Pending — pulsing progress bar */}
            {(state === 'pending' || state === 'loading') && (
              <div className="w-full h-1.5 bg-[var(--glass-border)] rounded-full overflow-hidden mb-6">
                <div className="h-full bg-[var(--accent)] rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {state === 'successful' && (
                <>
                  <button
                    onClick={() => router.push(type === 'checkout' ? '/orders' : '/wallet')}
                    className="w-full h-12 rounded-2xl bg-emerald-500 text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {type === 'checkout' ? 'View My Orders' : 'Back to Wallet'}
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    onClick={() => router.push('/discovery')}
                    className="w-full h-12 rounded-2xl border border-[var(--glass-border)] text-[var(--text-secondary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] transition-all"
                  >
                    Continue Shopping
                  </button>
                </>
              )}

              {state === 'timeout' && (
                <>
                  <button
                    onClick={handleRecheck}
                    disabled={recheckLoading}
                    className="w-full h-12 rounded-2xl bg-amber-500 text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {recheckLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Recheck Payment Status
                  </button>
                  <Link href="/wallet/transactions" className="block w-full h-12 rounded-2xl border border-[var(--glass-border)] text-[var(--text-secondary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:border-[var(--accent)]/40 transition-all">
                    View Transaction History
                  </Link>
                </>
              )}

              {state === 'failed' && (
                <>
                  <button
                    onClick={() => router.back()}
                    className="w-full h-12 rounded-2xl bg-[var(--accent)] text-white  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
                  >
                    <RotateCcw className="size-4" />
                    Retry Payment
                  </button>
                  <button
                    onClick={handleRecheck}
                    disabled={recheckLoading}
                    className="w-full h-12 rounded-2xl border border-[var(--glass-border)] text-[var(--text-secondary)]  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:border-[var(--accent)]/40 transition-all disabled:opacity-50"
                  >
                    {recheckLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Recheck Payment
                  </button>
                  <button
                    onClick={() => router.push(type === 'checkout' ? '/cart' : '/wallet')}
                    className="w-full h-12 rounded-2xl border border-red-500/20 text-red-400  font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 hover:bg-red-500/5 transition-all"
                  >
                    <X className="size-4" />
                    Cancel
                  </button>
                </>
              )}

              {state === 'recheck' && (
                <div className="flex items-center justify-center gap-2 text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-60">
                  <Loader2 className="size-4 animate-spin" />
                  Fetching latest status...
                </div>
              )}
            </div>

            {/* Reference display */}
            {ref && state !== 'loading' && (
              <p className="text-center text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 tracking-tight mt-6">
                Ref: {ref}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
