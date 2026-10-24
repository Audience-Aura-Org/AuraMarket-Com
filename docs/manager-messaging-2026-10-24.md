# Manager account identities and message notifications

The manager portal includes the manager's original account as an **Own account** workspace when `previous_role` is present. This is derived from the existing account, so it applies to existing and future promotions without a migration. The account keeps its user ID, wallet, store/logistics references and message history. The workspace exposes the original role; the stored login role remains manager. Other managers and administrators remain unavailable as delegated targets. Existing assignment permissions, expiry, deny lists and write audit logging remain enforced.

Direct-message notification dispatch forwards alerts to active managers assigned to the receiving account with messages permission, provided the managed owner is still a manageable role. The sender's operating manager is excluded, preventing a manager from receiving their own outbound message as an alert for the second account. Each alert labels the receiving account and links to `/manager/as/:accountId/messages?partnerId=:senderId`. Devices remain registered to their signed-in owner, not to the delegated account. Notifications from different managed accounts use different tags.

Managed message pages subscribe to account-scoped socket updates for immediate inbox/thread refresh. Own-account messages also refresh through the normal socket event. Polling remains a fallback. Saved outbound messages are inserted from the successful response immediately; client IDs still prevent duplicates on retries. Draft/request identities include the managed account to avoid collisions across switches. The composer and sent bubbles explicitly state which account sends the reply. Notification deep-link selection is consumed once so Back does not reopen the conversation after refresh.

The global conversation UI and its offline send retries now explicitly bypass the active workspace header. They always use the signed-in identity; delegated inboxes supply their selected owner ID explicitly. This closes a route by which opening personal chat while working in a managed account could read or send under the wrong account. Delegated push jobs recheck assignment validity before each delivery attempt.

## Push policy

- Messages: enabled by default; skip push only if a live device has a matching account AND conversation foreground heartbeat less than 20 seconds old. Heartbeats refresh every 10 seconds and clear when hidden/closed. Delegated heartbeats require a valid messages assignment. Unknown/stale presence or a presence-query error sends push; presence checks time out after 200 ms in the background delivery job.
- Idle, backgrounded or closed: push proceeds when no fresh matching foreground view is confirmed. A normal connected socket alone never suppresses push.
- Other screens, conversations or managed accounts: push proceeds.
- Orders/payments: retain enabled defaults and existing preference controls. Promotions/vendor marketing updates remain off by default. Manager push preferences remain respected.
- Every push that reaches the service worker displays an OS notification, preserving Safari's user-visible requirement. The server makes the foreground suppression decision before sending.

This supersedes the previous audit's always-send foreground message behavior. Device permissions, installed Home Screen requirements on iOS, OS restrictions and the documented in-memory retry limitation still apply. No live device delivery or fixed end-to-end latency is guaranteed by these code checks.

## Verification

- Twelve frontend checks passed for managed messaging, account-scoped socket updates, notification/back behavior, global request identity and service-worker delivery/navigation.
- Eight push policy/notifier unit checks passed.
- All 47 manager integration checks passed; the two owned-workspace isolation checks also passed against the final role-response implementation.
- Optimized Next.js production build passed.
