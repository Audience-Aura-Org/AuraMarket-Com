# Shop, Dine and preorder audit - 2026-10-24

## Changes

- Vendors can configure preorders for selected weekdays (including Friday and Saturday together), explicit calendar dates, or their intersection. Meal editing preserves preorder lead time and window settings.
- Buyer selectors offer only eligible future dates. Checkout intersects availability across all meals, clears an invalid selection in the selector and disables submission until the selection is eligible.
- Both checkout endpoints independently validate mode, date, weekday, explicit-date restrictions, availability window and preparation lead time inside the transaction. A rejected date cannot create an order or debit the wallet. The selected calendar date is retained on the order; stored cart dates are used when checkout omits schedule fields.
- Cart additions validate schedules and reject mixing different preorder dates. Meals unavailable today can still accept eligible future preorders and remain discoverable when preorder is configured.
- Fixed retail/meal classification in checkout, stale Shop/Dine search results, stale vendor detail responses, pagination handling and repeated page appends on reconnection.
- Following uses the signed-in personal identity, prevents repeated taps, guards delayed results across account changes, and updates follower relationships and counts in one transaction.
- Anonymous delivery/logistics visitors receive a bottom-left WhatsApp link to +237676935805. The logistics landing is public; account tools retain dashboard protection. Delivery forms use a shorter layout and collapse optional fields.
- Stories and vendor discovery use the shared site bottom navigation instead of a second implementation.

## Verification

- Products, carts, vendors and restaurants: 66 integration tests passed, including an eligible-date/invalid-date/cart-date-conflict regression.
- Existing multi-vendor checkout coverage: 10 tests passed.
- New preorder checkout coverage: 4 tests passed (paid date preservation, single-vendor endpoint, cart schedule fallback and no order/debit for an invalid date).
- Simultaneous follow mutation: 1 integration test passed, with one relationship and an accurate count.
- Restaurant regression after preorder visibility update: 18 tests passed.
- Server schedule rules: 6 unit tests passed.
- Frontend availability choices: 4 tests passed, including invalid selected value handling.
- Next.js production build passed.
- Browser checks at 390px passed for Shop, Dine, delivery and logistics with no horizontal overflow or runtime errors; guest WhatsApp links checked. Authenticated fixture navigation checked across Shop, Stories and vendor discovery.

Tests use isolated databases and browser API fixtures. No live provider charge was made. These checks cover the changed flows and do not certify all third-party services or every production scenario.
