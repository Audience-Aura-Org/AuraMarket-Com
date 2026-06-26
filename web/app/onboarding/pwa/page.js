"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, MonitorSmartphone, Smartphone } from 'lucide-react';

const APK_DOWNLOAD_URL = '/downloads/Auradime.apk';

export default function PWAInstallPage() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installStatus, setInstallStatus] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;
    setIsStandalone(Boolean(standalone));

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstallStatus('');
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallStatus('Auradime is installed on this device.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const platformLabel = useMemo(() => {
    if (typeof navigator === 'undefined') return 'this device';
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone';
    return 'this device';
  }, []);

  const installWebApp = async () => {
    if (!installPrompt) {
      setInstallStatus('Use your browser menu to add Auradime to your home screen.');
      return;
    }

    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallStatus(
      result?.outcome === 'accepted'
        ? 'Auradime is installing.'
        : 'Install was dismissed.'
    );
  };

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--text-primary)]"
            aria-label="Back to Auradime"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <img src="/icon-512.png" alt="" className="size-9 rounded-xl bg-black p-1.5" />
            <span className="text-[14px] font-bold tracking-tight">
              Aura<span className="text-[var(--accent)]">Dime</span>
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 py-10">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">
              <MonitorSmartphone className="size-3.5" />
              Install Auradime
            </p>
            <h1 className="text-[32px] font-black leading-[1.05] tracking-tight sm:text-[44px]">
              Get the Auradime app on {platformLabel}.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--text-secondary)] sm:text-[16px]">
              Install the web app from auradime.com or download the Android APK.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                <Smartphone className="size-5" />
              </div>
              <h2 className="text-[17px] font-bold tracking-tight">Install from auradime.com</h2>
              <p className="mt-2 min-h-[48px] text-[13px] leading-6 text-[var(--text-secondary)]">
                {isStandalone
                  ? 'Auradime is already running as an installed app.'
                  : 'Best for supported mobile browsers and desktop browsers.'}
              </p>
              <button
                type="button"
                onClick={installWebApp}
                disabled={isStandalone}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13px] font-bold text-[var(--bg-primary)] transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <CheckCircle2 className="size-4" />
                {isStandalone ? 'Installed' : 'Install web app'}
              </button>
              {installStatus && (
                <p className="mt-3 text-[12px] font-medium text-[var(--text-secondary)]">
                  {installStatus}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Download className="size-5" />
              </div>
              <h2 className="text-[17px] font-bold tracking-tight">Download Android APK</h2>
              <p className="mt-2 min-h-[48px] text-[13px] leading-6 text-[var(--text-secondary)]">
                Direct Android package hosted on auradime.com.
              </p>
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-110"
              >
                <Download className="size-4" />
                Download APK
              </a>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
