'use client';
/**
 * Profile → Addresses: up to 5 saved addresses. Each is one place search (with map
 * pin) plus an optional description; they can be renamed, moved, set as default or
 * removed at any time. Addresses used at checkout, for packages and P2P are saved
 * here automatically; at the limit the least recently used one makes room.
 */
import { useEffect, useState } from 'react';
import { Check, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/services/api';
import LocationPicker from '@/components/location/LocationPicker';
import { loadSavedAddresses, savedLine, spotFromSaved } from '@/components/location/AddressField';

const MAX = 5;
const FIELD = 'min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[12px] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]';

const payload = (d) => ({
  label: d.label?.trim() || d.place_name || d.quartier || 'Address',
  place_name: d.place_name || '',
  quartier: d.quartier || '',
  city: d.city || '',
  zone_id: d.zone_id || null,
  landmark_description: d.landmark || '',
  location: d.location || null,
  recipient_name: d.recipient_name || '',
  contact_phone: d.contact_phone || '',
});

function Editor({ initial, onCancel, onSave, saving }) {
  const [d, setD] = useState(initial);
  const ready = Boolean(d.zone_id || d.location);
  return (
    <div className="space-y-3 rounded-3xl border border-[var(--accent)]/30 bg-[var(--bg-primary)] p-4">
      <input value={d.label || ''} onChange={(e) => setD({ ...d, label: e.target.value.slice(0, 40) })} placeholder="Name it (e.g. Home, Office)" aria-label="Address name" className={FIELD} />
      <LocationPicker label="Place" value={d} onChange={(v) => setD({ ...d, ...v })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={d.recipient_name || ''} onChange={(e) => setD({ ...d, recipient_name: e.target.value.slice(0, 80) })} placeholder="Who receives here (optional)" aria-label="Recipient name" className={FIELD} />
        <input value={d.contact_phone || ''} inputMode="tel" onChange={(e) => setD({ ...d, contact_phone: e.target.value.slice(0, 20) })} placeholder="Phone at this address (optional)" aria-label="Phone at this address" className={FIELD} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-2xl border border-[var(--glass-border)] px-4 text-[12px] font-semibold">Cancel</button>
        <button type="button" disabled={!ready || saving} onClick={() => onSave(d)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-[12px] font-semibold text-white disabled:opacity-40">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save address
        </button>
      </div>
    </div>
  );
}

export default function SavedAddressesTab() {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // address id, or 'new'
  const [saving, setSaving] = useState(false);

  const refresh = async () => setList((await loadSavedAddresses(true)).filter((a) => a._id !== 'vendor_pickup'));
  useEffect(() => { refresh(); }, []);

  const run = async (fn, ok) => {
    setSaving(true);
    try { await fn(); toast.success(ok); setEditing(null); await refresh(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };

  if (!list) return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-[var(--accent)]" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-bold">My addresses</h2>
        <p className="text-[11px] text-[var(--text-secondary)]">Up to {MAX}. Addresses you use at checkout or for packages are saved here automatically, so you never type them twice. When the list is full, the one you used least recently makes room.</p>
      </div>

      {list.map((a) => editing === a._id ? (
        <Editor key={a._id} initial={{ ...spotFromSaved(a), label: a.label || '' }} saving={saving} onCancel={() => setEditing(null)}
          onSave={(d) => run(() => api.patch(`/addresses/${a._id}`, payload(d)), 'Address updated.')} />
      ) : (
        <div key={a._id} className="flex items-start gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]"><MapPin className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="truncate">{a.label || a.place_name || a.quartier || 'Address'}</span>
              {a.isDefault && <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">Default</span>}
            </p>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">{savedLine(a) || '—'}</p>
            {a.landmark_description && <p className="truncate text-[11px] text-[var(--text-secondary)]">{a.landmark_description}</p>}
            {a.location?.lat == null && <p className="text-[11px] font-semibold text-amber-600">No exact spot yet. Edit it and search the place so riders find you.</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            {!a.isDefault && <button type="button" aria-label="Make default" title="Make default" onClick={() => run(() => api.patch(`/addresses/${a._id}`, { isDefault: true }), 'Default address changed.')} className="flex size-9 items-center justify-center rounded-xl hover:bg-[var(--accent)]/10"><Star className="size-4" /></button>}
            <button type="button" aria-label="Edit address" onClick={() => setEditing(a._id)} className="flex size-9 items-center justify-center rounded-xl hover:bg-[var(--accent)]/10"><Pencil className="size-4" /></button>
            <button type="button" aria-label="Remove address" onClick={() => { if (window.confirm('Remove this address?')) run(() => api.delete(`/addresses/${a._id}`), 'Address removed.'); }} className="flex size-9 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
          </div>
        </div>
      ))}

      {editing === 'new' ? (
        <Editor initial={{ label: '' }} saving={saving} onCancel={() => setEditing(null)} onSave={(d) => run(() => api.post('/addresses', payload(d)), 'Address saved.')} />
      ) : list.length < MAX ? (
        <button type="button" onClick={() => setEditing('new')} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-[var(--accent)]/40 text-[12px] font-semibold text-[var(--accent)]"><Plus className="size-4" /> Add an address</button>
      ) : (
        <p className="text-center text-[11px] text-[var(--text-secondary)]">You have {MAX} addresses. Change or remove one to add another.</p>
      )}
    </div>
  );
}
