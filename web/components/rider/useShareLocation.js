"use client";
/**
 * Rider: while `enabled` (an accepted delivery is under way), watches the phone's
 * GPS and sends a fix about every 10 s. Stops as soon as the delivery ends.
 * Returns 'off' | 'sharing' | 'denied' | 'unavailable'.
 */
import { useEffect, useRef, useState } from "react";
import api from "@/services/api";

const SEND_EVERY_MS = 10000;

export default function useShareLocation(enabled) {
  const [state, setState] = useState("off");
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled) { setState("off"); return undefined; }
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("unavailable"); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState("sharing");
        if (Date.now() - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = Date.now();
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        api.post("/riders/me/location", { lat, lng, accuracy_m: accuracy }).catch(() => {});
      },
      (err) => setState(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
