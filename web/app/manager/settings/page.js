'use client';

import { useEffect, useState } from 'react';
import api from '@/services/api';
import { useManagerQuery } from '@/hooks/useManagerQuery';
import { PageHeader, ErrorState, Skeleton } from '@/components/manager/ui';
import InvitationsPanel from '@/components/manager/InvitationsPanel';

const TOGGLES = [
  { key: 'notify_email', label: 'Email notifications', desc: 'Important events on your accounts by email.' },
  { key: 'notify_push', label: 'Push notifications', desc: 'Real-time alerts on this device.' },
  { key: 'daily_digest', label: 'Daily digest', desc: 'One summary email of everything that happened.' },
];

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full border transition-colors ${
        checked ? 'bg-[var(--m-text)] border-transparent' : 'bg-[var(--m-surface)] border-[var(--m-border-strong)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-[18px] rounded-full transition-transform ${
          checked ? 'translate-x-[18px] bg-[var(--m-bg)]' : 'translate-x-0.5 bg-[var(--m-text-muted)]'
        }`}
      />
    </button>
  );
}

export default function ManagerSettingsPage() {
  const settings = useManagerQuery('/manager/settings');
  const [values, setValues] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (settings.data) setValues(settings.data);
  }, [settings.data]);

  // Each toggle saves on its own; the UI flips first and rolls back on failure.
  const update = async (key, next) => {
    const previous = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setError(null);
    try {
      await api.patch('/manager/settings', { [key]: next });
    } catch (err) {
      setValues((v) => ({ ...v, [key]: previous }));
      setError(err.response?.data?.message || 'Could not save that setting.');
    }
  };

  return (
    <div className="space-y-8 max-w-[760px]">
      <PageHeader title="Settings" subtitle="Your profile, notifications, and account invitations" />

      {settings.error ? (
        <ErrorState message={settings.error} onRetry={settings.refetch} />
      ) : (
        <>
          <section aria-label="Profile" className="m-card px-4 py-4 flex items-center gap-4">
            {values ? (
              <>
                <span className="size-11 shrink-0 rounded-full border border-[var(--m-border-strong)] flex items-center justify-center m-headline m-fs-15">
                  {(values.name || 'M')[0].toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{values.name}</p>
                  <p className="m-muted truncate">{values.email} · Manager</p>
                </div>
              </>
            ) : (
              <Skeleton className="h-11 w-64" />
            )}
          </section>

          <section aria-labelledby="notifications-title" className="space-y-3">
            <h2 id="notifications-title" className="m-headline m-fs-15">Notifications</h2>
            <div className="m-card m-divide">
              {TOGGLES.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{t.label}</p>
                    <p className="m-muted">{t.desc}</p>
                  </div>
                  {values ? (
                    <Switch label={t.label} checked={Boolean(values[t.key])} onChange={(v) => update(t.key, v)} />
                  ) : (
                    <Skeleton className="h-6 w-10 rounded-full" />
                  )}
                </div>
              ))}
            </div>
            {error && <p role="alert" className="m-bad">{error}</p>}
          </section>
        </>
      )}

      <InvitationsPanel />
    </div>
  );
}
