"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, MonitorSmartphone, Smartphone } from 'lucide-react';

const APK_DOWNLOAD_URL = '/downloads/Auradime.apk?v=1.5.0';

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
    <main className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500 font-[Poppins]">
      {/* Background blobs */}
      <div className="fixed top-[-10%] right-[-10%] size-[500px] bg-[var(--accent)]/5 blur-[120px] rounded-full pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] left-[20%] size-[400px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none -z-0" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--text-primary)] active:scale-95"
            aria-label="Back to Auradime"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-1.5">
            <img src="/icon-512.png" alt="" className="size-7 rounded-lg bg-black p-1 ring-1 ring-white/10" />
            <span className="text-[12px] font-bold tracking-tight">
              Aura<span className="text-[var(--accent)]">Dime</span>
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-5 py-6">
          <div className="max-w-xl">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
              <MonitorSmartphone className="size-3" />
              Install Auradime
            </p>
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.1] tracking-tight font-quicksand">
              Get the Auradime app on {platformLabel}.
            </h1>
            <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">
              Install the web app from auradime.com or download the Android APK.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Download/Install Options */}
            <div className="space-y-3">
              <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md p-4 shadow-sm">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white shadow-sm">
                  <Smartphone className="size-4" />
                </div>
                <h2 className="text-[14px] font-bold tracking-tight font-quicksand">Install from browser</h2>
                <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {isStandalone
                    ? 'Auradime is already running as an installed app.'
                    : 'Best for supported mobile browsers and desktop browsers.'}
                </p>
                <button
                  type="button"
                  onClick={installWebApp}
                  disabled={isStandalone}
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 text-[11px] font-bold text-[var(--bg-primary)] transition hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"
                >
                  <CheckCircle2 className="size-3.5" />
                  {isStandalone ? 'Installed' : 'Install web app'}
                </button>
                {installStatus && (
                  <p className="mt-2 text-[10px] font-medium text-[var(--text-secondary)]">
                    {installStatus}
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md p-4 shadow-sm">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Download className="size-4" />
                </div>
                <h2 className="text-[14px] font-bold tracking-tight font-quicksand">Download Android APK</h2>
                <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Direct Android package hosted on auradime.com.
                </p>
                <a
                  href={APK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[11px] font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Download className="size-3.5" />
                  Download APK
                </a>
              </section>
            </div>

            {/* Step-by-Step Installation Guides */}
            <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md p-5 shadow-sm flex flex-col">
              <h3 className="text-[12px] font-bold tracking-tight text-[var(--text-primary)] mb-3 font-quicksand">Detailed Installation Guides</h3>
              <div className="flex gap-1.5 p-1 bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl mb-4">
                {['android', 'ios', 'desktop'].map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setActivePlatform(plat)}
                    className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all capitalize ${
                      activePlatform === plat
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {activePlatform === 'ios' && (
                  <div className="space-y-2">
                    <p className="font-semibold text-[var(--text-primary)]">To install on iPhone or iPad:</p>
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>Open <span className="font-medium text-[var(--text-primary)]">Safari</span> and navigate to <span className="underline text-[var(--accent)]">auradime.com</span></li>
                      <li>Tap the <span className="font-medium text-[var(--text-primary)]">Share button</span> (square with an arrow pointing up)</li>
                      <li>Scroll down and tap <span className="font-medium text-[var(--text-primary)]">"Add to Home Screen"</span></li>
                      <li>Confirm the name and tap <span className="font-medium text-[var(--text-primary)]">"Add"</span></li>
                      <li>Launch <span className="font-medium text-[var(--text-primary)]">AuraDime</span> from your home screen!</li>
                    </ol>
                  </div>
                )}

                {activePlatform === 'android' && (
                  <div className="space-y-2">
                    <p className="font-semibold text-[var(--text-primary)]">To install on Android (Two options):</p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Option A: PWA (Recommended)</p>
                        <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                          <li>Tap the <span className="font-medium text-[var(--text-primary)]">"Install web app"</span> button on this page.</li>
                          <li>Confirm the prompt.</li>
                        </ol>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Option B: Native APK</p>
                        <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                          <li>Tap <span className="font-medium text-[var(--text-primary)]">"Download APK"</span> to fetch the installation file.</li>
                          <li>Open the download, and allow your browser to install apps if prompted.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {activePlatform === 'desktop' && (
                  <div className="space-y-2">
                    <p className="font-semibold text-[var(--text-primary)]">To install on Desktop (Chrome, Edge, Brave):</p>
                    <ol className="list-decimal pl-4 space-y-1.5">
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

