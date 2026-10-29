import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';

// A key is set; the test triggers Google's "key refused" callback by hand.
const maps = vi.hoisted(() => ({ listeners: new Set(), failed: false }));
vi.mock('@/lib/googleMaps', () => ({
  useGoogleMaps: true,
  googleMapsFailed: () => maps.failed,
  onGoogleMapsFailure: (fn) => { maps.listeners.add(fn); return () => maps.listeners.delete(fn); },
}));
vi.mock('next/dynamic', async () => {
  const { lazy, Suspense } = await import('react');
  return { default: (load) => {
    const Lazy = lazy(load);
    return function Dynamic(props) { return <Suspense fallback={null}><Lazy {...props} /></Suspense>; };
  } };
});

import withMapFallback from './withMapFallback';

afterEach(() => { cleanup(); maps.failed = false; maps.listeners.clear(); });

const Map = withMapFallback(
  async () => ({ default: ({ label }) => <p>google {label}</p> }),
  async () => ({ default: ({ label }) => <p>free {label}</p> }),
);

it('uses Google while the key works and switches to the free map when Google refuses it', async () => {
  render(<Map label="pickup" />);
  expect(await screen.findByText('google pickup')).toBeTruthy();
  await act(async () => { maps.failed = true; maps.listeners.forEach((fn) => fn()); });
  expect(await screen.findByText('free pickup')).toBeTruthy();
  expect(screen.queryByText('google pickup')).toBeNull();
});

it('starts on the free map once Google has failed in this session', async () => {
  maps.failed = true;
  render(<Map label="drop-off" />);
  expect(await screen.findByText('free drop-off')).toBeTruthy();
});
