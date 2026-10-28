"use client";
/**
 * Rider: while `enabled` (online with automatic dispatch, or on a delivery), watches
 * the phone's GPS and sends a fix about every 10 s. Stops as soon as it is disabled.
 *
 * In the Android app it uses a location foreground service, so fixes keep coming
 * with the screen off or the app in the background (Android shows a "sharing your
 * location" notification while it runs). In a browser it uses navigator.geolocation,
 * which only works while the page is open.
 *
 * Returns 'off' | 'sharing' | 'denied' | 'unavailable'.
 */
import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import api from "@/services/api";

const SEND_EVERY_MS = 10000;
const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
let BackgroundGeolocation = null;
const backgroundPlugin = () => (BackgroundGeolocation ||= registerPlugin("BackgroundGeolocation"));

/** In the Android app, opens Auradime's system settings (after location was refused). Null elsewhere. */
export const openLocationSettings = isAndroidApp() ? () => backgroundPlugin().openSettings().catch(() => {}) : null;

export default function useShareLocation(enabled) {
  const [state, setState] = useState("off");
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled) { setState("off"); return undefined; }

    const send = ({ lat, lng, accuracy }) => {
      setState("sharing");
      if (Date.now() - lastSent.current < SEND_EVERY_MS) return;
      lastSent.current = Date.now();
      api.post("/riders/me/location", { lat, lng, accuracy_m: accuracy }).catch(() => {});
    };

    if (isAndroidApp()) {
      let watcherId = null;
      let stopped = false;
      backgroundPlugin().addWatcher(
        {
          backgroundTitle: "Auradime rider",
          backgroundMessage: "Sharing your location for deliveries. Go offline to stop.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 15,
        },
        (location, error) => {
          if (error) { setState(error.code === "NOT_AUTHORIZED" ? "denied" : "unavailable"); return; }
          if (location) send({ lat: location.latitude, lng: location.longitude, accuracy: location.accuracy });
        }
      ).then((id) => {
        if (stopped) backgroundPlugin().removeWatcher({ id }).catch(() => {});
        else watcherId = id;
      }).catch(() => setState("unavailable"));
      return () => {
        stopped = true;
        if (watcherId) backgroundPlugin().removeWatcher({ id: watcherId }).catch(() => {});
      };
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("unavailable"); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (pos) => send({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setState(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
