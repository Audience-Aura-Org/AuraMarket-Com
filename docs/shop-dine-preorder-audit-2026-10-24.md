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

## Follow-up: reorder and restaurant hours

- Reordering a previous preorder now requires a newly chosen eligible date. The customer order screen opens the restaurant menu to select it, rather than copying the historical date or altering the existing cart first.
- The reorder API validates current meal availability, weekdays and dates before rebuilding the cart. It persists the new date and clears any old preorder date when rebuilding an ordinary meal order.
- Reorder review now reads the API's actual price-change, unavailable-item and added-count fields; buyers see the changes before proceeding to checkout. Retail orders no longer display a food-only reorder action.
- Restaurant opening calculations use Cameroon time independently of the server timezone, support overnight shifts, find the next actual opening day, and merge touching shifts.
- Existing placed orders retain their recorded schedule; current availability controls new checkouts and reorders.

Follow-up verification: 11 schedule/opening-hours unit tests, 9 reorder/checkout integration tests, 18 restaurant integration tests, the production build, and mobile browser checks for choosing a new preorder date and reviewing reorder changes all passed. One combined integration attempt hit a setup timeout; the restaurant suite passed when rerun on its own.
