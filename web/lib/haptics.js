/**
 * Light vibration feedback in the Android app (no-op in browsers).
 *   haptic()           tap: tabs, toggles, small actions
 *   haptic('success')  something completed: added to cart, message sent, offer accepted
 *   haptic('warning')  something needs attention: declined, failed
 */
import { Capacitor } from '@capacitor/core';

let plugin = null;
const load = () => (plugin ||= import('@capacitor/haptics'));

export const haptic = (kind = 'tap') => {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  load().then(({ Haptics, ImpactStyle, NotificationType }) => {
    if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
    if (kind === 'warning') return Haptics.notification({ type: NotificationType.Warning });
    return Haptics.impact({ style: ImpactStyle.Light });
  }).catch(() => {});
};
