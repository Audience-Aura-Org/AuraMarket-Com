"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, Wallet, Smartphone, RefreshCw } from 'lucide-react';
import api from '@/services/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 45; // 4s × 45 = 3 minutes

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);

  const gateway = searchParams.get('gateway');
  const reference = searchParams.get('ref');
  const type = searchParams.get('type'); // 'checkout' | 'deposit'

  const handleSuccess = () => {
    setStatus('success');
    if (type === 'checkout') {
      setMessage('Your order has been paid and confirmed!');
      cartStore.clearCart();
      setTimeout(() => router.push('/orders'), 3500);
    } else {
      setMessage('Your wallet has been credited successfully!');
      setTimeout(() => router.push('/wallet'), 3000);
    }
  };

  const verify = async () => {
    try {
      const ref = reference || searchParams.get('reference') || searchParams.get('trxref');
      if (!ref) {
        setStatus('error');
        setMessage('No transaction reference found. Please contact support.');
        return;
      }

      let endpoint = `/payments/verify/${ref}`;
      if (gateway === 'eversend') endpoint = `/payments/eversend/verify/${ref}`;

      const res = await api.get(endpoint);

      if (res.data.success) {
        const txStatus = res.data.status;

        if (txStatus === 'PENDING' || txStatus === 'pending') {
          // Still waiting — schedule next poll if under limit
          pollCountRef.current += 1;
          setPollCount(pollCountRef.current);

          if (pollCountRef.current >= MAX_POLLS) {
            setStatus('error');
            setMessage('Payment is taking longer than expected. If you approved the request on your phone, please tap "Check Again" below.');
            return;
          }
          timerRef.current = setTimeout(verify, POLL_INTERVAL_MS);
          return;
        }

        // Successful
        handleSuccess();
      } else {
        setStatus('error');
        setMessage(res.data.message || 'Payment verification failed. Please try again.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setStatus('error');
      setMessage(err?.response?.data?.message || 'Could not reach the verification server. Please try again.');
    }
  };

  useEffect(() => {
    if (!reference && gateway !== 'eversend') {
      const paystackRef = searchParams.get('reference') || searchParams.get('trxref');
      if (!paystackRef) {
        setStatus('error');
        setMessage('No transaction reference found.');
        return;
      }
    }
    verify();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    pollCountRef.current = 0;
    setPollCount(0);
    setStatus('verifying');
    setMessage('');
    verify();
  };

  const isEversendPending = gateway === 'eversend' && status === 'verifying';

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 space-y-8">
      {/* Icon */}
      <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center shadow-2xl transition-all duration-700 ${
        status === 'verifying' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' :
        status === 'success'   ? 'bg-emerald-500 text-white scale-110' :
                                 'bg-red-500/10 text-red-500'
      }`}>
        {status === 'verifying' && (isEversendPending
          ? <Smartphone className="w-12 h-12 animate-pulse" />
          : <Loader2 className="w-12 h-12 animate-spin" />
        )}
        {status === 'success' && <CheckCircle2 className="w-12 h-12" />}
        {status === 'error'   && <AlertCircle  className="w-12 h-12" />}
      </div>

      {/* Heading */}
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tighter text-[var(--text-primary)]">
          {status === 'verifying' && (isEversendPending ? 'Awaiting Approval' : 'Verifying Payment')}
          {status === 'success'   && 'Payment Confirmed!'}
          {status === 'error'     && 'Verification Issue'}
        </h1>

        {/* Dynamic message */}
        {isEversendPending && (
          <div className="space-y-2">
            <p className="text-[var(--text-secondary)] font-semibold max-w-sm mx-auto">
              A payment request has been sent to your mobile phone.
            </p>
            <p className="text-[var(--accent)] font-black text-sm uppercase tracking-widest">
              Please check your phone and approve the request.
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 mt-4">
              Checking status… {pollCount > 0 && `(${pollCount}/${MAX_POLLS})`}
            </p>
          </div>
        )}

        {status === 'verifying' && !isEversendPending && (
          <p className="text-[var(--text-secondary)] font-semibold max-w-sm mx-auto">
            Hang tight, we are confirming your payment…
          </p>
        )}

        {(status === 'success' || status === 'error') && message && (
          <p className="text-[var(--text-secondary)] font-semibold max-w-sm mx-auto">
            {message}
          </p>
        )}
      </div>

      {/* Progress bar for polling */}
      {isEversendPending && (
        <div className="w-64 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-[4000ms] ease-linear"
            style={{ width: `${Math.min((pollCount / MAX_POLLS) * 100, 100)}%` }}
          />
        </div>
      )}

      {/* Actions */}
      {status === 'error' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl"
          >
            <RefreshCw className="w-4 h-4" /> Check Again
          </button>
          <button
            onClick={() => router.push('/wallet')}
            className="px-8 py-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-black text-xs uppercase tracking-widest hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all"
          >
            Return to Wallet
          </button>
        </div>
      )}

      {status === 'success' && type === 'checkout' && (
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40 animate-pulse">
          Redirecting to your orders…
        </p>
      )}

      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-20">
        Secured by Eversend · Aura Market
      </p>
    </div>
  );
}

export default function WalletVerifyPage() {
  const { user } = useAuthStore();

  return (
    <DashboardLayout role={user?.role || 'customer'} hideSidebar={true}>
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 glass-panel border-b border-[var(--nav-border)] relative z-10 bg-[var(--nav-bg)] text-[var(--nav-text)]">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Payment Verification</h1>
            <p className="text-xs text-[var(--text-secondary)] font-bold mt-0.5">Secure Gateway</p>
          </div>
        </div>
      </header>

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--accent)] opacity-20" />
        </div>
      }>
        <VerifyContent />
      </Suspense>
    </DashboardLayout>
  );
}
