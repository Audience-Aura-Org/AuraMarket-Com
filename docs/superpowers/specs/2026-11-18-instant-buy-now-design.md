# Instant Buy Now: pay with Mobile Money first, then give delivery details

Date: 2026-11-18 · Status: approved by the owner (2026-11-18)

## Intent

Today Buy Now sends signed-out visitors to login and everyone else to the full
`/checkout` page. Buyers drop off at the sign-up wall and on the long checkout form.
The owner wants Buy Now to open a Mobile Money payment straight away. Name, phone
and exact location are asked only **after** the payment is confirmed. People without
an account must be able to buy. Signed-in users should just pay and confirm their
saved location.

Success: a visitor with no account taps Buy Now, chooses their area and approves the
MoMo prompt. They see "Payment confirmed" and then give their name, phone and spot,
all without leaving the page they were on.

## Goals

- Buy Now opens a popup (bottom sheet on phones, centred dialog on desktop) from
  every Buy Now button: product card (`components/ProductCard.js`), product page
  (`app/products/[id]/ProductDetailsPageClient.js`), meal cards
  (`components/dine/MealCard.js`, `components/dine/DineMealCard.js`) and the meal
  detail window (`components/dine/MealDetailModal.js`).
- The popup shows the item, the **delivery area** picker and an exact total: item +
  delivery + Mobile Money fee. It also has the MoMo number field with the MTN/Orange
  logo and a Pay button. (The owner chose option A: the area is asked before paying,
  so the total is exact.)
- After the payment is confirmed, the popup shows the confirmation and then:
  - **guest**: name, phone (pre-filled with the MoMo number) and exact spot
    (the existing `AddressField` / location picker);
  - **signed-in user**: their saved address, pre-filled. They confirm it or change
    the spot. No other questions.
- Works on web and in the Android/iOS apps (same Next.js code).

## Non-goals

- No change to the cart, or to `/checkout` itself. Cart checkout stays as it is.
- No wallet or card payment inside the popup. A small "More payment options" link
  opens the current `/checkout?productId=…` page with the same item.
- No change to fees (both deposit and payout fees stay on the deposit; see
  `backend/utils/mobileMoneyFees.js`).

## Anti-goals (failure even if it "works")

- Breaking or changing the existing checkout, payment confirmation, escrow, refund or
  delivery flows. The popup must reuse them, not fork them.
- A guest being able to see another person's orders. Never link orders by phone
  number alone.
- Charging a different amount from what the popup showed. The backend amount stays
  authoritative and the popup shows it.
- Riders sent out before anyone knows where to go.

## Constraints found in the code

- **Orders and payments require login.** `routes/order*.js` and the payment routes
  use `router.use(protect)`. The orders are created by `POST /orders`
  (`createOrder`); PawaPay is started by `POST /payments/pawapay/initialize` with
  `order_ids`. The amount comes from `getAuthoritativeCheckoutAmount(userId, order_ids)`.
- **Delivery pricing is public:** `GET /logistics/zones` and
  `GET /logistics/compatible-firms` (quartier, optional lat/lng) work without login.
  Checkout's pricing logic lives in `web/app/checkout/page.js` (≈2,100 lines).
- **Accounts are email-based:** `User.email` is required and unique, and login is
  email OTP (`/auth/send-otp`, `/auth/verify-otp`). Roles: customer, vendor,
  logistics, manager, admin.
- **Settlement dispatches immediately:** `services/payment/settle.service.js`
  `settleOrders` marks the order paid and creates the shipment from
  `order.shipping_address` (`logisticsService.createShipmentsForOrder`, which copies
  the address into `dropoff` / `delivery_address`). It then notifies buyer, vendor,
  logistics firm and admins. Food orders go to `pending_acceptance` instead.
- **Refunds** credit the buyer's wallet (`controllers/order.controller.js` ≈1405).
  PawaPay refunds exist in the gateway (`createRefund`) and have a webhook.
- **Feature flags** exist (`useFeatureFlag('location_picker')`, admin Features page).
- **Secure tracking links** exist (`services/trackingLink.service.js`,
  `/delivery/track?t=…`) and work without an account.

## Approaches considered

1. **Guest account behind the scenes (chosen).** When a visitor taps Pay, the
   server creates a fresh guest account and the device gets a session. The popup then
   calls the same order and PawaPay endpoints as checkout, so escrow, settlement,
   notifications and tracking work unchanged.
2. **Separate guest order system.** New endpoints for orders with no account. Every
   part that assumes `customer_id` would need a guest branch (escrow, refunds,
   notifications, tracking, chat, dashboards). Most code and most risk. Rejected.
3. **Sign-up inside the popup.** Email + code before paying. Safe and simple, but it
   brings back the sign-up step the owner wants removed. Rejected.

## Design

### Flow

```
Buy Now ─▶ (variants / meal options chosen as today) ─▶ popup
  popup step 1  item · qty · area (pickup/dine-in skip it) · total · MoMo number · Pay
      guest: POST /auth/guest  → session on this device (once; reused next time)
      POST /orders (same payload checkout sends, address = area only)
      POST /payments/pawapay/initialize (or the PayUnit route for Orange numbers,
           same routing as checkout: resolveCameroonMobileMoneyGateway)
  popup step 2  "Approve the prompt on your phone" + live status (socket + polling,
                as DepositModal / checkout do). Failure/cancel → clear message,
                "Try again"; the unpaid order is failed via /payments/checkout/failed.
  popup step 3  "Payment confirmed · 12,450 XAF" then delivery details:
      guest:     name, phone (pre-filled), exact spot (AddressField)
      signed-in: saved address pre-filled → Confirm / change spot
      PATCH /orders/:id/delivery-details
  popup step 4  done: order number, tracking link, guests also get
                "Create an account to keep your orders" (optional).
```

### Guest accounts (backend)

- `POST /auth/guest` (public, rate-limited per IP): creates a **new** User with
  `role: 'customer'`, `is_guest: true`, a generated name ("Guest"), and a
  synthetic unique email (`guest-<random>@guest.auradime.invalid`). The synthetic
  email avoids changing the required/unique email index on a live database. It
  returns `{ token, data: { user } }` like `verify-otp`, so the existing `protect`
  middleware accepts it. The web keeps it apart from the normal session (see below).
- The device keeps that session. Calling Buy Now again on the same device reuses it,
  so a guest's earlier orders stay visible there. A new device means a new guest
  account. Orders are **never** matched by phone number.
- Guest accounts: no emails sent (the notifier skips `is_guest`), and they are left
  out of admin user counts and stats. Unpaid guest accounts with no orders are
  removed after 7 days by a new daily cleanup job.
- **Claiming:** when someone signs in or signs up on a device that holds a guest
  session, the guest's orders and their transactions move to the real account
  (`customer_id`, `Transaction.user_id`, plus shipments/escrow rows keyed by user).
  Then the guest account is closed. This runs in one database transaction.

### Delivery details after payment

- Before payment the order carries only the area: `shipping_address.quartier`,
  `city` and `zone_id`. That is enough for pricing and for the shipment the
  settlement creates. The order gets `delivery_details_status: 'pending'`.
- New `PATCH /orders/:id/delivery-details` (owner only, paid orders whose details
  are pending or confirmed but not yet picked up). It sets name, phone, street /
  landmark and exact spot, copies them to the shipment's `dropoff` /
  `delivery_address`, sets `delivery_details_status: 'complete'`, notifies the
  vendor and the logistics firm, and saves the address to the user (not for guests).
  **The area cannot change here**, because it was paid for.
- **Rider dispatch waits** for `delivery_details_status: 'complete'`. If the buyer
  never fills it in within 30 minutes, the vendor and the logistics firm are
  notified with the MoMo phone and the area so they can call. Dispatch then proceeds
  as today. Orders created by the normal checkout have the field unset and behave
  exactly as now.
- Pickup and dine-in orders skip the area and the address step.

### Front end

- New `components/checkout/InstantBuySheet.js` (lazy-loaded, so product pages don't
  get heavier) and a small `useInstantBuy` hook that holds the payment steps.
- The MoMo order + payment + status logic is **extracted** from
  `app/checkout/page.js` into a shared module (`lib/momoCheckout.js`) used by both
  the checkout page and the sheet. It must not be copied. The checkout page keeps
  its behaviour; its tests must still pass.
- Variants, meal options, booking type, quantity and the store minimum-order check
  run exactly as today, before the sheet opens.
- The whole feature is behind a new flag `instant_buy` (admin Features page). With
  the flag off, every Buy Now button behaves exactly as today.

### Delivery provider in the popup (owner chose B)

- Default is the same as checkout: **vendor-managed delivery** (`logistics_company_id:
  'vendor_managed'`, no agency fee). The total is item + Mobile Money fee.
- A "Change" link lists the delivery companies from `GET /logistics/compatible-firms`
  for the chosen area, **excluding firms with `pricing_mode: 'distance'`**, so every
  price shown is final. Zone-priced firm fee = the same value checkout shows
  (`getFirmZonePrice`).
- Intercity routes (`is_intercity: true`) are not handled in the popup: show
  "Continue in checkout" to the existing page.

### Decisions made by the builder (owner informed, did not object)

- **Guest session is separate from normal sign-in.** It is stored under its own key
  (`aura-guest-session`) and sent only on the popup's own requests (explicit
  `Authorization` header on those calls). The rest of the app stays signed out.
  It lasts 90 days.
- **Guest refunds** go back to the MoMo number. Refunds credit the wallet from at
  least six places (order cancel, disputes, escrow, settlement), so instead of
  touching each one, a job every 5 minutes turns any guest wallet balance ≥ 500 XAF
  into an automatic `WithdrawalRequest` to the guest's MoMo number (existing payout
  flow). Balances under 500 stay until claimed. A claim moves the wallet balance too.
- **Dispatch hold uses the existing delayed-dispatch worker**
  (`services/delayedRiderDispatch.service.js`, `order.rider_dispatch_at`): no shipment
  is created at payment while details are pending; `rider_dispatch_at = paid + 30 min`;
  sending details sets it to now.
- **Fallback after 30 minutes without details:** the rider is dispatched with the
  area and the buyer's phone, and the vendor and firm are told to call. Before 30
  minutes, no dispatch without details. Vendor-managed orders create no shipment;
  the vendor is notified when details arrive.
- **Guests keep their link:** tracking link on screen. WhatsApp needs a
  Meta-approved template that does not exist yet, so it is a follow-up.
- **Cleanup:** a new daily job deletes guest accounts older than 7 days that have
  no orders. There is no existing job for this.

## Testing (required)

- Backend: guest session creation and rate limit; guest cannot read another
  account's order; delivery-details endpoint (owner only, paid only, area locked,
  shipment updated); dispatch held until details complete, then the 30-minute
  fallback; claim moves orders and transactions atomically; guests are skipped in
  stats and emails.
- Web: sheet steps for guest and signed-in user, failure and retry, flag off
  shows the old behaviour, checkout page tests unchanged.
- Manual: in a browser at phone and desktop width, a real sandbox or low-amount MTN
  payment from a signed-out window and a signed-in one.

## Left to the builder

- Exact UI copy and layout within the existing design system (follow the
  delivery-page MoMo screens and `NetworkLogo`).
- Whether `delivery_details_status` lives on the order or is derived (prefer an
  explicit field).
- How the existing web auth store persists the guest session, using whatever
  mechanism normal sessions use.
