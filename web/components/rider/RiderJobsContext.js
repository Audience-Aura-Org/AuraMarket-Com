"use client";
/**
 * Rider workspace state shared by every /rider tab: offers and deliveries
 * (GET /riders/me/deliveries, refreshed every 15 s, every 5 s while an offer is
 * open), location sharing, the new-offer alert (sound and vibration, per the
 * rider's settings) and keeping the screen on during a delivery.
 * Mounted by app/rider/layout.js, so switching tabs never stops any of it.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { useFeatureFlag } from "@/lib/featureFlags";
import { haptic } from "@/lib/haptics";
import { useRiderPrefs } from "@/lib/riderPrefs";
import useShareLocation from "./useShareLocation";

// The customer sees the rider on the map only during these steps.
export const LIVE_STATUSES = ["assigned", "picked_up", "in_transit", "out_for_delivery"];
export const secondsLeft = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));

const Ctx = createContext(null);
export const useRiderJobs = () => useContext(Ctx);

// Three short rising tones: noticeable over traffic without a sound file to load.
let audio = null;
export const chime = () => {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    [0, 0.18, 0.36].forEach((at, i) => {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = "sine"; o.frequency.value = 660 + i * 220;
      g.gain.setValueAtTime(0.0001, audio.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.16);
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + at); o.stop(audio.currentTime + at + 0.17);
    });
  } catch { /* no audio on this device */ }
};

export function RiderJobsProvider({ enabled, children }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [position, setPosition] = useState(null); // this phone's latest GPS fix
  const [prefs] = useRiderPrefs();
  const liveTracking = useFeatureFlag("live_tracking");
  const autoDispatch = useFeatureFlag("auto_rider_dispatch");
  const seenOffers = useRef(null);

  const delivering = liveTracking && !!data?.active?.some(({ shipment }) => LIVE_STATUSES.includes(shipment.status));
  // Online riders share their position so automatic dispatch can offer them the nearest pickups.
  const waiting = autoDispatch && data?.availability === "online";
  const gps = useShareLocation(enabled && (delivering || waiting), setPosition);

  const load = useCallback(async () => {
    try { const res = await api.get("/riders/me/deliveries", { skipClientCache: true }); setData(res.data.data); } catch { /* keep last view */ }
  }, []);

  const hasOffer = !!data?.offers?.some((o) => secondsLeft(o.expires_at) > 0);
  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const poll = setInterval(load, hasOffer ? 5000 : 15000);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onShow); };
  }, [enabled, load, hasOffer]);

  // Alert once per new offer (not for offers already there when the page opened).
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.offers.map((o) => String(o.assignment_id)));
    if (seenOffers.current) {
      const fresh = [...ids].some((id) => !seenOffers.current.has(id));
      if (fresh) {
        if (prefs.offer_sound) chime();
        if (prefs.offer_vibrate) { try { navigator.vibrate?.([300, 120, 300, 120, 300]); } catch { /* not supported */ } haptic("warning"); }
      }
    }
    seenOffers.current = ids;
  }, [data, prefs.offer_sound, prefs.offer_vibrate]);

  // Keep the screen on while delivering, so directions and steps stay visible.
  useEffect(() => {
    if (!delivering || !prefs.keep_awake || typeof navigator === "undefined" || !navigator.wakeLock) return undefined;
    let lock = null; let stopped = false;
    const grab = () => navigator.wakeLock.request("screen").then((l) => { if (stopped) l.release(); else lock = l; }).catch(() => {});
    grab();
    const onShow = () => { if (document.visibilityState === "visible" && !stopped) grab(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stopped = true; lock?.release().catch(() => {}); document.removeEventListener("visibilitychange", onShow); };
  }, [delivering, prefs.keep_awake]);

  /** Runs a rider action, then refreshes. Returns true when it worked. */
  const act = useCallback(async (key, fn, success) => {
    setBusy(key);
    try {
      await fn();
      haptic(key.startsWith("rej-") ? "warning" : "success");
      if (success) toast.success(success);
      await load();
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "That did not work. Please try again.");
      await load();
      return false;
    } finally { setBusy(null); }
  }, [load]);

  const accept = (offer) => act(`acc-${offer.assignment_id}`, () => api.post(`/riders/me/offers/${offer.assignment_id}/accept`), "Delivery accepted. Head to the pickup.");
  const decline = (offer) => act(`rej-${offer.assignment_id}`, () => api.post(`/riders/me/offers/${offer.assignment_id}/reject`), "Offer declined.");
  const step = (shipment, body, success) => act(`step-${shipment.id}`, () => api.post(`/riders/me/deliveries/${shipment.id}/status`, body), success);

  return (
    <Ctx.Provider value={{ enabled, data, load, busy, act, accept, decline, step, gps, delivering, position, prefs }}>
      {children}
    </Ctx.Provider>
  );
}
