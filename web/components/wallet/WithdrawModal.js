"use client";
/**
 * components/wallet/WithdrawModal.js
 * Aura Market — Universal Withdrawal Request Modal
 *
 * Used by both /wallet (users) and /vendor/wallet (vendors).
 * Submits to POST /api/withdrawals (new WithdrawalRequest system).
 * NO balance is deducted until admin approves + Eversend confirms.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Loader2, Phone, Building2, Tag,
  Globe, ArrowRight, ArrowLeft, Wallet, AlertCircle
} from 'lucide-react';
import api from '@/services/api';

const fmt = (n) => Number(n || 0).toLocaleString('fr-CM');

const METHODS = [
  { id: 'momo',     label: 'Mobile Money',     sub: 'MTN, Orange, M-Pesa etc.',   icon: Phone,     color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  { id: 'bank',     label: 'Bank Transfer',    sub: 'Direct to bank account',      icon: Building2, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'eversend', label: 'Eversend Wallet',  sub: 'Wallet-to-wallet transfer',   icon: Tag,       color: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20' },
];

const COUNTRIES = [
  { code: 'CM', label: 'Cameroon' }, { code: 'NG', label: 'Nigeria' }, { code: 'KE', label: 'Kenya' },
  { code: 'GH', label: 'Ghana' },   { code: 'UG', label: 'Uganda' },  { code: 'RW', label: 'Rwanda' },
  { code: 'TZ', label: 'Tanzania' },{ code: 'ZA', label: 'South Africa' },
];

export default function WithdrawModal({ balance, onClose, onSuccess }) {
  const [step, setStep]     = useState(1); // 1=amount, 2=method, 3=details, 4=review
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(null);
  const [form, setForm]     = useState({ firstName: '', lastName: '', country: 'CM', phoneNumber: '', bankCode: '', accountNumber: '', eversendTag: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [fetchingBeneficiaries, setFetchingBeneficiaries] = useState(false);

  const amtNum = Number(amount) || 0;
  const MIN = 1000;

  const fetchBeneficiaries = async () => {
    setFetchingBeneficiaries(true);
    try {
      const res = await api.get('/payments/eversend/beneficiaries');
      if (res.data.success) {
        setBeneficiaries(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch beneficiaries:', e);
    } finally {
      setFetchingBeneficiaries(false);
    }
  };

  const field = (key, label, placeholder, type = 'text') => (
    <div className="space-y-1.5">
      <label className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest text-[var(--text-secondary)] opacity-50">{label}</label>
      <input type={type} placeholder={placeholder} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full h-12 px-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-sm font-quicksand font-bold outline-none focus:border-[var(--accent)] transition-all" />
    </div>
  );

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/withdrawals', {
        amount: amtNum,
        currency: 'XAF',
        withdrawalMethod: method.id,
        recipientDetails: {
          firstName: form.firstName,
          lastName:  form.lastName,
          country:   form.country,
          phoneNumber:   method.id === 'momo'     ? form.phoneNumber   : null,
          bankCode:      method.id === 'bank'     ? form.bankCode      : null,
          accountNumber: method.id === 'bank'     ? form.accountNumber : null,
          eversendTag:   method.id === 'eversend' ? form.eversendTag   : null,
          beneficiaryId: selectedBeneficiary?.id || null,
        },
        note: form.note || null,
      });
      setDone(true);
      if (onSuccess) onSuccess(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Submission failed. Please try again.');
    } finally { setLoading(false); }
  };

  const Steps = () => (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-2">
          <div className={`size-6 rounded-full flex items-center justify-center text-[10px] lg:text-[12px] font-quicksand font-bold transition-all ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-30'}`}>
            {i < step ? <CheckCircle2 className="size-3" /> : i}
          </div>
          {i < 4 && <div className={`flex-1 h-px transition-all ${i < step ? 'bg-emerald-500' : 'bg-[var(--glass-border)]'}`} style={{ width: 24 }} />}
        </div>
      ))}
    </div>
  );

  if (done) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-10 text-center space-y-6">
          <div className="size-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-quicksand font-bold tracking-tight">Request Submitted</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              Your withdrawal of <strong>{fmt(amtNum)} XAF</strong> is pending admin approval. You'll be notified when it's processed.
            </p>
          </div>
          <button onClick={onClose}
            className="w-full h-13 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-quicksand font-bold text-sm py-3">
            Done
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl max-h-[92vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="size-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                <ArrowLeft className="size-4 text-[var(--text-secondary)]" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-quicksand font-bold tracking-tight">Withdraw Funds</h2>
              <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-40">Available: {fmt(balance)} XAF</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <X className="size-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        <Steps />

        {/* STEP 1: Amount */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest text-[var(--text-secondary)] opacity-50 block mb-3">AMOUNT (XAF)</label>
              <input type="number" min={MIN} max={balance}
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl py-5 text-4xl font-quicksand font-bold text-center outline-none focus:border-[var(--accent)] tabular-nums" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[5000, 10000, 25000].map(q => (
                <button key={q} onClick={() => setAmount(String(Math.min(q, balance)))}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-xs font-quicksand font-bold hover:border-[var(--accent)] transition-all">
                  {fmt(q)}
                </button>
              ))}
            </div>
            {amtNum > 0 && amtNum < MIN && (
              <p className="text-xs text-amber-500 font-quicksand font-bold flex items-center gap-2">
                <AlertCircle className="size-3.5" /> Minimum is {fmt(MIN)} XAF
              </p>
            )}
            {amtNum > balance && (
              <p className="text-xs text-red-500 font-quicksand font-bold flex items-center gap-2">
                <AlertCircle className="size-3.5" /> Exceeds your balance of {fmt(balance)} XAF
              </p>
            )}
            <button onClick={() => setStep(2)} disabled={amtNum < MIN || amtNum > balance}
              className="w-full h-13 bg-[var(--accent)] text-white rounded-2xl font-quicksand font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-30 transition-all py-3">
              Continue <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Method */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest text-[var(--text-secondary)] opacity-50">SELECT METHOD</p>
            {METHODS.map(m => {
              const MIcon = m.icon;
              return (
                <button key={m.id} onClick={() => { setMethod(m); setStep(3); }}
                  className={`w-full p-5 rounded-2xl border flex items-center gap-4 hover:border-[var(--accent)] transition-all text-left ${method?.id === m.id ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}>
                  <div className={`size-11 rounded-xl flex items-center justify-center border ${m.color}`}>
                    <MIcon className="size-5" />
                  </div>
                  <div>
                    <p className="font-quicksand font-bold text-sm">{m.label}</p>
                    <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-50">{m.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 3: Recipient Details */}
        {step === 3 && method && (
          <div className="space-y-4">
            <p className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest text-[var(--text-secondary)] opacity-50">RECIPIENT DETAILS</p>
            
            {method.id === 'eversend' && (
              <div className="space-y-3 mb-6">
                <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-40">CHOOSE SAVED RECIPIENT (OPTIONAL)</p>
                {fetchingBeneficiaries ? (
                  <div className="flex items-center gap-2 text-xs opacity-50"><Loader2 className="size-3 animate-spin" /> Loading beneficiaries...</div>
                ) : beneficiaries.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {beneficiaries.map(b => (
                      <button key={b.id} onClick={() => {
                        setSelectedBeneficiary(b);
                        setForm({
                          ...form,
                          firstName: b.firstName,
                          lastName: b.lastName,
                          country: b.country,
                          eversendTag: b.type === 'eversend' ? b.accountNumber : '',
                          phoneNumber: b.type === 'momo' ? b.accountNumber : '',
                          bankCode: b.type === 'bank' ? b.bankCode : '',
                          accountNumber: b.type === 'bank' ? b.accountNumber : '',
                        });
                      }}
                      className={`shrink-0 px-4 py-3 rounded-xl border text-[10px] lg:text-[12px] font-quicksand font-bold transition-all ${selectedBeneficiary?.id === b.id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] opacity-60'}`}>
                        {b.firstName} {b.lastName}
                        <p className="text-[10px] lg:text-[12px] opacity-50 capitalize mt-0.5">{b.type}</p>
                      </button>
                    ))}
                    <button onClick={() => setSelectedBeneficiary(null)} className="shrink-0 px-4 py-3 rounded-xl border border-dashed border-[var(--glass-border)] text-[10px] lg:text-[12px] font-quicksand font-bold opacity-40">
                      + New
                    </button>
                  </div>
                ) : (
                  <button onClick={fetchBeneficiaries} className="text-[10px] lg:text-[12px] font-quicksand font-bold text-[var(--accent)] hover:underline">
                    Load saved recipients
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {field('firstName', 'FIRST NAME', 'John')}
              {field('lastName',  'LAST NAME',  'Doe')}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest text-[var(--text-secondary)] opacity-50">COUNTRY</label>
              <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full h-12 px-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-sm font-quicksand font-bold outline-none focus:border-[var(--accent)] transition-all">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            {method.id === 'momo'     && field('phoneNumber',   'PHONE NUMBER',    '+237...',    'tel')}
            {method.id === 'bank'     && field('bankCode',      'BANK CODE',       'e.g. GTB')}
            {method.id === 'bank'     && field('accountNumber', 'ACCOUNT NUMBER',  '0123456789')}
            {method.id === 'eversend' && !selectedBeneficiary && field('eversendTag',   'EVERSEND TAG',    '@username')}
            {selectedBeneficiary && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-[12px] font-quicksand font-bold text-emerald-500 opacity-50 capitalize">SAVED RECIPIENT</p>
                  <p className="text-xs font-quicksand font-bold">{selectedBeneficiary.firstName} {selectedBeneficiary.lastName}</p>
                </div>
                <button onClick={() => setSelectedBeneficiary(null)} className="text-[10px] lg:text-[12px] font-quicksand font-bold text-red-500">Change</button>
              </div>
            )}
            {field('note', 'NOTE (OPTIONAL)', 'Reason for withdrawal...')}
            <button onClick={() => {
              const missing =
                !form.firstName || !form.lastName ||
                (!selectedBeneficiary && (
                  (method.id === 'momo' && !form.phoneNumber) ||
                  (method.id === 'bank' && (!form.bankCode || !form.accountNumber)) ||
                  (method.id === 'eversend' && !form.eversendTag)
                ));
              if (missing) { setError('Please fill all required fields.'); return; }
              setError(''); setStep(4);
            }}
              className="w-full h-13 bg-[var(--accent)] text-white rounded-2xl font-quicksand font-bold text-sm flex items-center justify-center gap-2 transition-all py-3">
              Review <ArrowRight className="size-4" />
            </button>
            {error && <p className="text-xs text-red-500 font-quicksand font-bold text-center">{error}</p>}
          </div>
        )}

        {/* STEP 4: Review & Submit */}
        {step === 4 && method && (
          <div className="space-y-5">
            <p className="text-[10px] lg:text-[12px] font-quicksand font-bold tracking-widest text-[var(--text-secondary)] opacity-50">REVIEW & CONFIRM</p>
            <div className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-5 space-y-3">
              {[
                ['Amount',     `${fmt(amtNum)} XAF`],
                ['Method',     method.label],
                ['Recipient',  `${form.firstName} ${form.lastName}`],
                ['Country',    COUNTRIES.find(c => c.code === form.country)?.label || form.country],
                ['Destination', form.phoneNumber || form.accountNumber || form.eversendTag || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary)] opacity-50 font-quicksand font-bold">{k}</span>
                  <span className="font-quicksand font-bold">{v}</span>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 font-quicksand font-bold leading-relaxed">
              ⚠️ This request requires admin approval before funds are sent. Your balance will only be deducted after Eversend confirms the payout.
            </div>
            {error && <p className="text-xs text-red-500 font-quicksand font-bold flex items-center gap-2"><AlertCircle className="size-3.5" />{error}</p>}
            <button onClick={submit} disabled={loading}
              className="w-full h-13 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-quicksand font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--accent)] hover:text-white transition-all py-3">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
              {loading ? 'Submitting...' : 'Submit Withdrawal Request'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
