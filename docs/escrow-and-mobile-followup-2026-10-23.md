# Escrow, mobile tables and managed-account messaging

## Specific held escrow finding

A read-only database check identified the screenshot's 100 XAF held escrow:

- Escrow: `6a7b3d8a34044c2e4684a051`
- Original order: `6a7b3d8734044c2e4684a03a` — document missing
- Original vendor: `6a78683037c80357014ba8ea` — document missing
- Created: 2026-08-11 15:19:38 UTC
- Delivery and auto-release timestamps: absent

This record cannot safely settle: neither the original order nor the vendor/wallet recipient can be resolved. No balance, escrow status or production records were changed. Recover the original documents and payment evidence from a verified backup before deciding settlement; do not substitute another vendor or manufacture a completed payout. The table now preserves and displays the original IDs and labels the record **Needs reconciliation**, with an explicit reason and no release/refund buttons.

Settlement also now rejects a missing vendor/wallet, mismatched order/vendor, unconfirmed payment or active dispute before crediting funds. Refunds on an orphaned order produce an explicit error. Disputed records route through dispute resolution rather than presenting a force-release button that cannot safely execute.

## Frontend changes

- Vendor Transactions and Escrow Activity now use semantic tables with aligned headings, status, amount, date and references. Escrow details expand within the table. Statistics retain their existing design.
- Escrow search, status filtering and 20-row pagination run on the server; global totals remain independent of the current page. Stable date/ID ordering prevents overlapping pages. Missing linked records remain searchable by their original reference.
- Shared financial/order tables use larger mobile type and row spacing, a horizontal-scroll hint and a pinned account column. They retain readable column widths and keep scrolling within the table instead of widening the page.
- Vendor order detail hides the list filters, compacts the existing statistic cards, places fulfilment actions first and reformats product rows to fit small screens. Buttons and message composition have larger targets. The shared order view puts products before activity/contact panels, wraps product names and limits the activity list height on phones.
- Managed vendor, customer and logistics workspaces have Messages navigation and an accessible shortcut in the Working as banner. A dedicated account inbox handles direct, order and delivery conversations; it never substitutes the manager's personal inbox. API requests bind explicitly to the managed account, use existing assignment/message permissions and retain server attribution. Visible conversations refresh periodically and acknowledge reads; failed sends retain drafts and direct-message retries retain an idempotency key.

## Verification

- Final production build: passed on Next.js 16.4.2, including pagination boundary handling and the managed-account inbox.
- Escrow lifecycle and ledger integration: 2 files, 19 tests passed, including orphan diagnosis, preserved/searchable IDs, 20/1 pagination, stable date ties, missing-recipient rollback and active-dispute protection.
- Escrow concurrency: 4 tests passed.
- Managed messaging integration: 3 tests passed (42 unrelated tests skipped), covering identity separation, reply idempotency and attribution, missing permission and revoked assignment.
- Frontend account-message/API/table tests: 3 files, 13 tests passed.
- Browser fixtures: five financial tables passed 20/5 pagination, record actions, desktop/mobile containment, horizontal scrolling and pinned identity columns. Additional checks covered vendor Transactions and Escrow tables, reconciliation details and valid/blocked controls; vendor order status failures, message draft retention, push refresh; buyer order layouts at 320/390/768px; managed messaging at 320/390/1440px, account navigation, scoped reads/replies, personal inbox isolation and retry behavior.

Browser writes were intercepted with fixtures. No live customer messages, charges, refunds or payouts were sent. Actual push delivery and provider checks remain subject to the deployment requirements in `production-readiness-2026-10-23.md`.
