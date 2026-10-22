# Manager Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 12 flat manager pages with a 5-section, Google-Ads-style manager workspace (Accounts · Inbox · Performance · Notes & Activity · Settings) in a premium "glass + dense analytics" visual system, with a dedicated shell and ⌘K account picker.

**Architecture:** Additive read-only backend metrics feed a new shared frontend kit (`web/components/manager/ui/*` + `useManagerQuery`). A dedicated `ManagerShell` (rail / phone bottom tabs / account picker) wraps every `/manager/*` route, swapping to the account's own menu inside `/manager/as/:id`. Old routes become client-side redirect stubs.

**Tech Stack:** Next.js 16 app router (JS, `output: 'export'` for native builds), Tailwind 4, lucide-react, framer-motion, recharts; Express + Mongoose backend; vitest + supertest + mongodb-memory-server (backend); vitest + jsdom + React Testing Library (web, added in Task 3).

**Spec:** `docs/superpowers/specs/2026-10-21-manager-workspace-redesign-design.md`

## Global Constraints

- Preserve every uncommitted manager **fix** from this session (backend `delegate`/`auth` middleware, `manager.controller.js`, `services/api.js` act-as allowlist + cache scoping, `hooks/useAuth.js` overlay, `app/manager/as/[userId]/[[...slug]]/page.js`, `AccountSwitcher` switching rules re-implemented in `AccountPicker`). Redesign tasks rewrite *presentation*, never those behaviours.
- Existing API response fields stay unchanged; additions only. `GET /manager/reports` keeps returning an array; its series lives at the new `GET /manager/reports/series`.
- Revenue everywhere excludes `cancelled`, `refund_pending`, `refunded` orders (reuse `revenueExpr` in `manager.controller.js`).
- Health: `urgent` = the account has any task older than 24h **or** any `dispute` task; `attention` = any open task; `ok` otherwise.
- All manager UI renders inside `.manager-ui`; nothing outside `/manager/*` changes visually.
- Type: Plus Jakarta Sans (headlines), Inter (UI/data), `tabular-nums` on all numbers; scale 12 / 13 / 15 / 20 / 28px; weights 400 / 500 / 600.
- Colour only for status: good `#3fb950`-family, warn amber, bad red, defined as tokens with light-theme variants. Brand `var(--accent)` only for the active-rail indicator and focus rings. Account type = plain text label.
- Icons: lucide-react only, `size={16}`, `strokeWidth={1.5}`, `currentColor`. No icon tiles, filled backgrounds, emoji, or `material-symbols` in manager files.
- Surfaces: glass fill + 1px hairline border; radius 16px cards/panels, 12px rows/inputs; no heavy shadows.
- Breakpoints: phone < 768px (header + bottom tabs), 768–1023px (64px icon rail), ≥ 1024px (232px rail). Touch targets ≥ 44px. Only the Performance comparison table may scroll horizontally.
- Motion: panel/sheet slide + one-time row fade only; honour `prefers-reduced-motion`; no count-up numbers.
- Every data view has skeleton, empty, error (inline + Retry), and data states.
- No new runtime dependencies. New **devDependencies** only (user-approved): `vitest@^4.1.11` (same as backend), `jsdom`, `@testing-library/react`, `@testing-library/dom`. Web tests live next to their module as `*.test.js` and run with `cd web && npm test`.
- Component logic with rules (switching, picker filtering, tab mapping, headline, redirects, formatting) lives in pure modules so it is unit-tested; components only render.
- Commits: only after the user authorizes committing; if authorized, branch off `main` first (`git switch -c feat/manager-redesign`). Otherwise skip commit steps and leave changes in the working tree.

## Review Focus

1. **Manager with zero assigned accounts** — every section must render its empty state; deltas with a zero previous period must be `null` (shown as "—"), never `Infinity`/`NaN`. Test: Task 2 `overview with no accounts returns zero totals and null-safe previous`.
2. **Customer-type and logistics accounts in revenue columns** — customers show 0 revenue/orders without errors; logistics revenue comes from shipments. Test: Task 1 `computes logistics revenue from shipments and zero for customers`.
3. **Starred/Recent entries for accounts the manager no longer manages** (persisted in localStorage) — the picker must show only accounts present in the current `accounts` list. Test: Task 4 `pickerSections drops starred/recent ids not in accounts`.
4. **Light theme legibility** — glass tokens designed on dark must keep text/border contrast on white. Check: Task 11 visual pass in light theme on every section.
5. **Long names and 200+ accounts on a phone** — names truncate with full name in `title`, table/picker stay usable, no horizontal page scroll. Check: Task 6 step "long-name and many-accounts check" and Task 4 picker search.

---

## File Structure

**Backend**
- Modify `backend/controllers/manager.controller.js` — account metrics + health, overview `previous`/`trend`, reports rates, new `getReportSeries`.
- Modify `backend/routes/manager.routes.js` — `GET /reports/series`.
- Modify `backend/tests/integration/manager.test.js` — tests for the above.

**Frontend — test setup**
- Create `web/vitest.config.mjs`, `web/vitest.setup.js`; modify `web/package.json` (`"test": "vitest run"`, devDependencies).

**Frontend — pure logic (unit-tested)**
- Create `web/components/manager/switching.js` — `resolveSwitchTarget`, `pickerSections`.
- Create `web/components/manager/inboxTabs.js` — `INBOX_TABS`, `tasksForTab`, `tabCounts`.
- Create `web/components/manager/briefing.js` — `briefingHeadline`, `sortAccounts`.
- Create `web/components/manager/legacyRoutes.js` — `LEGACY_ROUTES`.

**Frontend — foundation**
- Create `web/styles/manager.css` — `.manager-ui` tokens (light + `.dark`), font assignments, focus ring.
- Create `web/hooks/useManagerQuery.js` — data hook.
- Create `web/components/manager/ui/format.js` — `formatMoney`, `formatNumber`, `formatDelta`, `timeAgo`.
- Create `web/components/manager/ui/{PageHeader,Scorecard,DataTable,FilterTabs,StatusDot,SidePanel,EmptyState,ErrorState,Skeleton}.js` + `index.js` barrel.

**Frontend — shell**
- Create `web/components/manager/shell/nav.js` — section config.
- Create `web/components/manager/shell/{ManagerShell,ManagerRail,ManagerMobileBar,ManagerBottomTabs,WorkingAsStrip}.js`.
- Create `web/components/manager/AccountPicker.js`.
- Modify `web/app/manager/layout.js` — use `ManagerShell` instead of `DashboardLayout`; import `manager.css`.
- Modify `web/app/manager/as/[userId]/layout.js` — `WorkingAsStrip` instead of the coloured banner.
- Modify `web/components/manager/workspaceRegistry.js` — nav `icon` fields become lucide components.
- Modify `web/components/Providers.js` — no `TopNav`/`BottomNav`/`WorkspaceFloatingBar` on `/manager/*`.
- Modify `web/components/layout/RoleSidebar.js` — remove `MANAGER_NAV` + acting-manager branch.
- Delete `web/components/manager/AccountSwitcher.js`, `web/components/manager/WorkspaceFloatingBar.js`.

**Frontend — sections**
- Rewrite `web/app/manager/page.js` (Accounts) + create `web/components/manager/AccountPanel.js`.
- Create `web/app/manager/inbox/page.js`.
- Create `web/app/manager/performance/page.js` (+ `web/components/manager/RevenueTrend.js`).
- Create `web/app/manager/journal/page.js`.
- Rewrite `web/app/manager/settings/page.js` (+ `web/components/manager/InvitationsPanel.js`).
- Create `web/components/manager/LegacyRedirect.js`; replace `web/app/manager/{accounts,tasks,orders,shipments,messages,money,reports,notes,activity,invitations}/page.js` with stubs.

---

### Task 1: Account metrics and health on `GET /manager/accounts`

**Files:**
- Modify: `backend/controllers/manager.controller.js` (`getAccounts`)
- Test: `backend/tests/integration/manager.test.js` (new `describe('Accounts metrics')`)

**Interfaces:**
- Produces: each account row gains `revenue30d: number`, `orders30d: number`, `balance: number`, `pendingWithdrawals: number`, `health: 'urgent'|'attention'|'ok'`. Existing fields unchanged.

- [ ] **Step 1: Write the failing tests**

```js
describe('Accounts metrics', () => {
  it('returns 30-day revenue/orders, balance and pending withdrawals per vendor', async () => {
    // vendorUser wallet_balance 25000; orders in last 30d: completed 5000, cancelled 7000;
    // one order 40 days old 9000; one pending WithdrawalRequest (amount 3000, requested_by vendorUser)
    // expect row: { revenue30d: 5000, orders30d: 2, balance: 25000, pendingWithdrawals: 1 }
  })
  it('computes logistics revenue from shipments and zero for customers', async () => {
    // logistics firm: shipments in 30d with price 1500 (delivered) + 2000 (cancelled)
    // expect logistics row { revenue30d: 1500, orders30d: 2 }; customer row { revenue30d: 0, orders30d: 0 }
  })
  it('derives health: urgent for >24h task or dispute, attention for any task, ok otherwise', async () => {
    // A: placed order createdAt now-25h → 'urgent'
    // B: placed order createdAt now-1h  → 'attention'
    // C: no tasks                       → 'ok'
    // D: dispute (status 'pending') created now-1h → 'urgent'
  })
})
```
Use the existing helpers in the file (`setup`, `makeOrder`, `makeLogistics`, `assign`); set `createdAt` explicitly with `Order.create({..., createdAt })` (timestamps allow override) and create the withdrawal via `WithdrawalRequest.create` with the model's required fields.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run --project integration tests/integration/manager.test.js -t "Accounts metrics"`
Expected: FAIL (`revenue30d` undefined).

- [ ] **Step 3: Implement in `getAccounts`**

One `Order.aggregate` grouped by `vendor_id` (last 30d, `revenueExpr`, count), one `Shipment.aggregate` grouped by `logistics_id` (last 30d; revenue = `price` unless status `cancelled`/`failed`; count all), one `User.find` for `wallet_balance`, one `WithdrawalRequest.aggregate` (status `pending`) grouped by `requested_by`; map vendor/logistics ids to users via `scope.vendorUser` / `scope.logisticsUser`. Health from the already-collected `tasks`: per user, `urgent` if any task `type === 'dispute'` or `Date.now() - at > 864e5`.

- [ ] **Step 4: Run to verify pass, then whole suite**

Run: `cd backend && npx vitest run --project integration tests/integration/manager.test.js`
Expected: all pass.

- [ ] **Step 5: Commit** (if authorized) — `feat(manager): per-account metrics and health`

---

### Task 2: Overview deltas/trend, report rates, report series

**Files:**
- Modify: `backend/controllers/manager.controller.js` (`getOverview`, `getReports`, new `getReportSeries`)
- Modify: `backend/routes/manager.routes.js`
- Test: `backend/tests/integration/manager.test.js`

**Interfaces:**
- Produces:
  - `GET /manager/overview` → existing fields + `previous: { orders30d: number, revenue30d: number }` (days 31–60 ago) + `trend: Array<{ date: 'YYYY-MM-DD', revenue: number }>` (exactly 30 entries, UTC, oldest first, zero-filled).
  - `GET /manager/reports` rows gain `deliveredRate: number`, `cancelledRate: number` (0–1; 0 when `orders` is 0).
  - `GET /manager/reports/series?from&to&account` → `Array<{ date, revenue, orders }>` zero-filled per UTC day across the range; same validation/400s as `/reports`; range capped at 366 days (400 beyond).

- [ ] **Step 1: Write the failing tests**

```js
it('overview returns previous-period totals and a 30-day zero-filled trend', ...)
  // order completed 5000 today, order completed 2000 at now-40d
  // expect previous.revenue30d === 2000, trend.length === 30,
  // trend.at(-1).revenue === 5000, trend[0].revenue === 0
it('overview with no accounts returns zero totals and null-safe previous', ...)
  // brand-new manager: totals.accounts 0, previous { orders30d: 0, revenue30d: 0 }, trend.length 30
it('reports include delivered and cancelled rates', ...)
  // 1 completed + 1 cancelled → deliveredRate 0.5, cancelledRate 0.5
it('report series is zero-filled per day and validates the range', ...)
  // from=2026-01-01&to=2026-01-03 → 3 entries with dates '2026-01-01'..'2026-01-03'
  // from=2025-01-01&to=2026-06-01 → 400
```

- [ ] **Step 2: Run to verify failure** — same command with `-t` for the new names; Expected: FAIL.

- [ ] **Step 3: Implement**

Daily buckets via `$dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' }`; zero-fill in JS by walking UTC days from `from` to `to`. Extract a `dailyRevenue(vendorIds, from, to)` helper shared by `getOverview` and `getReportSeries`. Register `router.get('/reports/series', getReportSeries)` **before** any `/reports/:x` route.

- [ ] **Step 4: Run whole manager suite** — Expected: all pass.

- [ ] **Step 5: Commit** (if authorized) — `feat(manager): overview deltas, trend and report series`

---

### Task 3: Web test runner + visual foundation — tokens, data hook, UI kit

**Files:**
- Create: `web/vitest.config.mjs`, `web/vitest.setup.js`
- Modify: `web/package.json`
- Create: `web/styles/manager.css`, `web/hooks/useManagerQuery.js`, `web/components/manager/ui/*.js`
- Test: `web/components/manager/ui/format.test.js`, `web/hooks/useManagerQuery.test.js`, `web/components/manager/ui/DataTable.test.js`

**Interfaces:**
- Produces:
  - CSS tokens on `.manager-ui` (light) and `.dark .manager-ui`: `--m-bg`, `--m-surface`, `--m-surface-hover`, `--m-border`, `--m-border-strong`, `--m-text`, `--m-text-muted`, `--m-text-faint`, `--m-good`, `--m-warn`, `--m-bad`, `--m-brand: var(--accent)`, `--m-radius-card: 16px`, `--m-radius-row: 12px`; utility classes `.m-card`, `.m-row`, `.m-num` (tabular-nums), `.m-headline` (Plus Jakarta Sans), focus-visible ring in `--m-brand`.
  - `useManagerQuery(path: string, params?: object, opts?: { enabled?: boolean }) → { data: any, error: string|null, loading: boolean, refreshing: boolean, refetch: () => Promise<void> }` — first load sets `loading`; later loads keep `data` and set `refreshing`; refetch on window focus; ignores responses whose `path+params` key is no longer current; `error` is the API `message` or `err.message`.
  - `format.js`: `formatMoney(n: number) → '4.82M' | '860K' | '950'` (no currency suffix; callers add `XAF` label), `formatNumber(n) → '1,284'`, `formatDelta(current, previous) → { text: '+12.4%' | '—', tone: 'good'|'bad'|'neutral' }` (previous 0 → `'—'`, neutral), `timeAgo(date) → 'now'|'5m'|'3h'|'2d'`.
  - Components (all props-only, no fetching):
    - `PageHeader({ eyebrow?, title, subtitle?, actions? })`
    - `Scorecard({ label, value, delta?: {text,tone}, hint?, series?: number[] })` — sparkline as inline SVG polyline when `series` given.
    - `DataTable({ columns, rows, rowKey, onRowClick?, initialSort?, empty? })` with `columns: [{ key, header, align?: 'left'|'right', sortable?: boolean, sortValue?: (row)=>any, render?: (row)=>node, mobile?: 'primary'|'secondary'|'meta'|'hidden' }]`; < 768px renders a stacked list using the `mobile` roles.
    - `FilterTabs({ tabs: [{ value, label, count? }], value, onChange })`
    - `StatusDot({ status: 'urgent'|'attention'|'ok'|'neutral', label: string })` — renders `aria-label={label}`.
    - `SidePanel({ open, onClose, title, children, footer? })` — right panel ≥ 1024px, bottom sheet below; Esc closes; focus trapped.
    - `EmptyState({ title, description?, action? })`, `ErrorState({ message, onRetry })`, `Skeleton({ className })`, `SkeletonRows({ rows = 5 })`.
    - `index.js` re-exports all of the above plus `format.js` helpers.

- [ ] **Step 1: Set up the web test runner**

`cd web && npm i -D vitest@^4.1.11 jsdom @testing-library/react @testing-library/dom`; add `"test": "vitest run"` to scripts. `vitest.config.mjs`: `environment: 'jsdom'`, `include: ['**/*.test.js']`, `exclude: ['node_modules', '.next', 'out', 'android']`, `esbuild: { jsx: 'automatic' }`, `resolve.alias: { '@': <web root> }`, `setupFiles: ['./vitest.setup.js']` (calls RTL `cleanup` after each test). Next's build must ignore test files (they are not under `app/`, so no route is created).

- [ ] **Step 2: Write the failing tests**

```js
// format.test.js
formatMoney(4820500) === '4.82M'; formatMoney(860000) === '860K'; formatMoney(950) === '950'; formatMoney(0) === '0'
formatNumber(1284) === '1,284'
formatDelta(112, 100) → { text: '+12.0%', tone: 'good' }; formatDelta(90, 100) → { text: '-10.0%', tone: 'bad' }
formatDelta(5, 0) → { text: '—', tone: 'neutral' }; formatDelta(0, 0) → { text: '—', tone: 'neutral' }
timeAgo(now - 30s) === 'now'; timeAgo(now - 5min) === '5m'; timeAgo(now - 3h) === '3h'; timeAgo(now - 2d) === '2d'

// useManagerQuery.test.js (vi.mock('@/services/api'))
it('sets loading on first fetch then exposes data')
it('keeps previous data and sets refreshing on refetch')
it('exposes the API message as error and clears it on successful retry')
it('ignores a response for params that are no longer current')   // change params mid-flight; stale resolve must not overwrite

// DataTable.test.js
it('sorts by a sortable column and toggles direction on second click')
it('calls onRowClick with the row')
it('renders the empty node when rows is empty')
```

- [ ] **Step 3: Run to verify failure** — `cd web && npm test` → FAIL (modules missing).
- [ ] **Step 4: Create `manager.css` with the tokens above**; dark values from the approved mockup (`surface rgba(255,255,255,.04)`, `border rgba(255,255,255,.07)`, muted `#8790a8`); light values: `surface rgba(15,23,42,.03)`, `border rgba(15,23,42,.08)`, muted `#64748b`, text `#0f172a`.
- [ ] **Step 5: Create `useManagerQuery.js`, `format.js`, and the UI components** per the signatures above, obeying Global Constraints (icons, radii, motion, a11y).
- [ ] **Step 6: Verify** — `cd web && npm test` → all pass; `npx next build` → succeeds.
- [ ] **Step 7: Commit** (if authorized) — `feat(manager-ui): web test runner, tokens, data hook and component kit`

---

### Task 4: Manager shell and account picker

**Files:**
- Create: `web/components/manager/switching.js`, `web/components/manager/shell/{nav,ManagerShell,ManagerRail,ManagerMobileBar,ManagerBottomTabs}.js`, `web/components/manager/AccountPicker.js`
- Modify: `web/app/manager/layout.js`, `web/components/Providers.js`, `web/components/layout/RoleSidebar.js`, `web/components/manager/workspaceRegistry.js`
- Delete: `web/components/manager/AccountSwitcher.js`, `web/components/manager/WorkspaceFloatingBar.js`
- Test: `web/components/manager/switching.test.js`

**Interfaces:**
- Consumes: `useManagerMode` (`accounts`, `actAsId`, `recent`, `starred`, `toggleStar`, `setSwitching`, `clearActAs`, `loadAccounts`); `getWorkspaceNav(role)`; Task 1 account fields (`health`, `tasks`); Task 3 kit.
- Produces:
  - `MANAGER_SECTIONS: Array<{ key: 'accounts'|'inbox'|'performance'|'journal'|'settings', label, href, icon, match: (pathname)=>boolean }>` — labels `Accounts`, `Inbox`, `Performance`, `Notes & Activity`, `Settings`; hrefs `/manager`, `/manager/inbox`, `/manager/performance`, `/manager/journal`, `/manager/settings`; lucide icons `LayoutGrid`, `Inbox`, `LineChart`, `NotebookPen`, `Settings`.
  - `ManagerShell({ children })` — renders `.manager-ui` root, rail/mobile bar/bottom tabs, progress bar when `switching`.
  - `AccountPicker({ mode: 'navigate'|'filter', value?: string|null, onSelect?: (id|null)=>void, align?: 'start'|'end' })` — `navigate` mode applies the switching rules (keep section if target role has it, else `dashboard`; no-op on active account; `setSwitching(true)`), `filter` mode calls `onSelect`. Global ⌘K/Ctrl+K opens the navigate-mode picker.
  - `getWorkspaceNav(role)` items' `icon` becomes a lucide component (vendor: `LayoutDashboard, Package, ShoppingCart, Wallet, BarChart3, Star, Scale`; logistics: `LayoutDashboard, ClipboardList, Tags, MapPin, Wallet, MessagesSquare, BarChart3`; customer: `User`).
  - `switching.js` (pure, no React):
    - `resolveSwitchTarget({ pathname: string, accountId: string|null, actAsId: string|null, accounts: Array<{id, role}> }) → string|null` — `null` = no-op; `accountId === null` → `'/manager'`; otherwise `/manager/as/{accountId}/{section}`, section kept only if `getWorkspaceNav(target.role)` has that slug, else `'dashboard'`.
    - `pickerSections({ accounts, starred, recent, query }) → { starred: Account[], recent: Account[], all: Account[] }` — starred/recent resolved against `accounts` by id (stale ids dropped, current account data used); query filters all three by name/email, case-insensitive; `all` sorted by health (urgent → attention → ok) then name.

- [ ] **Step 1: Write the failing tests** (`switching.test.js`)

```js
it('keeps the section when the target role has it')         // '/manager/as/A/orders', vendor B → '/manager/as/B/orders'
it('falls back to dashboard when the target role lacks it') // '/manager/as/A/products', logistics B → '/manager/as/B/dashboard'
it('never carries detail pages over')                       // '/manager/as/A/products/edit' → '/manager/as/B/products'
it('is a no-op when selecting the active account')          // actAsId 'A', pathname '/manager/as/A/orders', 'A' → null
it('returns /manager for "All accounts"')                   // accountId null → '/manager'
it('pickerSections drops starred/recent ids not in accounts')
it('pickerSections filters by name and email, case-insensitive')
it('pickerSections orders all by health then name')
```

- [ ] **Step 2: Run** — `cd web && npm test -- switching` → FAIL; implement `switching.js`; rerun → PASS.
- [ ] **Step 3: Build `nav.js`, `AccountPicker.js`** — popover ≥ 768px, full-height sheet below; sections from `pickerSections`; ↑/↓/Enter/Esc; rows: `StatusDot` (from `health`), name (truncate + `title`), type label, task count; navigate mode uses `resolveSwitchTarget` (skip navigation on `null`).
- [ ] **Step 4: Build rail, mobile bar, bottom tabs, `ManagerShell`** — rail shows picker trigger ("Working in" + current account name or "All accounts"), sections with Inbox count = sum of `accounts[].tasks`, Marketplace (`/shop`) + profile at bottom; inside `/manager/as/:id` rail shows `← All accounts`, account name/type/permission scope (from `accounts[i].permissions`), then `getWorkspaceNav(role)` links to `/manager/as/:id/:slug`; phone bottom tabs: five sections, or inside an account the first four workspace pages + `More` (opens `SidePanel` with the rest).
- [ ] **Step 5: Wire up** — `app/manager/layout.js` renders `ManagerShell` (keep its existing effects: force `loadAccounts`, badge polling, act-as clearing, title, access-lost listener) and imports `@/styles/manager.css`; `Providers.js` skips `TopNav`, `BottomNav`, and `WorkspaceFloatingBar` when `pathname.startsWith('/manager')`; remove `MANAGER_NAV` and the `isManagerActing` branch from `RoleSidebar.js`; delete the two old components and their imports.
- [ ] **Step 6: Verify**

Run: `cd web && npm test && npx next build` → both succeed. Then `npx next dev`, sign in as a manager, and check at 390px, 900px, 1440px: rail/icon-strip/bottom tabs render; ⌘K opens picker; selecting an account lands in its workspace with the account menu; `← All accounts` returns; re-selecting the current account does nothing.

- [ ] **Step 7: Commit** (if authorized) — `feat(manager): dedicated shell and account picker`

---

### Task 5: Inside-account strip

**Files:**
- Create: `web/components/manager/shell/WorkingAsStrip.js`
- Modify: `web/app/manager/as/[userId]/layout.js`

**Interfaces:**
- Consumes: `useManagerMode.accounts`, `setActAs`, `setSwitching`.
- Produces: `WorkingAsStrip({ account })` — one line: `Working as <name>` · `changes are logged` (hidden < 768px) · `Exit` (→ `/manager`); neutral surface, no role colours.

- [ ] **Step 1: Replace the coloured banner in `as/[userId]/layout.js` with `WorkingAsStrip`**, keeping the existing `useIsomorphicLayoutEffect` that calls `setActAs(userId)` / `setSwitching(false)`.
- [ ] **Step 2: Verify** — build passes; in dev, the strip shows the right name for vendor, logistics and customer accounts; `Exit` returns to `/manager` and subsequent `/vendor/*` API calls carry no `X-Act-As` (Network tab).
- [ ] **Step 3: Commit** (if authorized) — `feat(manager): working-as strip`

---

### Task 6: Accounts home (`/manager`)

**Files:**
- Rewrite: `web/app/manager/page.js`
- Create: `web/components/manager/AccountPanel.js`, `web/components/manager/briefing.js`
- Test: `web/components/manager/briefing.test.js`

**Interfaces:**
- Consumes: `GET /manager/overview` (Task 2 fields), `GET /manager/accounts` (Task 1 fields), `GET/POST /manager/notes`, kit (Task 3).
- Produces:
  - `AccountPanel({ account, open, onClose })` — tasks for that account (`GET /manager/tasks?account=`), permission scope, expiry, notes for the account with quick add, primary `Open workspace` (`/manager/as/:id/dashboard`).
  - `briefing.js`: `briefingHeadline(accounts) → string`, `sortAccounts(accounts) → Account[]` (health urgent → attention → ok, then tasks desc, then name).

- [ ] **Step 0: Tests first** (`briefing.test.js`)

```js
briefingHeadline([])                                   === 'No accounts yet'
briefingHeadline([{health:'ok'},{health:'ok'}])        === 'All accounts are on track'
briefingHeadline([{health:'urgent'},{health:'ok'}])    === '1 account needs you today'
briefingHeadline([{health:'urgent'},{health:'attention'},{health:'ok'}]) === '2 accounts need you today'
it('sortAccounts orders by health, then tasks desc, then name')
```
Run `cd web && npm test -- briefing` → FAIL; implement; rerun → PASS.

- [ ] **Step 1: Build the page** — `PageHeader` eyebrow = weekday + date; headline from `briefingHeadline`; four `Scorecard`s (Revenue 30d with `trend` sparkline + delta, Orders 30d + delta, Open tasks with hint `"{k} overdue"` from urgent count, Total balance with hint `"across {accounts}"`); `DataTable` columns: health, account (+ type label), revenue30d, orders30d, balance, tasks, last activity (`timeAgo`), open action; default order from `sortAccounts`; search box + `FilterTabs` for type (All/Vendor/Logistics/Customer, with counts); row click opens `AccountPanel`.
- [ ] **Step 2: States** — `SkeletonRows` while loading; `EmptyState` "No accounts yet" with action "Go to Settings → Invitations" (`/manager/settings#invitations`); `ErrorState` with `refetch`.
- [ ] **Step 3: Long-name and many-accounts check** — in dev, temporarily rename one account to 80 characters and verify truncation with full name in `title` at 390px; confirm no horizontal page scroll.
- [ ] **Step 4: Verify** — build passes; numbers match `GET /manager/overview` in the Network tab.
- [ ] **Step 5: Commit** (if authorized) — `feat(manager): accounts home`

---

### Task 7: Inbox (`/manager/inbox`)

**Files:**
- Create: `web/app/manager/inbox/page.js`, `web/components/manager/inboxTabs.js`
- Test: `web/components/manager/inboxTabs.test.js`

**Interfaces:**
- Consumes: `GET /manager/tasks?type&account`, `GET /manager/orders?status`, `GET /manager/shipments?status`, `GET /manager/messages?unread=true`; `AccountPicker mode="filter"`.
- Produces: URL contract `?tab=all|orders|deliveries|messages|issues&view=queue|recent&account=<id>` (used by Task 10 redirects). `inboxTabs.js`: `INBOX_TABS` (`[{ value, label, types }]` — all → every type; orders → `['order']`; deliveries → `['shipment']`; messages → `['message']`; issues → `['kyc','dispute']`), `tasksForTab(tasks, tab) → Task[]`, `tabCounts(tasks) → { all, orders, deliveries, messages, issues }`, `ageTone(at, now) → 'neutral'|'warn'|'bad'` (> 24h warn, > 72h bad).

- [ ] **Step 0: Tests first** (`inboxTabs.test.js`)

```js
it('maps issues to kyc and dispute tasks')
it('counts every tab from one task list')            // 2 order, 1 shipment, 1 kyc, 1 dispute → { all:5, orders:2, deliveries:1, messages:0, issues:2 }
it('unknown tab falls back to all')
it('ageTone is neutral ≤24h, warn >24h, bad >72h')
```
Run `cd web && npm test -- inboxTabs` → FAIL; implement; rerun → PASS.

- [ ] **Step 1: Queue view** — `FilterTabs` with counts from `tabCounts` over one unfiltered tasks fetch; rows filtered by `tasksForTab`, age tone from `ageTone`; rows: type label, title, account, age (`timeAgo`, coloured by tone tokens), chevron; row → `task.href`.
- [ ] **Step 2: Recent view** (toggle in header) — orders tab: order list with status filter; deliveries: shipments; messages: messages with unread-only switch; issues/all: queue only. Rows link to `href`.
- [ ] **Step 3: States** — empty queue: `EmptyState` "Inbox zero" / "Nothing waiting across your accounts"; errors inline.
- [ ] **Step 4: Verify** — build passes; tab and account selections survive reload (URL-synced).
- [ ] **Step 5: Commit** (if authorized) — `feat(manager): unified inbox`

---

### Task 8: Performance (`/manager/performance`)

**Files:**
- Create: `web/app/manager/performance/page.js`, `web/components/manager/RevenueTrend.js`

**Interfaces:**
- Consumes: `GET /manager/reports`, `GET /manager/reports/series` (Task 2), `GET /manager/money`.
- Produces: URL contract `?tab=overview|money&range=7d|30d|90d|custom&from&to&account`. `RevenueTrend({ series: Array<{date, revenue}> })` — recharts area/line, neutral stroke, axis in `--m-text-faint`, tooltip in `.m-card` style.

- [ ] **Step 1: Overview tab** — range control (7d/30d/90d/custom date inputs); `RevenueTrend`; comparison `DataTable`: account, orders, revenue, delivered % (`deliveredRate`), cancelled % (`cancelledRate`), default sort revenue desc; this table alone may scroll horizontally on phones with a sticky first column.
- [ ] **Step 2: Money tab** — `DataTable`: account, balance, pending withdrawals (count + amount), money access (`canManageMoney` → "Granted" / "Not granted"); `Open wallet` action only when granted (`href`).
- [ ] **Step 3: States + invalid range** — custom `from > to` shows inline validation and does not fetch; API 400 surfaces as `ErrorState`.
- [ ] **Step 4: Verify** — build passes; switching range updates chart and table.
- [ ] **Step 5: Commit** (if authorized) — `feat(manager): performance section`

---

### Task 9: Notes & Activity (`/manager/journal`)

**Files:**
- Create: `web/app/manager/journal/page.js`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /manager/notes`, `GET /manager/activity?account&category`.
- Produces: URL contract `?tab=notes|activity&account=<id>`.

- [ ] **Step 1: Notes tab** — composer (textarea ≤ 2000 chars with counter, optional account via `AccountPicker mode="filter"`, optional reminder `datetime-local`); list grouped **Due** (`remind_at ≤ now`, not done), **Upcoming**, **Done**; toggle done (optimistic, rollback on error), delete with confirm.
- [ ] **Step 2: Activity tab** — `DataTable`: time, account, category, action, fields; filters for account and category (`products|orders|messages|money|profile|other`).
- [ ] **Step 3: Verify** — build passes; create → toggle → delete round-trip works in dev.
- [ ] **Step 4: Commit** (if authorized) — `feat(manager): notes and activity`

---

### Task 10: Settings with invitations, legacy redirects

**Files:**
- Rewrite: `web/app/manager/settings/page.js`
- Create: `web/components/manager/InvitationsPanel.js`, `web/components/manager/LegacyRedirect.js`, `web/components/manager/legacyRoutes.js`
- Replace with stubs: `web/app/manager/{accounts,tasks,orders,shipments,messages,money,reports,notes,activity,invitations}/page.js`
- Test: `web/components/manager/legacyRoutes.test.js`

**Interfaces:**
- Consumes: `GET/PATCH /manager/settings`; `GET/POST /manager/invitations`, `POST /manager/invitations/:id/respond` (rows `{ id, direction, email, from, role, status, permissions, at }`).
- Produces: `LegacyRedirect({ to: string })` — client component calling `router.replace(to)` and rendering a skeleton. Map:
  `accounts → /manager`, `tasks → /manager/inbox`, `orders → /manager/inbox?tab=orders&view=recent`, `shipments → /manager/inbox?tab=deliveries&view=recent`, `messages → /manager/inbox?tab=messages&view=recent`, `money → /manager/performance?tab=money`, `reports → /manager/performance`, `notes → /manager/journal`, `activity → /manager/journal?tab=activity`, `invitations → /manager/settings#invitations`.

- [ ] **Step 1: Settings page** — profile summary (read-only name/email); three toggles saved immediately (PATCH single key, optimistic, rollback + inline error on failure).
- [ ] **Step 2: `InvitationsPanel`** (anchor `id="invitations"`) — Incoming (Accept/Decline), Sent (status), invite form (email + five permission checkboxes defaulting to products/orders/messages/profile on, money off); API error messages shown inline (e.g. 409 "already exists").
- [ ] **Step 3: Legacy stubs, tests first** — `legacyRoutes.test.js`: `LEGACY_ROUTES` has exactly the ten keys above with those targets, and every target starts with `/manager` and parses into a section in `MANAGER_SECTIONS` (Task 4). Run → FAIL; create `legacyRoutes.js` exporting the map; rerun → PASS. Then each old page becomes `<LegacyRedirect to={LEGACY_ROUTES.<key>} />`.
- [ ] **Step 4: Verify** — build passes; visiting each old URL lands on the mapped section/tab.
- [ ] **Step 5: Commit** (if authorized) — `feat(manager): settings, invitations and legacy redirects`

---

### Task 11: Final verification

**Files:** none new (fixes only, in the owning task's files).

- [ ] **Step 1: Backend** — `cd backend && npx vitest run --project integration tests/integration/manager.test.js` → all pass.
- [ ] **Step 2: Frontend tests and build** — `cd web && npm test` → all pass; `npx next build` → succeeds; no `material-symbols` in manager files: `grep -rn "material-symbols" web/app/manager web/components/manager` → no output.
- [ ] **Step 3: Visual pass** — run backend + `next dev`; with a manager that has vendor, logistics and customer accounts (and one with none), drive each of the five sections and one workspace per account type at 390px and 1440px in **light and dark**; check every Review Focus item; capture screenshots for the user.
- [ ] **Step 4: Report** — summarize results and any deviations to the user; commit only if authorized (message notes the superseded uncommitted polish edits).
