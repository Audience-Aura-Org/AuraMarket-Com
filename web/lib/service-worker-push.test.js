import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

function worker(windows = []) {
  const handlers = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const clients = { matchAll: vi.fn().mockResolvedValue(windows), openWindow };
  const self = { location: { origin: 'https://auradime.com' }, clients,
    registration: { showNotification }, addEventListener: (name, fn) => { (handlers[name] ||= []).push(fn); } };
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, clients, URL, console });
  const fire = async (name, data) => {
    const pending = [];
    handlers[name].forEach(fn => fn({ ...data, waitUntil: promise => pending.push(promise) }));
    await Promise.all(pending);
  };
  return { fire, showNotification, openWindow };
}

describe('PWA push delivery and navigation', () => {
  it.each([{ windows: [] }, { windows: [{ visibilityState: 'hidden', postMessage: vi.fn() }] }, { windows: [{ visibilityState: 'visible', postMessage: vi.fn() }] }])('displays push with closed, idle or foreground clients: %j', async ({ windows }) => {
    const sw = worker(windows);
    await sw.fire('push', { data: { json: () => ({ title: 'New message', tag: 'msg-123', data: { url: '/chat?vendorId=123' } }) } });
    expect(sw.showNotification).toHaveBeenCalledTimes(1);
  });
  it('uses exactly one navigation without also dispatching a router click', async () => {
    const client = { url: 'https://auradime.com/shop', focus: vi.fn().mockResolvedValue(undefined), navigate: vi.fn().mockResolvedValue(undefined), postMessage: vi.fn() };
    const sw = worker([client]);
    await sw.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/chat?vendorId=123' } } });
    expect(client.navigate).toHaveBeenCalledTimes(1);
    expect(client.postMessage).not.toHaveBeenCalled();
    expect(sw.openWindow).not.toHaveBeenCalled();
  });
  it('opens the conversation when no window exists and dismiss never navigates', async () => {
    const sw = worker();
    const notification = { close: vi.fn(), data: { url: '/chat?vendorId=123' } };
    await sw.fire('notificationclick', { notification, action: 'close' });
    expect(sw.openWindow).not.toHaveBeenCalled();
    await sw.fire('notificationclick', { notification });
    expect(sw.openWindow).toHaveBeenCalledWith('https://auradime.com/chat?vendorId=123');
  });
});
