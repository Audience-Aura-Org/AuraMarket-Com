'use client';
/**
 * Android app: checks GET /app/version with the installed version on launch and
 * when the app comes back to the foreground. A newer version shows a dismissible
 * bar (hidden for a day once dismissed); a version below the minimum shows a
 * blocking screen. "Update" opens the APK download in the phone's browser.
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import api from '@/services/api';

const DISMISS_KEY = 'aura_app_update_dismissed';

export default function AppUpdatePrompt() {
  const [info, setInfo] = useState(null);

  const check = useCallback(async () => {
    try {
      const { App } = await import('@capacitor/app');
      const { version } = await App.getInfo();
      const res = await api.get('/app/version', { params: { v: version }, skipClientCache: true, __skipRetry: true });
      const data = res.data?.data;
      if (!data?.update_available && !data?.update_required) { setInfo(null); return; }
      let dismissed = null;
      try { dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null'); } catch {}
      const snoozed = dismissed?.version === data.latest && Date.now() - dismissed.at < 864e5;
      setInfo(data.update_required || !snoozed ? { ...data, installed: version } : null);
    } catch { /* offline or old server: try again next time */ }
  }, []);

  useEffect(() => {
    check();
    let listener = null;
    import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', ({ isActive }) => { if (isActive) check(); }))
      .then((l) => { listener = l; }).catch(() => {});
    return () => { listener?.remove?.(); };
  }, [check]);

  if (!info) return null;
  // Leaving the app's own pages opens the download in the system browser.
  const update = () => { window.location.href = info.download_url; };
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ version: info.latest, at: Date.now() })); } catch {}
    setInfo(null);
  };

  if (info.update_required) {
    return (
      <div role="alertdialog" aria-modal="true" aria-labelledby="app-update-title" className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[#0a050a] px-8 text-center text-white">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10"><Download className="size-8" /></div>
        <h2 id="app-update-title" className="text-[20px] font-bold">Update Auradime</h2>
        <p className="max-w-xs text-[13px] text-white/70">This version ({info.installed}) is no longer supported. Install version {info.latest} to keep shopping, chatting and delivering. Your account and data stay.</p>
        <button type="button" onClick={update} className="min-h-12 w-full max-w-xs rounded-2xl bg-[#ff00ff] text-[14px] font-semibold">Download update</button>
      </div>
    );
  }
  return (
    <div role="status" className="fixed inset-x-3 z-[150] flex items-center gap-3 rounded-2xl bg-[#0a050a] p-3 text-white shadow-2xl" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Download className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">Update available</p>
        <p className="text-[11px] text-white/70">Version {info.latest} is ready (you have {info.installed}).</p>
      </div>
      <button type="button" onClick={update} className="min-h-10 shrink-0 rounded-xl bg-[#ff00ff] px-4 text-[12px] font-semibold">Update</button>
      <button type="button" onClick={dismiss} aria-label="Later" className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/60"><X className="size-4" /></button>
    </div>
  );
}
