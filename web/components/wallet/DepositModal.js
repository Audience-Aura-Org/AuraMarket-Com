"use client";

import { paymentMessage } from '@/lib/paymentLabels';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Loader2, X, CheckCircle2, AlertTriangle,
  XCircle, RotateCcw, Smartphone, ExternalLink,
} from 'lucide-react';
import { initiateSmartCameroonCollection, pollTransactionStatus, recheckTransaction } from '@/services/paymentProvider';
import { FIELD } from '@/lib/formStyles';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';

import { detectPawaPayProvider, estimateMobileMoneyFee, useMobileMoneyFeeRates } from '@/lib/mobileMoneyFees';

/**
 * DepositModal — shared deposit flow for all wallet roles.
 * Props:
 *   open       — boolean, controls visibility
 *   onClose    — called when modal should close (not mid-transaction)
 *   onSuccess  — called after confirmed deposit (refresh parent wallet)
 *   userPhone  — pre-fill phone from user profile
 */
export default function DepositModal({ open, onClose, onSuccess, userPhone = '' }) {
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);
  const [step, setStep]         = useState('amount'); // 'amount' | 'processing' | 'result'
  const [gateway, setGateway]   = useState('pawapay');
  const feeRates = useMobileMoneyFeeRates();
  const [amount, setAmount]     = useState('');
  const [phone, setPhone]       = useState(userPhone);
  const [ref, setRef]           = useState(null);
  const [status, setStatus]     = useState('pending'); // 'pending'|'success'|'failed'|'timeout'
  const [message, setMessage]   = useState('');
  const [reason, setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [orangeHosted, setOrangeHosted] = useState(false);
  const [checkoutUrl, setCheckoutUrl]   = useState(null);

  const inProgressRef  = useRef(false);
  // Holds the stop-polling function returned by pollTransactionStatus
  const stopPollingRef = useRef(null);
  useEffect(() => () => { stopPollingRef.current?.(); }, []);
  useEffect(() => {
    if (!open || !ref || status !== 'pending') return;
    const onPaymentStatus = event => {
      if (event?.gateway !== gateway || event.reference !== ref || event.status !== 'FAILED') return;
      stopPollingRef.current?.(); stopPollingRef.current = null;
      setStatus('failed'); setStep('result'); setReason(event.reason || event.message || 'The mobile-money provider declined this deposit.');
    };
    socketService.on('payment_status', onPaymentStatus);
    return () => socketService.off('payment_status', onPaymentStatus);
  }, [open, ref, status, gateway]);

  // Pre-fill phone when userPhone prop changes (e.g. after auth loads)
  useEffect(() => {
    if (userPhone && !phone) setPhone(userPhone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      stopPollingRef.current?.();
      stopPollingRef.current = null;
      inProgressRef.current = false;
      setStep('amount');
      setGateway('pawapay');
      setAmount('');
      setStatus('pending');
      setReason('');
      setRef(null);
      setMessage('');
      setOrangeHosted(false);
      setCheckoutUrl(null);
    }
  }, [open]);

  if (!open) return null;

  const { netAmount, fee: collectionFee, grossAmount: approvalAmount } = estimateMobileMoneyFee(amount, detectPawaPayProvider(phone) === 'ORANGE_MONEY_CMR' && !feeRates.pawapay_orange_enabled ? 'payunit' : 'pawapay', {
    provider: detectPawaPayProvider(phone),
    rates: feeRates,
  });

  // PayUnit verification returns the committed balance. Applying it directly
  // makes the persistent top nav update even if Socket.IO is delayed or absent.
  const applyConfirmedBalance = (data) => {
    const balance = Number(data?.balance);
    if (Number.isFinite(balance)) {
      setWalletBalance(balance);
    } else {
      window.dispatchEvent(new CustomEvent('aura:wallet-updated'));
    }
  };

  // Shared timeout handler — called by polling onTimeout
  const triggerTimeout = async (localRef, gw) => {
    stopPollingRef.current?.();
    stopPollingRef.current = null;

    setStatus('timeout');
    setStep('result');
    setMessage('Verification window ended. Checking payment status one last time...');
    try {
      if (localRef) {
        const r = await recheckTransaction(gw, localRef);
        if (r.status === 'SUCCESSFUL') {
          setStatus('success');
          setMessage('Payment confirmed! Your wallet has been credited.');
          applyConfirmedBalance(r.data);
          onSuccess?.();
          return;
        } else if (r.status === 'FAILED') {
          setStatus('failed');
          setReason(r.reason || r.message || 'Payment was declined.');
          return;
        }
      }
    } catch { /* silent — show timeout screen */ }
    setMessage('Could not confirm automatically. If you approved the USSD prompt, tap "Recheck Payment" below.');
  };

  const handleInit = async () => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    const min = 1;
    if (!amount || Number(amount) < min) {
      inProgressRef.current = false;
      return;
    }
    if (!phone) {
      inProgressRef.current = false;
      return;
    }

    setStep('processing');
    setMessage('Sending request to payment gateway...');
    setSubmitting(true);

    let localRef = null;
    let gw = gateway;

    try {
      const payload = {
        amount: Number(amount),
        currency: 'XAF',
        phone,
        country: 'CM',
      };

      const res = await initiateSmartCameroonCollection(payload);
      gw = res.gateway || gateway;
      if (gw !== gateway) setGateway(gw);

      if (res.success) {
        localRef = res.data?.reference;
        setRef(localRef);
        const isOrange = res.data?.orange_hosted || false;
        const hostedUrl = res.data?.checkout_url || null;
        setOrangeHosted(isOrange);
        setCheckoutUrl(hostedUrl);
        setMessage(
          isOrange
            ? 'Open the payment page below to authorize your Orange Money payment.'
            : 'Charge request sent. Awaiting approval on your phone...'
        );

        const stopFn = pollTransactionStatus(
          gw,
          localRef,
          {
            onPending: (data) => setMessage(data.message || 'Awaiting mobile money confirmation...'),
            onSuccess: (result) => {
              stopPollingRef.current = null;
              setStatus('success');
              setStep('result');
              setMessage('Payment confirmed! Your wallet has been credited.');
              applyConfirmedBalance(result?.data);
              onSuccess?.();
            },
            onFailed: (data) => {
              stopPollingRef.current = null;
              setStatus('failed');
              setStep('result');
              setReason(data.reason || 'Payment was declined by the gateway.');
            },
            onTimeout: () => triggerTimeout(localRef, gw),
          },
          3000,   // poll every 3 seconds
          300000, // mobile-money approval and callback delivery can take several minutes
        );
        stopPollingRef.current = stopFn;
      } else {
        setStatus('failed');
        setStep('result');
        setReason(res.message || 'Payment initiation failed. Please try again.');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message;
      const body = err?.response?.data;
      const definitiveFailure = body?.status === 'FAILED' || body?.code === 'INSUFFICIENT_FUNDS' || (err.response?.status >= 400 && err.response.status < 500 && ![408,409,429].includes(err.response.status));
      setStatus(definitiveFailure ? 'failed' : 'timeout');
      setStep('result');
      if (definitiveFailure) setReason(body?.reason || errMsg || 'The deposit could not be started. Please check your details and try again.');
      setMessage(
        errMsg
          ? errMsg
          : localRef
            ? 'Request sent but server confirmation was interrupted. Use "Recheck Payment" below.'
            : 'Could not reach the payment gateway. If you received and approved a USSD prompt on your phone, your payment may still be processing.',
      );
      if (localRef) setRef(localRef);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecheck = async () => {
    if (!ref) return;
    setRechecking(true);
    try {
      const res = await recheckTransaction(gateway, ref);
      const { status: s, message: msg, reason: r } = res;
      if (s === 'SUCCESSFUL') {
        setStatus('success');
        setMessage(msg || 'Payment confirmed! Your wallet has been credited.');
        applyConfirmedBalance(res.data);
        onSuccess?.();
      } else if (s === 'FAILED') {
        setStatus('failed');
        setReason(r || msg || 'Payment was declined.');
      } else {
        // Still pending (or the server could not be reached): say so instead of nothing.
        setMessage(msg || 'Payment is still being processed. Approve the prompt on your phone, then check again.');
      }
    } finally {
      setRechecking(false);
    }
  };

  const handleClose = () => {
    if (step !== 'processing') {
      inProgressRef.current = false;
      stopPollingRef.current?.();
      stopPollingRef.current = null;
      onClose?.();
    }
  };

  const handleRetry = () => {
    stopPollingRef.current?.();
    stopPollingRef.current = null;
    inProgressRef.current = false;
    setStep('amount');
    setAmount('');
    setStatus('pending');
    setReason('');
    setRef(null);
    setMessage('');
    setOrangeHosted(false);
    setCheckoutUrl(null);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2rem] p-5 sm:p-6 shadow-2xl overflow-y-auto font-[Poppins]"
      >
        <AnimatePresence mode="wait">
          {/* ── Step: form ─────────────────────────────── */}
          {step === 'amount' && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Deposit Money</h3>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-50 tracking-tight mt-1">Mobile money deposit</p>
                </div>
                <button onClick={handleClose} className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-95">
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--accent)] p-4">
                  <p className="text-sm font-semibold">Mobile Money</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">MTN or Orange Money: approve the prompt on your phone</p>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold tracking-tight opacity-30 ml-1">Deposit amount (XAF)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-xl font-semibold text-center text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-10 shadow-inner tabular-nums"
                  />
                  {netAmount > 0 && (
                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 text-center tabular-nums">
                      You will be charged {approvalAmount.toLocaleString()} XAF (includes {collectionFee.toLocaleString()} XAF Mobile Money fee). {netAmount.toLocaleString()} XAF reaches your wallet and can be withdrawn without fees.
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold tracking-tight opacity-30 ml-1">Account phone</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="6XX XXX XXX"
                      className={`${FIELD} pl-12`}
                    />
                  </div>
                </div>

                <button
                  onClick={handleInit}
                  disabled={submitting || !amount || !phone}
                  className="w-full h-12 bg-emerald-500 text-white rounded-xl font-semibold text-[11px] tracking-tight shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 mt-2 disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
                  Deposit funds
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: processing ───────────────────────── */}
          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center text-center">
              {/* Cancel button */}
              <button
                onClick={() => {
                  stopPollingRef.current?.();
                  stopPollingRef.current = null;
                  inProgressRef.current = false;
                  setStep('amount');
                  setStatus('pending');
                  setMessage('');
                  setReason('');
                  onClose?.();
                }}
                className="absolute top-4 right-4 p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-95"
                title="Cancel payment"
              >
                <X className="size-4" />
              </button>

              {/* Waiting header — pulsing ring + label */}
              <div className="mb-6 flex flex-col items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="size-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                    <Loader2 className="size-7 text-[var(--accent)] animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20 animate-ping" />
                </div>
                <div>
                  <p className="text-base font-bold tracking-tight text-[var(--text-primary)]">Awaiting confirmation</p>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 mt-0.5">Check your phone for the payment prompt</p>
                </div>
              </div>

              <div className="w-full space-y-2 mb-4">
                {[
                  { label: 'Request sent to gateway', done: true, active: false },
                  { label: orangeHosted ? 'Authorize via Orange payment page' : `Approve prompt on ${phone}`, done: false, active: true },
                  { label: 'Confirming payment', done: false, active: false },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    s.done   ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                    s.active ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]' :
                    'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-30'
                  }`}>
                    <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'bg-emerald-500' : s.active ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]'}`}>
                      {s.done   ? <CheckCircle2 className="size-3 text-white" /> :
                       s.active ? <Loader2 className="size-3 text-white animate-spin" /> :
                       <span className="text-[8px] font-bold text-white">{i + 1}</span>}
                    </div>
                    <p className="text-[11px] font-semibold tracking-tight text-left">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Orange Money: show hosted payment page button */}
              {orangeHosted && checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-[11px] tracking-tight flex items-center justify-center gap-2 mb-2 active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                >
                  <ExternalLink className="size-4" />
                  Open Orange Payment Page
                </a>
              )}

              <div className="w-full bg-[var(--bg-secondary)] rounded-xl p-3 border border-[var(--glass-border)] flex items-center gap-3">
                <div className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <p className="text-[11px] font-semibold tracking-tight text-[var(--accent)] text-left">{paymentMessage(message) || 'Waiting for mobile money confirmation...'}</p>
              </div>
              <p className="text-[10px] font-semibold tracking-tight opacity-20 mt-4">
                {orangeHosted ? 'After authorizing on the page, return here — payment is confirmed automatically.' : 'Keep the app open until your payment is confirmed'}
              </p>
            </motion.div>
          )}

          {/* ── Step: result ───────────────────────────── */}
          {step === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-6 flex flex-col items-center text-center">
              <div className={`size-20 rounded-[2rem] mb-6 flex items-center justify-center shadow-lg border ${
                status === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                status === 'timeout' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                'bg-rose-500/10 text-rose-500 border-rose-500/20'
              }`}>
                {status === 'success' ? <CheckCircle2 className="size-10" /> :
                 status === 'timeout' ? <AlertTriangle className="size-10" /> :
                 <XCircle className="size-10" />}
              </div>
              <h4 className={`text-xl font-bold tracking-tight mb-2 ${status === 'success' ? 'text-emerald-500' : status === 'timeout' ? 'text-amber-500' : 'text-rose-500'}`}>
                {status === 'success' ? 'Confirmed' : status === 'timeout' ? 'Timed Out' : /insufficient/i.test(reason) ? 'Insufficient funds' : 'Failed'}
              </h4>
              <div role={status === 'failed' ? 'alert' : 'status'} className="bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl p-4 mb-4 w-full">
                <p className="text-[13px] font-medium text-[var(--text-primary)] leading-relaxed">
                  {paymentMessage(status === 'success' ? message : reason || message)}
                </p>
                {(status === 'failed' || status === 'timeout') && ref && (
                  <p className="text-[10px] font-mono text-rose-400/60 mt-2 tracking-tight break-all">Ref: {ref}</p>
                )}
              </div>

              {(status === 'failed' || status === 'timeout') && ref && (
                <button
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="w-full h-12 rounded-2xl border border-amber-500/30 text-amber-400 font-semibold text-[11px] tracking-tight flex items-center justify-center gap-2 hover:bg-amber-500/5 transition-all mb-3 disabled:opacity-50"
                >
                  {rechecking ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Recheck payment status
                </button>
              )}

              <button
                onClick={status === 'success' ? handleClose : handleRetry}
                className={`w-full h-14 rounded-2xl font-semibold text-[11px] tracking-tight transition-all shadow-lg ${
                  status === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--glass-border)]'
                }`}
              >
                {status === 'success' ? 'Done' : 'Try again'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
