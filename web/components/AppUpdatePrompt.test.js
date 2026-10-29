import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import AppUpdatePrompt from './AppUpdatePrompt';

const mocks = vi.hoisted(() => ({ get: vi.fn(), version: '1.6.1' }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: mocks.version }), addListener: async () => ({ remove: () => {} }) } }));
vi.mock('@/services/api', () => ({ default: { get: mocks.get } }));

const reply = (data) => mocks.get.mockResolvedValue({ data: { success: true, data: { latest: '1.7.1', download_url: 'https://auradime.com/downloads/Auradime.apk', ...data } } });
beforeEach(() => { localStorage.clear(); mocks.get.mockReset(); });
afterEach(cleanup);

it('offers the update, can be put off for a day, and asks with the installed version', async () => {
  reply({ update_available: true, update_required: false });
  render(<AppUpdatePrompt />);
  expect(await screen.findByText('Update available')).toBeTruthy();
  expect(screen.getByText(/you have 1\.6\.1/)).toBeTruthy();
  expect(mocks.get).toHaveBeenCalledWith('/app/version', expect.objectContaining({ params: { v: '1.6.1' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(screen.queryByText('Update available')).toBeNull();
  cleanup();
  render(<AppUpdatePrompt />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Update available')).toBeNull(); // still snoozed
});

it('blocks the app below the minimum version, even if put off before', async () => {
  localStorage.setItem('aura_app_update_dismissed', JSON.stringify({ version: '1.7.1', at: Date.now() }));
  reply({ update_available: true, update_required: true });
  render(<AppUpdatePrompt />);
  expect(await screen.findByRole('alertdialog')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Download update' })).toBeTruthy();
});

it('shows nothing when up to date', async () => {
  reply({ update_available: false, update_required: false });
  render(<AppUpdatePrompt />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  expect(screen.queryByText('Update available')).toBeNull();
});
