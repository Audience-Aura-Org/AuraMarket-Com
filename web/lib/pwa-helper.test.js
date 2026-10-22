import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

/** Minimal navigator.serviceWorker stand-in with a controllable controller. */
function installServiceWorkerMock({ controller }) {
  const listeners = {};
  const sw = {
    controller,
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    register: vi.fn(async () => ({
      scope: '/', waiting: null, installing: null,
      update: vi.fn(async () => {}), addEventListener: vi.fn(),
    })),
  };
  Object.defineProperty(window.navigator, 'serviceWorker', { value: sw, configurable: true });
  return { sw, fire: (type) => (listeners[type] || []).forEach((fn) => fn()) };
}

let reload;
beforeEach(() => {
  vi.resetModules();
  delete window.__auraSwControllerReloadBound;
  reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
});
afterEach(() => { delete window.navigator.serviceWorker; });

describe('registerPWA controller changes', () => {
  it('does not reload when the first service worker takes control (first visit)', async () => {
    const { sw, fire } = installServiceWorkerMock({ controller: null });
    const { registerPWA } = await import('./pwa-helper');
    await registerPWA();
    sw.controller = {}; // clients.claim() on first install
    fire('controllerchange');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once when an updated worker replaces an existing one', async () => {
    const { fire } = installServiceWorkerMock({ controller: { id: 'old' } });
    const { registerPWA } = await import('./pwa-helper');
    await registerPWA();
    fire('controllerchange');
    fire('controllerchange');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
