"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, MonitorSmartphone, Smartphone } from 'lucide-react';

const APK_DOWNLOAD_URL = '/downloads/Auradime.apk';

export default function PWAInstallPage() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installStatus, setInstallStatus] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);
  const [activePlatform, setActivePlatform] = useState('android');

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

    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) {
        setActivePlatform('ios');
      } else if (/Android/i.test(ua)) {
        setActivePlatform('android');
      } else {
        setActivePlatform('desktop');
      }
    }

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
    <main className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500">
      {/* Background blobs */}
      <div className="fixed top-[-10%] right-[-10%] size-[500px] bg-[var(--accent)]/5 blur-[120px] rounded-full pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] left-[20%] size-[400px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none -z-0" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--text-primary)] active:scale-95"
            aria-label="Back to Auradime"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <img src="/icon-512.png" alt="" className="size-9 rounded-xl bg-black p-1.5 ring-1 ring-white/10" />
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
            <h1 className="text-[32px] font-black leading-[1.05] tracking-tight sm:text-[44px] font-[Poppins]">
              Get the Auradime app on {platformLabel}.
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-7 text-[var(--text-secondary)] sm:text-[15px]">
              Install the web app from auradime.com or download the Android APK.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Download/Install Options */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md p-5 shadow-sm">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/10">
                  <Smartphone className="size-5" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight">Install from browser</h2>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                  {isStandalone
                    ? 'Auradime is already running as an installed app.'
                    : 'Best for supported mobile browsers and desktop browsers.'}
                </p>
                <button
                  type="button"
                  onClick={installWebApp}
                  disabled={isStandalone}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13px] font-bold text-[var(--bg-primary)] transition hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"
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

              <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md p-5 shadow-sm">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Download className="size-5" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight font-[Poppins]">Download Android APK</h2>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                  Direct Android package hosted on auradime.com.
                </p>
                <a
                  href={APK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Download className="size-4" />
                  Download APK
                </a>
              </section>
            </div>

            {/* Step-by-Step Installation Guides */}
            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md p-6 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)] mb-4 font-[Poppins]">Detailed Installation Guides</h3>
              <div className="flex gap-2 p-1 bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-2xl mb-6">
                {['android', 'ios', 'desktop'].map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setActivePlatform(plat)}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all capitalize ${
                      activePlatform === plat
                        ? 'bg-[var(--accent)] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {activePlatform === 'ios' && (
                  <div className="space-y-4">
                    <p className="font-semibold text-[var(--text-primary)]">To install on iPhone or iPad:</p>
                    <ol className="list-decimal pl-4 space-y-3">
                      <li>Open <span className="font-medium text-[var(--text-primary)]">Safari</span> and navigate to <span className="underline text-[var(--accent)]">auradime.com</span></li>
                      <li>Tap the <span className="font-medium text-[var(--text-primary)]">Share button</span> (square with an arrow pointing up) in the navigation bar</li>
                      <li>Scroll down and tap <span className="font-medium text-[var(--text-primary)]">"Add to Home Screen"</span></li>
                      <li>Confirm the name and tap <span className="font-medium text-[var(--text-primary)]">"Add"</span> in the top right</li>
                      <li>Launch <span className="font-medium text-[var(--text-primary)]">AuraDime</span> from your home screen!</li>
                    </ol>
                  </div>
                )}

                {activePlatform === 'android' && (
                  <div className="space-y-4">
                    <p className="font-semibold text-[var(--text-primary)]">To install on Android (Two options):</p>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Option A: PWA (Recommended)</p>
                        <ol className="list-decimal pl-4 mt-1 space-y-1">
                          <li>Tap the <span className="font-medium text-[var(--text-primary)]">"Install web app"</span> button on this page.</li>
                          <li>Confirm the prompt.</li>
                        </ol>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Option B: Native APK</p>
                        <ol className="list-decimal pl-4 mt-1 space-y-1">
                          <li>Tap <span className="font-medium text-[var(--text-primary)]">"Download APK"</span> to fetch the installation file.</li>
                          <li>Open the download, and allow your browser to install apps if prompted.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {activePlatform === 'desktop' && (
                  <div className="space-y-4">
                    <p className="font-semibold text-[var(--text-primary)]">To install on Desktop (Chrome, Edge, Brave):</p>
                    <ol className="list-decimal pl-4 space-y-3">
                      <li>Click the <span className="font-medium text-[var(--text-primary)]">Install button</span> above, or click the <span className="font-medium text-[var(--text-primary)]">Install Icon</span> inside your browser URL bar.</li>
                      <li>Confirm the browser dialog by clicking <span className="font-medium text-[var(--text-primary)]">Install</span>.</li>
                      <li>Auradime will launch in a dedicated desktop app frame.</li>
                    </ol>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
