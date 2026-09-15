# Prompt: Implement P2P Pickup & Delivery Feature (AuraMarket)

Paste this into Claude Code (or another coding assistant with repo access) to get a full implementation checklist and execution plan.

---

## Context

I'm adding a **peer-to-peer pickup & delivery feature** to AuraMarket, an existing multi-sided marketplace (Next.js frontend, Express.js/MongoDB backend — see `ARCHITECTURE.md` in repo root for full system context). This is separate from the existing vendor-to-customer marketplace shipments, but should **reuse existing infrastructure** wherever possible: `Shipment`, `LogisticZone`, `LogisticsCompany` models, the `delayedRiderDispatch` / `intercityDispatchTimeout` workers, the wallet/escrow/payment gateway layer, Socket.io notifications, and the `pods/{shipmentId}/` proof-of-delivery S3 pattern.

Do not build a parallel system — extend what exists.

## Feature Requirements

**Access**
- A delivery icon in the top nav (next to logo) opens the pickup & delivery page.
- Available to guests (no account) and authenticated users.

**Booking flow**
- Booker chooses a **direction** first: "I'm sending a package" (booker = sender, enters recipient info) or "I'm requesting a pickup" (booker = recipient, enters the pickup-party's info). Form fields and address roles mirror based on this choice.
- The **booker always pays** — no payer-negotiation flow needed.
- Package details required: category (document/fragile/food/electronics/etc.), a prohibited-items confirmation checkbox, weight/size tier, declared value, optional pickup time window (ASAP vs scheduled).
- Pricing comes from an **admin-assigned logistics provider** (e.g. "Aura Deliveries") with a fixed rate card per `LogisticZone`. Resolve pickup + dropoff addresses to zones, look up the rate, and show the quote before the booker confirms. Handle the case where the provider doesn't cover a given zone yet.

**Identity & the "other party"**
- Authenticated users get saved addresses auto-filled (home/work/other, from their address book).
- Users get a system-generated **username** (first + last name based) used for lookup by other users. Rules:
  - Auto-generate a base slug, disambiguate collisions with a numeric suffix.
  - Allowed: lowercase letters, numbers, `.`, `_`; 3–20 chars; no leading/trailing or consecutive separators.
  - Case-insensitive uniqueness; reserved-word/profanity blocklist.
  - Decide and document whether it's user-editable after creation (if so, reference by stable internal `user_id`, not username, on shipment records).
- Booker can find the other party by phone, email, or username. This lookup must be **rate-limited and non-enumerating** (don't leak whether a given phone/email has an account) and must gracefully fall back to manual entry (name + phone + address) when no account is found.
- Guests: capture full name + verified phone (or email) as the guest identity on the shipment, tied to a `guest_session_id`. On later account creation, verify the same phone/email via OTP and auto-link (claim) all past guest shipments matching that verified contact — never claim on unverified match.

**Tracking, delivery confirmation, notifications**
- History / "My Deliveries" page: current + past shipments, for both directions (sent and received), for logged-in users. Guests can look up status via a tracking code + phone/OTP re-verification, without an account.
- Proof of delivery via OTP sent to the recipient's phone at handoff (works whether or not the recipient has an account), in addition to the existing rider-photo POD flow.
- Guests without push notifications get SMS/email at each status change; account holders get the existing Socket.io + Notification-doc pattern.

**Trust & safety**
- KYC or manual review threshold for high declared-value packages, consistent with the existing vendor KYC gate.
- Cancellation: free before rider dispatch, fee after; refund always returns to whoever the `paid_by` party was (the booker).

**Data model direction**
- Extend `Shipment` with `type: 'marketplace' | 'p2p'`, `direction: 'send' | 'request_pickup'`, `booked_by` (user or guest ref), and an `other_party` subdocument supporting both `{ user_id }` (linked account) and `{ name, phone, email, address }` (guest/manual) shapes.
- Don't fork a new collection — reuse `Shipment`'s existing dispatch/status/POD plumbing.

## What I need from you

1. **Read `ARCHITECTURE.md`** and the current `models/Shipment.js`, `models/LogisticZone.js`, `models/User.js`, and `routes/shipment.routes.js` / `routes/logistics.routes.js` to confirm actual current shape before proposing changes.
2. Produce an **implementation checklist**, grouped by layer, in this order:
   - **Data model changes** (exact schema diffs, new fields, new indexes, migration notes for existing data)
   - **Backend: API routes & controllers** (new/changed endpoints, request/response shapes, validation rules, rate-limit tiers to apply)
   - **Backend: services & workers** (pricing/quote resolution, guest-claim-on-signup matching, OTP-at-handoff, any new/reused background workers)
   - **Realtime & notifications** (Socket.io events, SMS/email triggers for guests)
   - **Frontend** (new route/page, top-nav icon + badge, booking form with direction toggle, address autofill, other-party lookup UI with manual-entry fallback, quote display, history/tracking page, guest tracking page)
   - **Security & abuse prevention** (enumeration protection on lookup, guest-claim verification, prohibited-items/KYC gating)
   - **Testing** (what needs unit/integration/concurrency coverage, per your existing `tests/` structure)
3. For each checklist item, note **how** to implement it (which existing file/pattern to extend, or where a new file goes) — not just what to do.
4. Flag any open decisions you find while reading the code that I haven't specified above (e.g., single vs. multi-provider readiness, username mutability) instead of assuming.

Do not start writing code yet — output the checklist and plan first so I can review it.
