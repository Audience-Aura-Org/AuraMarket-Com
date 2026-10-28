'use client';
/**
 * Opt in to WhatsApp updates (orders, payments, deliveries). Required by Meta's
 * policy before Auradime may message someone; replying STOP on WhatsApp opts out.
 */
import { useEffect, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/services/api';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function WhatsAppOptIn() {
  const enabled = useFeatureFlag('whatsapp_notifications');
  const [state, setState] = useState(null);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    api.get('/whatsapp/me').then((res) => {
      const d = res?.data?.data || {};
      setState(d);
      setNumber((d.number || d.suggested_number || '').replace(/^237/, ''));
    }).catch(() => setState({ opted_in: false }));
  }, [enabled]);

  if (!enabled || !state) return null;

  const save = async (optedIn) => {
    setBusy(true);
    try {
      const res = await api.put('/whatsapp/me', { opted_in: optedIn, number });
      setState((s) => ({ ...s, ...res.data.data }));
      toast.success(optedIn ? 'You will get updates on WhatsApp.' : 'WhatsApp updates turned off.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-[var(--glass-border)] pt-5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="size-4 text-[#128C7E]" />
        <span className="text-[12px] font-bold text-[var(--text-primary)]">WhatsApp updates</span>
      </div>
      <div className="space-y-2 pl-2">
        <p className="text-[11px] text-[var(--text-secondary)]">Order, payment and delivery updates on WhatsApp. Reply STOP at any time to stop them.</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="tel"
            disabled={state.opted_in}
            placeholder="677 12 34 56"
            aria-label="WhatsApp number"
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#128C7E] disabled:opacity-60"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => save(!state.opted_in)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold disabled:opacity-50 ${state.opted_in ? 'border border-[var(--glass-border)] text-[var(--text-secondary)]' : 'bg-[#128C7E] text-white'}`}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />} {state.opted_in ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </div>
    </div>
  );
}
