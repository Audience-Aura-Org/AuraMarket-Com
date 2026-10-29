import { render, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';

// A stand-in for the Google Maps library: records maps, markers and their positions.
const g = vi.hoisted(() => {
  const state = { maps: [], markers: [], fits: 0 };
  class Map { constructor(el, opts) { this.opts = opts; this.listeners = {}; state.maps.push(this); } addListener(n, f) { this.listeners[n] = f; } fitBounds() { state.fits++; } panTo(p) { this.center = p; } getZoom() { return 15; } setZoom() {} getBounds() { return { contains: () => true }; } }
  class AdvancedMarkerElement { constructor(o) { Object.assign(this, o); this.listeners = {}; state.markers.push(this); } addListener(n, f) { this.listeners[n] = f; } }
  class LatLngBounds { constructor() { this.n = 0; } extend() { this.n++; } isEmpty() { return this.n === 0; } }
  class InfoWindow { setContent() {} open() {} }
  return { state, lib: { Map, AdvancedMarkerElement, LatLngBounds, InfoWindow } };
});
vi.mock('@/lib/googleMaps', () => ({ loadGoogleMaps: async () => g.lib, baseMapOptions: (x) => ({ mapId: 'DEMO_MAP_ID', gestureHandling: 'greedy', ...x }) }));

import GoogleLiveMap from './GoogleLiveMap';
import GoogleFleetMap from './GoogleFleetMap';
import GooglePinMap from './GooglePinMap';

beforeEach(() => { g.state.maps.length = 0; g.state.markers.length = 0; g.state.fits = 0; });
afterEach(cleanup);

it('live map: places the rider vehicle and the destination, framed together, with one-finger panning', async () => {
  render(<GoogleLiveMap rider={{ lat: 4.06, lng: 9.73, vehicle_type: 'motorcycle' }} destination={{ lat: 4.09, lng: 9.74 }} />);
  await waitFor(() => expect(g.state.markers).toHaveLength(2));
  expect(g.state.maps[0].opts).toMatchObject({ gestureHandling: 'greedy', mapId: 'DEMO_MAP_ID' });
  expect(g.state.markers[0].position).toEqual({ lat: 4.06, lng: 9.73 });
  expect(g.state.markers[0].content.getAttribute('aria-label')).toBe('Rider');
  expect(g.state.fits).toBe(1);
});

it('fleet map: one vehicle per rider, kept across refreshes; offline riders are removed', async () => {
  const riders = [{ rider_id: 'a', name: 'Paul', availability: 'busy', vehicle_type: 'car', lat: 4.05, lng: 9.70 }, { rider_id: 'b', name: 'Eric', availability: 'online', vehicle_type: 'bicycle', lat: 4.04, lng: 9.71 }];
  const deliveries = [{ id: 'd', tracking_code: 'AURA-1', status: 'out_for_delivery', has_rider: true, pickup: { lat: 4.048, lng: 9.696, approx: false }, dropoff: { lat: 4.09, lng: 9.74, approx: true } }];
  const { rerender } = render(<GoogleFleetMap riders={riders} deliveries={deliveries} />);
  await waitFor(() => expect(g.state.markers.length).toBe(4)); // 2 points + 2 vehicles
  const paul = g.state.markers.find((m) => m.title === 'Paul');
  rerender(<GoogleFleetMap riders={[riders[0]]} deliveries={deliveries} />);
  await waitFor(() => expect(g.state.markers.find((m) => m.title === 'Eric').map).toBeNull());
  expect(g.state.markers.filter((m) => m.title === 'Paul')).toHaveLength(1); // reused, not recreated
  expect(paul.map).toBeTruthy();
});

it('pin map: tapping the map moves the pin and reports the spot', async () => {
  const onPinChange = vi.fn();
  render(<GooglePinMap pin={{ lat: 4.05, lng: 9.70 }} onPinChange={onPinChange} />);
  await waitFor(() => expect(g.state.markers).toHaveLength(1));
  g.state.maps[0].listeners.click({ latLng: { lat: () => 4.06, lng: () => 9.71 } });
  expect(onPinChange).toHaveBeenCalledWith({ lat: 4.06, lng: 9.71 });
  expect(g.state.markers[0].position).toEqual({ lat: 4.06, lng: 9.71 });
});
