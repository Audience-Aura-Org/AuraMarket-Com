# Manager Workspace Redesign — Design Spec

**Date:** 2026-10-21
**Status:** Approved in brainstorming; awaiting written-spec review
**Scope:** Every manager-role surface in `web/` plus additive read-only backend endpoints.

## 1. Intent

AuraMarket managers run several vendor, logistics, and customer accounts on
those owners' behalf — the same model as a Google Ads manager account (MCC)
or Facebook Business Manager. The current UI spreads that job across 13 flat
navigation items and 12 near-identical list pages.

**Success means:**

- A manager can answer *"which of my accounts needs me right now, and why?"*
  within five seconds of landing.
- Entering an account, working in it, and returning is one tap each way, and
  the manager always knows whose account they are acting in.
- All manager surfaces read as one coherent, premium product — "stunning",
  no childish icons — on phone and desktop, light and dark.

**Decisions made with the user:**

| Question | Decision |
|---|---|
| Restructure vs restyle | Restructure into 5 sections (Google Ads model) |
| Visual direction | Look & feel of "Executive" (glass surfaces, briefing headline, confident type) with the analytical density of "Precision" (dense tables, tabular numbers, status-only colour) |
| Navigation shell | Left rail with account picker on desktop; bottom tabs + picker sheet on phone |
| Detail calls | Delegated to engineering judgement ("use what's best") |

## 2. Information architecture

Five sections replace the 12 current pages. Nothing is dropped.

| Section | Route | Contents | Absorbs |
|---|---|---|---|
| **Accounts** (home) | `/manager` | Briefing headline, scorecards with 30-day deltas, accounts table, account side panel | Overview, Accounts, Money (summary) |
| **Inbox** | `/manager/inbox` | Unified queue of everything waiting on the manager; tabs All / Orders / Deliveries / Messages / Issues; account filter | Tasks, Orders, Shipments, Messages |
| **Performance** | `/manager/performance` | Date range, revenue trend, per-account comparison; **Money** tab | Reports, Money (detail) |
| **Notes & Activity** | `/manager/journal` | Tabs: Notes (reminders, per-account, done) and Activity (audit log of act-as writes) | Notes, Activity |
| **Settings** | `/manager/settings` | Profile + notification preferences; **Invitations** panel (incoming to accept, sent, invite form) | Settings, Invitations |

### 2.1 Accounts (home)

- **Briefing header:** date eyebrow + headline computed from data
  (*"5 accounts need you today"*, or *"All accounts are on track"*).
- **Scorecards (4):** Revenue 30d, Orders 30d, Open tasks (with overdue
  count), Total balance. Revenue/Orders show the delta vs the previous 30
  days. A sparkline of daily revenue sits in the Revenue card.
- **Accounts table** — columns: health dot, account (name + type label),
  revenue 30d, orders 30d, balance, open tasks, last activity, *Open*.
  - Default sort: health (urgent → attention → ok), then open tasks desc.
  - Search (name/email), type filter (All / Vendor / Logistics / Customer),
    sortable columns.
  - Row click opens the **account panel**; *Open* enters the workspace.
- **Account panel** (desktop: right side panel; phone: bottom sheet):
  open tasks for that account (each deep-links into the workspace),
  permission scope, assignment expiry, notes for the account with quick add,
  primary action **Open workspace**.

### 2.2 Inbox

- One list built from `GET /manager/tasks` (orders, deliveries, unread
  messages, KYC, disputes), oldest first, each row: type label, title,
  account, age, chevron. Age turns amber > 24h, red > 72h.
- Tabs: All · Orders · Deliveries · Messages · Issues (KYC + disputes),
  each with a count. Account filter via the shared picker in "filter" mode.
- A secondary **"Recent"** toggle shows the full cross-account lists that
  the old Orders / Shipments / Messages pages showed (status filter for
  orders, unread-only for messages), so no capability is lost.
- Every row links to the correct page of the correct account workspace.

### 2.3 Performance

- **Overview tab:** date range (7d / 30d / 90d / custom), revenue trend
  line chart (Recharts, already a dependency), comparison table per account:
  orders, revenue, delivered %, cancelled %, sorted by revenue. Phone: the
  table scrolls horizontally with a sticky first column (the only
  horizontally scrolling element in the redesign).
- **Money tab:** per account balance, pending withdrawals (count + amount),
  and whether money permission is granted; *Open wallet* deep-links to the
  workspace wallet only when permission is granted.

### 2.4 Notes & Activity

- **Notes:** composer (text, optional account, optional reminder), list
  grouped *Due* / *Upcoming* / *Done*, toggle done, delete, filter by
  account.
- **Activity:** audit log rows — time, account, category, action
  (`METHOD path`), changed field names — filter by account and category.

### 2.5 Settings

- Profile summary (name, email — read only).
- Notification toggles (email, push, daily digest) — saved immediately with
  optimistic UI and rollback on error.
- **Invitations panel:** incoming requests (Accept / Decline), sent
  invitations (status), invite form (email + permission checkboxes for
  products, orders, messages, money, profile).

### 2.6 Legacy routes

`/manager/accounts`, `/tasks`, `/orders`, `/shipments`, `/messages`,
`/money`, `/reports`, `/notes`, `/activity`, `/invitations` become
redirect stubs to the new section + tab (e.g. `/manager/orders` →
`/manager/inbox?tab=orders&view=recent`), so bookmarks and notification
links keep working.

## 3. Shell and account switching

### 3.1 `ManagerShell`

A dedicated shell for all `/manager/*` routes, replacing `RoleSidebar`'s
13-item `MANAGER_NAV` and the generic `BottomNav` while inside manager pages.

- **Desktop ≥ 1024px:** 232px left rail — account picker at top, the five
  sections with live counts (Inbox = open tasks), Marketplace + profile at
  the bottom.
- **Tablet 768–1023px:** rail collapses to a 64px icon strip with tooltips.
- **Phone < 768px:** slim header with the account picker; bottom tab bar with
  the five sections; safe-area aware.

### 3.2 Account picker (`AccountPicker`)

One component rendered as a popover (desktop) or full-height sheet (phone).

- Search by name/email; global shortcut ⌘K / Ctrl+K.
- Sections: Starred, Recent, All (with health dot + open-task count).
- Keyboard: ↑/↓ to move, Enter to open, Esc to close; focus trapped.
- Selecting an account navigates using the switching rules in §3.4.

### 3.3 Inside an account (`/manager/as/:id/...`)

- The rail swaps to the account's own menu (from `workspaceRegistry`
  `getWorkspaceNav(role)`), headed by **← All accounts**, the account name,
  type, and permission scope (e.g. "Products, Orders, Messages").
- Phone: bottom tabs become the account's first four pages + **More**
  (sheet with the rest).
- A quiet persistent strip replaces the coloured banner:
  *Working as **Mama Ngozi Kitchen** · changes are logged · Exit*.

### 3.4 Switching behaviour (already implemented, kept)

- Keep the current section if the target account type has it, otherwise
  open Dashboard; detail pages (e.g. `products/edit`) never carry over.
- Re-selecting the active account is a no-op.
- Thin progress bar while switching; auto-clears after 8s.
- Revoked/expired access (`ASSIGNMENT_NOT_FOUND`) ejects to Accounts with a
  notice.

### 3.5 Removed

- `components/manager/WorkspaceFloatingBar.js` (redundant).
- `components/manager/AccountSwitcher.js` pill row (replaced by
  `AccountPicker`).
- `MANAGER_NAV` in `RoleSidebar.js`.

## 4. Visual system

All manager UI renders inside one `.manager-ui` wrapper that defines scoped
tokens on top of the global theme variables. Nothing outside the manager
area changes.

- **Surfaces:** translucent glass fill, 1px hairline border, radius 16px
  (cards/panels) and 12px (rows/inputs); subtle top-edge highlight in dark
  mode; no heavy shadows.
- **Type:** Plus Jakarta Sans for headlines; Inter for UI and data with
  `font-variant-numeric: tabular-nums` on every metric and numeric column.
  Scale: 12 / 13 / 15 / 20 / 28px; weights 400 / 500 / 600.
- **Colour:** neutral text tones derived from the theme; colour reserved for
  status — green (good/up), amber (waiting/late), red (urgent/down). Brand
  magenta only for the active-rail indicator and focus rings. Account type
  is a quiet text label, not a coloured badge.
- **Icons:** lucide-react line icons only, 16px, 1.5 stroke, current text
  colour. No icon tiles, filled backgrounds, emoji, or Material Symbols in
  manager pages.
- **Motion:** framer-motion for meaning only — panel/sheet slide, one-time
  row fade-in on first load. No count-up numbers. `prefers-reduced-motion`
  respected.
- **Accessibility:** status never by colour alone (dots carry text /
  `aria-label`); visible focus rings; ≥ 44px touch targets; sheets and
  popovers trap focus and close on Esc.

### 4.1 Shared component kit (`web/components/manager/ui/`)

| Component | Purpose |
|---|---|
| `PageHeader` | Eyebrow, headline, subtitle, right-side actions |
| `Scorecard` | Label, value, delta, optional sparkline |
| `DataTable` | Sortable table; renders a designed stacked list below 768px |
| `FilterTabs` | Tabs with counts; URL-synced (`?tab=`) |
| `StatusDot` | Health/status dot with accessible label |
| `SidePanel` / `BottomSheet` | Responsive detail surface |
| `EmptyState` | Message + single next step |
| `ErrorState` | Inline message + Retry |
| `Skeleton` | Layout-shaped loading placeholders |
| `AccountPicker` | §3.2 |

Each component is small, prop-driven, and has no data fetching.

## 5. Data layer

### 5.1 Frontend

`useManagerQuery(path, params)` replaces the copy-pasted
fetch / loading / `hasFetched` logic in every page. It returns
`{ data, error, loading, refreshing, refetch }`, keeps previous data while
refetching (no empty flashes), refetches on window focus, and ignores
responses for stale parameters.

### 5.2 Backend additions (additive, read-only)

| Endpoint | Addition |
|---|---|
| `GET /manager/accounts` | Per row: `revenue30d`, `orders30d`, `balance`, `pendingWithdrawals`, `health` (`urgent` = any task older than 24h or an open dispute; `attention` = any open task; `ok` otherwise). Computed with one aggregate per collection, not per-account queries. |
| `GET /manager/overview` | `previous` totals for the prior 30 days (deltas) and `trend`: daily revenue for the last 30 days. |
| `GET /manager/reports` | `series`: daily revenue for the selected range; per-row `deliveredRate`, `cancelledRate`. |

Revenue everywhere excludes cancelled / refund_pending / refunded orders
(matches the existing fix). Existing response fields are unchanged.

## 6. States

Every data view implements all four: **skeleton** (layout-shaped),
**empty** (one next step, e.g. "No accounts yet — invitations appear in
Settings", "Inbox zero"), **error** (inline + Retry — never a silent empty
list), and **data**.

## 7. Testing and verification

- Backend: extend `backend/tests/integration/manager.test.js` with tests for
  each §5.2 addition (metrics per account, health rules, deltas, series,
  revenue exclusions). Whole manager suite must stay green.
- Frontend: `next build` must pass.
- Legacy URL redirects verified.
- Visual check of all five sections and the account workspace, in light and
  dark, at phone and desktop widths, by driving the running app; results
  shown to the user.

## 8. Rollout

Single change set. Old pages become redirect stubs. The uncommitted UI
polish edits currently in the working tree for `web/app/manager/*` are
superseded by this redesign; the commit message notes it.

## 9. Out of scope

- Real-time socket updates inside account workspaces (embedded pages keep
  their existing polling/refresh behaviour).
- Changes to vendor / logistics / customer pages themselves.
- Admin pages, including `/admin/managers`.
- Bulk actions across accounts.
