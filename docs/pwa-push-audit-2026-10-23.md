# PWA notification and chat navigation audit

## Fixes

- Notification taps use one service-worker document navigation. They no longer also dispatch a competing React navigation/context intent to the existing page.
- Full-page chat seeds its URL conversation once per partner and blocks reseeding while closing. Reply/inbox updates cannot continuously restore the same URL-selected conversation. The full-page header back button exits chat, as does X.
- Overlay history entries preserve Next.js router state instead of replacing it with an empty object.
- Every received Web Push displays an OS notification, even with a visible client. Safari requires user-visible pushes; suppressing banners can revoke permission. Socket updates continue independently.
- Browser permission requests start before awaiting native platform detection, preserving the initiating tap's user activation.
- Recovery removes only the current failing endpoint. It no longer deletes every subscription belonging to the account and disables delivery to other devices.
- A backend subscription rejection no longer reports successful registration.

## Delivery audit

Both HTTP and socket message creation call the shared notifier independently of recipient online status. The notifier loads all account endpoints, uses high urgency and a 24-hour TTL, retries transient delivery failures, removes expired endpoints, and honours account notification preferences. Idle/closed clients receive Web Push through the service worker; they do not need an active socket. The local backend's VAPID public/private configuration is present and passes the library's format validation; this does not verify deployed credentials or prove a live device delivery.

The shared job queue is process memory with bounded retries. A backend process crash can lose queued deliveries; durable delivery across server restarts remains an infrastructure gap. Push-service acceptance also does not prove that the OS displayed a banner. A real installed-device check remains necessary after deployment: foreground, locked/background, closed app, tap/reply/X/back, multiple devices, denied permissions, and Focus/battery restrictions. No test push was sent to a real account during this audit.

On iOS the application must be installed on the Home Screen and have permission. Focus and system notification settings apply. Applications cannot promise delivery when the OS or user blocks notifications. See [Apple's Web Push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) and [WebKit's Home Screen push guidance](https://webkit.org/blog/13878/).

## Verification

Nine frontend regression checks passed, including closed/hidden/visible clients, a single click navigation, dismiss behavior, endpoint-scoped subscription recovery, and closing after conversation context updates. The optimized production build passed. Twenty server subscription and notification integration checks passed.
