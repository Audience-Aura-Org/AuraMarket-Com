# Production readiness audit - 23 October 2026

## Scope and release decision

This audit covers the local application source, automated integration/unit/concurrency checks, production compilation, dependency advisories, and browser checks. It does not certify a deployed environment, simulate real charges, send payouts, deploy changes, or mutate existing production records. The final release decision and verification results are recorded below after checks complete.

## Roles and their effects

| Actor | Allowed actions and scope | Effects on other roles | Required boundaries |
| --- | --- | --- | --- |
| Guest | Browse public products, brands, restaurants and legal pages | Reads merchant information | No account details, private caches or disabled stores; no writes |
| Customer | Manage own profile/cart, place/pay for own orders, confirm receipt, raise eligible disputes, view own signals | Reserves stock; funds escrow or restaurant settlement; assigns delivery; notifies sellers and couriers | Valid active session; own order; authoritative price/fees; valid payment/state transition |
| Vendor / restaurant | Manage own catalog/store, receive own orders, accept/prepare food, fulfil eligible orders, request withdrawals | Changes buyer order state, stock and courier work; may trigger refunds/held-payout release | Owned vendor/order; subscription where required; paid open orders; cannot act on another seller's orders |
| Logistics | Manage own company/coverage, act on assigned delivery work, request own payouts | Changes customer delivery state and delivery settlement | Assigned company/order; allowed transition; cannot advance another company's food delivery |
| Manager | Manage assigned, active, unexpired accounts under category permissions; use personal inbox/signals | Acts as the assigned owner; writes recorded with manager attribution; sensitive actions restricted | Server checks assignment, permission category and denied paths on every delegated request; no admin scope escalation |
| Admin | Review platform records, KYC, disputes, refunds, payouts, assignments and settings | Can change access, balances, fulfilment and settlement outcomes across roles | Admin routes; validated decisions; transactional money movement and terminal-state guards; audit evidence |
| Payment provider / workers | Signed callbacks or server-owned reconciliation, timeout and release work | Updates payer/vendor/logistics balances and order/subscription states | Authentic callback; durable intent; idempotent conditional claim; transaction; no release during dispute |

Vendor and logistics users can also be buyers; ownership checks must use the order's customer identity rather than assume only the customer role buys. Managers retain an original role where the role helper explicitly supports it; delegation remains separately scoped.

## Core workflows and invariants reviewed

1. Authentication: token is required; active user and token version are checked. Persisted frontend identity alone does not restore authorization. Cookie sessions must bypass shared response caching.
2. Commerce: server calculates totals and fees, claims stock and coupon usage, creates order/payment records and links settlement. Client callbacks cannot manufacture a successful payment.
3. Fulfilment: retail orders, food status and shipments have separate state tracks. A courier must belong to the assigned firm. Disputed/refunded/cancelled/closed food orders cannot advance into payout-triggering states.
4. Settlement: wallet, provider intents, escrow, commissions and linked order/subscription records must agree. Repeated provider events or retry keys must not duplicate money movement.
5. Disputes: creation and settlement compete on the same escrow document inside MongoDB transactions. A released/refunded escrow cannot be newly disputed or silently resolved again. Admin resolution handles the disputed state.
6. Delegation: assignment revocation/expiry and per-category permissions are enforced by middleware, not merely hidden navigation. Personal notification badges and mutations omit act-as headers.
7. Messaging/signals: recipient/participant checks prevent cross-account reads and writes. Opening Signals does not mark the inbox read; unread counts include records beyond the current page; failed writes remain visible as errors.
8. Public directory: eligibility is checked before pagination/counts; inactive merchants and stores are hidden. Public profile GETs no longer create missing store records. Verification/rating/follower text is derived from actual data.

## Fixes made in this pass

- Redesigned the shared Signals page for all five roles; search, category/unread filters, error/retry states, 20-record server pagination and explicit read actions.
- Redesigned Brands with real verification, rating and follower data, search/sort/filter controls, paged records and store links; removed invented verification totals and fulfilment rates.
- Replaced Order activity summaries with the shared semantic table, 20 records per page and expandable details.
- Added notification pagination/counts/filtering and indexes; unread badges use the server count and ignore stale account responses and replayed socket increments.
- Restricted notification/deep-link navigation to local HTTP(S) routes; socket toasts use the same checked normalizer.
- Excluded cookies and delegated headers from the shared API response cache; added a regression against private cookie-authenticated vendor response leakage.
- Made dispute creation transactional, with an escrow claim and a shared order write preventing concurrent duplicate disputes and release/dispute inconsistency. Terminal escrow resolutions reject instead of rewriting order state.
- Required the assigned logistics firm for food transitions and blocked payout-triggering transitions on unpaid/disputed/closed orders.
- Updated dependencies identified by the package audit; exact final versions and remaining findings follow in verification.

## Operational checks still required in the target deployment

- Confirm MongoDB replica-set transactions, indexes and backup/restore against the actual deployment; test suites use an isolated replica set.
- Verify Redis connectivity across all server instances, rate-limit sharing and socket delivery. The lock helper falls back to unlocked execution without Redis; do not assume cluster coordination without it.
- Verify durable media storage, signed upload permissions and CDN lifecycle. Video jobs and job results currently live in process memory (`jobQueue.service.js`, `upload.controller.js`); a restart can lose queued work/results. Durable queue/job recovery remains a release concern for asynchronous video uploads.
- Exercise live provider callbacks/signatures, receipts and reconciliation in a staging/sandbox environment using the deployed configuration. The prior read-only payment audit found eleven old PawaPay pending references returning NOT_FOUND; reconcile them against provider history before treating the ledger as fully reconciled.
- Validate production SMTP/push, monitoring/alert routing, worker shutdown/restart, load and resource limits, and actual Android build/device behavior after dependency updates.

## Evidence and verification

The optimized Next.js 16.4.2 production build passes, including the vendor order redesign. Frontend suites passed 178 tests across the full run and the isolated worker-startup retry; the final navigation, order-party and service-worker checks pass another 7 tests. Backend concurrency checks pass 12 tests; push delivery and notification-policy unit checks pass 5 tests. Final affected integration results are recorded below. Failed/aborted initial attempts caused by local disk exhaustion are excluded from pass counts.

The seven affected backend integration suites pass 90 tests (financial recording, vendors, shipment messages, push/preferences, Signals, chat and admin orders). After the final participant-read guards and vendor pagination regression, the two affected suites pass all 32 tests. The wider initial backend run passed 55 of 57 files; its two failing files were corrected and pass in these targeted reruns.

Browser checks use intercepted API fixtures, not live money or messages: all five role Signals pages, Brands and admin Order activity passed pagination, filtering, explicit read actions, failed mutation handling and mobile overflow checks. The final vendor order check passed 20/5 pagination, detail loading/read acknowledgement, failed status handling, failed message draft retention, fulfilment updates, foreground-push refresh and 1440/390px overflow checks. A runtime reference left by replacing the old client-filtered list was found and fixed during that check; the final build and browser rerun pass. Live provider and device checks below remain necessary.

## Additional money-path findings fixed during final review

- Eversend verify/recheck now enforce ownership and use the shared atomic settlement function. A confirmed outgoing withdrawal cannot enter a collection-credit path. Provider lookup failures remain pending rather than being treated as a decline.
- Eversend callback and admin reconciliation use the same settlement logic for wallet, subscription, checkout and P2P collections. Unmatched imported provider rows are labelled reconciliation-only and excluded from automatic wallet settlement; they are not evidence that the importing administrator owns the funds.
- Manual collection confirmation uses the atomic settlement function; completed transactions cannot be reset to pending/failed and confirmed again.
- Direct admin order edits cannot manufacture payment/refund status or reopen a disputed/closed order outside its financial workflow. The order table keeps dedicated escrow controls for settlement actions.
- P2P payment intents include shipment and fee metadata before outbound calls for all three gateways. An early callback therefore settles the delivery instead of treating the payment as a wallet top-up.
- Accounts awaiting verification can acknowledge/delete their own signals without gaining any money-moving permission; recipient checks still apply.

## Vendor orders, messaging and push follow-up

- Vendor orders now use the shared table with server-side filtering and 20-record pagination. The detail screen groups product rows, fulfilment, escrow, customer/delivery information, activity and conversation, while retaining the shared statistic-card design.
- Visible order conversations acknowledge reads. Failed sends retain drafts; failed status changes reload authoritative state and display the server error. Socket events, foreground push and returning to the tab refresh order state.
- Shipment chat GET and POST both resolve optional authentication and require a participant, administrator or valid tracking code. Unrelated accounts cannot read or inject messages by guessing a shipment ID.
- Order messages and status updates link to the correct buyer or vendor order view. Foreground service-worker pushes refresh Signals and orders; background pushes retain clickable local links. Unsafe external/script links are rejected.
- Android delivery no longer depends on browser VAPID configuration. Transient push failures retry only unfinished recipients; authentication errors do not delete browser registrations, while confirmed expired endpoints do. Stable notification tags limit duplicate device alerts.
- Notification preferences now have authenticated per-account GET/PATCH endpoints and validated boolean fields. Delivery respects category opt-outs and manager settings; in-app records remain available.
- Push token indexes now use a partial unique Android-token index so multiple browsers can register for the same user. The read-only dry run confirmed the legacy `user_id_1_fcm_token_1` index exists. **Deployment step:** run `node scripts/migrate-push-token-index.js --apply` from `backend` with deployment database configuration before relying on multiple browser registrations. The default invocation is read-only; no production indexes or subscriptions were changed during this audit.
- Push retry jobs currently share the process-memory job queue. Worker restarts can lose pending delivery attempts; durable recovery remains an operational release requirement alongside the media queue limitation above.

## Dependency evidence

The initial production dependency scan reported 16 backend and 15 frontend findings. After updates, both `npm audit --omit=dev --json` reports contain zero known vulnerabilities. Next.js is now 16.4.2, PostCSS 8.5.31 and Nodemailer 10.2.1; package lockfiles contain the resolved updates. This is the registry's known-advisory result, not a guarantee against unknown vulnerabilities.

Primary framework advisory context: https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6 and https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj. The registry scan additionally contained newer advisories, so the update uses the currently available 16.4.2 release rather than stopping at the older patches mentioned by these two advisories.
