"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Loader2, X, CheckCircle2, AlertTriangle,
  XCircle, RotateCcw, Smartphone,
} from 'lucide-react';
import { initiateCollection, pollTransactionStatus } from '@/services/paymentProvider';
import api from '@/services/api';

const MOBILE_MONEY_COLLECTION_FEE_XAF = 50;
const COUNTDOWN_SECS = 180; // 3 minutes

/**
 * CountdownTimer — counts down from totalSecs to 0.
 * Calls onExpire() exactly once when it reaches 0.
 * Uses setTimeout-per-tick so each decrement is independent.
 */
function CountdownTimer({ totalSecs = COUNTDOWN_SECS, onExpire }) {
  const [remaining, setRemaining] = useState(totalSecs);
  const onExpireRef = useRef(onExpire);
  const firedRef = useRef(false);
  useEffect(() => { onExpireRef.current = onExpire; });

  useEffect(() => {
    firedRef.current = false;
    setRemaining(totalSecs);
  }, [totalSecs]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const label = `${m}:${s.toString().padStart(2, '0')}`;
  const pct = totalSecs > 0 ? remaining / totalSecs : 0;
  const isUrgent   = remaining <= 30;
  const isCritical = remaining <= 10;
  const color = isCritical ? 'text-rose-500' : isUrgent ? 'text-amber-500' : 'text-[var(--accent)]';
  const barColor  = isCritical ? 'bg-rose-500'  : isUrgent ? 'bg-amber-500'  : 'bg-[var(--accent)]';

  return (
    <div className="mb-6 flex flex-col items-center w-full">
      <div className={`text-4xl font-bold tracking-tight tabular-nums ${color}`}>{label}</div>
      <p className="text-[10px] font-semibold opacity-30 tracking-tight mt-1">remaining</p>
      <div className="w-full h-1 bg-[var(--bg-secondary)] rounded-full mt-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * DepositModal — shared deposit flow for all wallet roles.
 * Props:
 *   open       — boolean, controls visibility
 *   onClose    — called when modal should close (not mid-transaction)
 *   onSuccess  — called after confirmed deposit (refresh parent wallet)
 *   userPhone  — pre-fill phone from user profile
 */
export default function DepositModal({ open, onClose, onSuccess, userPhone = '' }) {
  const [step, setStep]         = useState('amount'); // 'amount' | 'processing' | 'result'
  const [gateway, setGateway]   = useState('payunit');
  const [amount, setAmount]     = useState('');
  const [phone, setPhone]       = useState(userPhone);
  const [network, setNetwork]   = useState('CM');
  const [service, setService]   = useState('CM_MTNMOMO');
  const [ref, setRef]           = useState(null);
  const [status, setStatus]     = useState('pending'); // 'pending'|'success'|'failed'|'timeout'
  const [message, setMessage]   = useState('');
  const [reason, setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const inProgressRef  = useRef(false);
  // Holds the stop-polling function returned by pollTransactionStatus
  const stopPollingRef = useRef(null);
  // Holds the latest timeout handler so CountdownTimer can trigger it
  const onTimeoutRef   = useRef(null);

  // Pre-fill phone when userPhone prop changes (e.g. after auth loads)
  useEffect(() => {
    if (userPhone && !phone) setPhone(userPhone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  // Auto-detect MTN vs Orange from phone prefix as user types.
  // Cameroon 9-digit local prefixes: Orange = 655-659, 690-699; MTN = everything else.
  useEffect(() => {
    if (gateway !== 'payunit' || !phone) return;
    const local = phone.replace(/[^\d]/g, '').replace(/^237/, '').replace(/^0/, '');
    if (local.length >= 3) {
      const prefix = parseInt(local.slice(0, 3), 10);
      const isOrange = (prefix >= 655 && prefix <= 659) || (prefix >= 690 && prefix <= 699);
      setService(isOrange ? 'CM_ORANGE' : 'CM_MTNMOMO');
    }
  }, [phone, gateway]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      stopPollingRef.current?.();
      stopPollingRef.current = null;
      onTimeoutRef.current = null;
      inProgressRef.current = false;
      setStep('amount');
      setGateway('payunit');
      setAmount('');
      setStatus('pending');
      setReason('');
      setRef(null);
      setMessage('');
    }
  }, [open]);

  if (!open) return null;

  const netAmount      = Math.max(0, Number(amount || 0));
  const collectionFee  = netAmount > 0 ? MOBILE_MONEY_COLLECTION_FEE_XAF : 0;
  const approvalAmount = netAmount + collectionFee;

  // Called when the countdown hits 0 OR pollTransactionStatus times out
  const triggerTimeout = async (localRef, gw) => {
    // Stop the background poller so it doesn't race with this handler
    stopPollingRef.current?.();
    stopPollingRef.current = null;

    setStatus('timeout');
    setStep('result');
    setMessage('Time expired. Checking payment status one last time...');
    try {
      if (localRef) {
        const r = await api.get(`/payments/${gw}/recheck/${localRef}`);
        if (r.data?.status === 'SUCCESSFUL') {
          setStatus('success');
          setMessage('Payment confirmed! Your wallet has been credited.');
          onSuccess?.();
          return;
        } else if (r.data?.status === 'FAILED') {
          setStatus('failed');
          setReason(r.data?.reason || r.data?.message || 'Payment was declined.');
          return;
        }
      }
    } catch { /* silent — show timeout screen */ }
    setMessage('Could not confirm automatically. If you approved the USSD prompt, tap "Recheck Payment" below.');
  };

  // Called by CountdownTimer when the 3-minute window expires
  const handleCountdownExpire = () => {
    onTimeoutRef.current?.();
  };

  const handleInit = async () => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    const min = gateway === 'eversend' ? 500 : 1;
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

    const processingStart = Date.now();
    const holdProcessing = (minMs = 1500) =>
      new Promise(r => setTimeout(r, Math.max(0, minMs - (Date.now() - processingStart))));

    let localRef = null;
    // Capture gateway in a local so closures don't see stale state
    const gw = gateway;

    try {
      const payload = {
        amount: Number(amount),
        currency: 'XAF',
        phone,
        country: network,
        provider: gw === 'payunit' ? service : undefined,
      };

      const res = await initiateCollection(gw, payload);
      await holdProcessing();

      if (res.success) {
        localRef = res.data?.reference;
        setRef(localRef);
        setMessage('Charge request sent. Awaiting approval on your phone...');

        // Register the timeout handler for CountdownTimer to call
        onTimeoutRef.current = () => triggerTimeout(localRef, gw);

        // Poll in the background — maxDuration is set high (200 s) so
        // the 3-minute UI countdown is the authoritative cancellation trigger.
        const stopFn = pollTransactionStatus(
          gw,
          localRef,
          {
            onPending: (data) => setMessage(data.message || 'Awaiting mobile money confirmation...'),
            onSuccess: () => {
              stopPollingRef.current = null;
              setStatus('success');
              setStep('result');
              setMessage('Payment confirmed! Your wallet has been credited.');
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
          200000, // 200 s safety net — UI countdown at 180 s is authoritative
        );
        stopPollingRef.current = stopFn;
      } else {
        setStatus('failed');
        setStep('result');
        setReason(res.message || 'Payment initiation failed. Please try again.');
      }
    } catch (err) {
      await holdProcessing();
      const errMsg = err?.response?.data?.message;
      setStatus('timeout');
      setStep('result');
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
      const res = await api.get(`/payments/${gateway}/recheck/${ref}`);
      const { status: s, message: msg, reason: r } = res.data;
      if (s === 'SUCCESSFUL') {
        setStatus('success');
        setMessage(msg || 'Payment confirmed! Your wallet has been credited.');
        onSuccess?.();
      } else if (s === 'FAILED') {
        setStatus('failed');
        setReason(r || msg || 'Payment was declined.');
      }
    } catch {
      // noop
    } finally {
      setRechecking(false);
    }
  };

  const handleClose = () => {
    if (step !== 'processing') {
      inProgressRef.current = false;
      stopPollingRef.current?.();
      stopPollingRef.current = null;
      onTimeoutRef.current = null;
      onClose?.();
    }
  };

  const handleRetry = () => {
    stopPollingRef.current?.();
    stopPollingRef.current = null;
    onTimeoutRef.current = null;
    inProgressRef.current = false;
    setStep('amount');
    setAmount('');
    setStatus('pending');
    setReason('');
    setRef(null);
    setMessage('');
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2rem] p-5 sm:p-6 shadow-2xl overflow-hidden font-[Poppins]"
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
                {/* Gateway */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold tracking-tight opacity-30 ml-1">Deposit gateway</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'payunit', label: 'PayUnit', sub: 'MTN / Orange', min: 'Primary' },
                      { id: 'eversend', label: 'Eversend', sub: 'Multi-country', min: 'Min 500' },
                    ].map(node => (
                      <button
                        key={node.id}
                        onClick={() => setGateway(node.id)}
                        className={`rounded-xl border p-2.5 text-left transition-all ${gateway === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-55 hover:opacity-100'}`}
                      >
                        <span className="block text-[11px] font-semibold tracking-tight">{node.label}</span>
                        <span className="block text-[9px] font-medium opacity-70">{node.sub} · {node.min}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold tracking-tight opacity-30 ml-1">Deposit amount (XAF)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={gateway === 'eversend' ? 'Min 500' : 'Enter amount'}
                    className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-xl font-semibold text-center text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-10 shadow-inner"
                  />
                  {netAmount > 0 && (
                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 text-center">
                      You will be charged {approvalAmount.toLocaleString()} XAF (includes {collectionFee} XAF processing fee)
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
                      className="w-full h-11 pl-12 pr-4 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-sm font-medium outline-none focus:border-[var(--accent)] transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Network / Country */}
                {gateway === 'eversend' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold tracking-tight opacity-30 ml-1">Country</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'CM', label: 'Cameroon' }, { id: 'CI', label: 'Ivory Coast' }].map(node => (
                        <button
                          key={node.id}
                          onClick={() => setNetwork(node.id)}
                          className={`h-10 rounded-xl border font-semibold text-[10px] tracking-tight transition-all ${network === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                        >
                          {node.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold text-amber-500/80">Eversend deposits require at least 500 XAF.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 ml-1">
                      <label className="text-[10px] font-semibold tracking-tight opacity-30">Network</label>
                      {phone && <span className="text-[9px] font-semibold text-emerald-500 opacity-70 tracking-tight">· auto-detected</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'CM_MTNMOMO', label: 'MTN MoMo' }, { id: 'CM_ORANGE', label: 'Orange Money' }].map(node => (
                        <button
                          key={node.id}
                          onClick={() => setService(node.id)}
                          className={`h-10 rounded-xl border font-semibold text-[10px] tracking-tight transition-all ${service === node.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                        >
                          {node.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
              {/* Close / dismiss — payment continues in background */}
              <button
                onClick={() => {
                  stopPollingRef.current?.();
                  stopPollingRef.current = null;
                  onTimeoutRef.current = null;
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
              <CountdownTimer totalSecs={COUNTDOWN_SECS} onExpire={handleCountdownExpire} />
              <div className="w-full space-y-2 mb-6">
                {[
                  { label: 'Request sent to gateway', done: true, active: false },
                  { label: `Approve prompt on ${phone}`, done: false, active: true },
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
              <div className="w-full bg-[var(--bg-secondary)] rounded-xl p-3 border border-[var(--glass-border)] flex items-center gap-3">
                <div className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <p className="text-[11px] font-semibold tracking-tight text-[var(--accent)] text-left">{message || 'Waiting for mobile money confirmation...'}</p>
              </div>
              <p className="text-[10px] font-semibold tracking-tight opacity-20 mt-4">Approve the prompt on your phone within the time shown above</p>
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
                {status === 'success' ? 'Confirmed' : status === 'timeout' ? 'Timed Out' : 'Failed'}
              </h4>
              <div className="bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl p-4 mb-4 w-full">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-60 leading-relaxed tracking-tight">
                  {status === 'success' ? message : reason || message}
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
