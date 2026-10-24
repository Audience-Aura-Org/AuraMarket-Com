'use strict'
/**
 * tests/integration/manager.test.js
 * Manager role — delegated account management (Google Ads MCC / Facebook
 * Business Manager style).
 *
 *   1. Manager space (/manager/*) — cross-account data is correct and scoped
 *   2. Workspace delegation (X-Act-As) — every router runs as the target,
 *      with permission categories, deny list, and audit log enforced
 *   3. No admin powers — a manager without X-Act-As is not an admin
 *   4. Assignment lifecycle — invites, transfer, promotion
 */

const request  = require('supertest')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }               = require('../setup/app')
const { createUser, createAdmin, createVendor,
        createProductForVendor } = require('../factories')
const { asUser }                 = require('../helpers/auth')

const User              = require('../../models/User.model')
const Order             = require('../../models/Order.model')
const Product           = require('../../models/Product.model')
const Shipment          = require('../../models/Shipment.model')
const Dispute           = require('../../models/Dispute.model')
const Message           = require('../../models/Message.model')
const LogisticsCompany  = require('../../models/LogisticsCompany.model')
const ManagerAssignment = require('../../models/ManagerAssignment.model')
const ActivityLog       = require('../../models/ActivityLog.model')
const WithdrawalRequest = require('../../models/WithdrawalRequest.model')

let app
beforeAll(() => { app = buildApp() }, 120000)

describe('Original account after manager conversion', () => {
  it('exposes the original account as an owned workspace without copying its identity', async () => {
    const manager = await createUser({ role: 'manager', previous_role: 'vendor' });
    const accounts = await request(app).get('/api/v1/manager/accounts').set(asUser(manager)).expect(200);
    expect(accounts.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: String(manager._id), role: 'vendor', owned: true })]));
    const session = await request(app).get(`/api/v1/manager/accounts/${manager._id}/session`).set(asUser(manager)).expect(200);
    expect(session.body.data.user.role).toBe('vendor');
    const own = await request(app).get('/api/v1/auth/me').set(asUser(manager)).set('X-Act-As', String(manager._id)).expect(200);
    expect(own.body.data.user._id).toBe(String(manager._id));
    expect(own.body.data.user.role).toBe('vendor');
    expect((await User.findById(manager._id)).role).toBe('manager');
    await request(app).get('/api/v1/admin/dashboard').set(asUser(manager)).set('X-Act-As', String(manager._id)).expect(403);
  });
  it('never exposes another managers original workspace', async () => {
    const manager = await createUser({ role: 'manager', previous_role: 'vendor' });
    const other = await createUser({ role: 'manager', previous_role: 'vendor' });
    await request(app).get(`/api/v1/manager/accounts/${other._id}/session`).set(asUser(manager)).expect(404);
    await request(app).get('/api/v1/chat').set(asUser(manager)).set('X-Act-As', String(other._id)).expect(404);
  });
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const ALL_PERMS = { products: true, orders: true, messages: true, money: true, profile: true }

const createManager = (overrides = {}) => createUser({ role: 'manager', ...overrides })

const assign = (manager, user, overrides = {}) =>
  ManagerAssignment.create({
    manager_id:   manager._id,
    user_id:      user._id,
    status:       'active',
    initiated_by: 'admin',
    permissions:  ALL_PERMS,
    ...overrides,
  })

const makeOrder = (customer, vendor, overrides = {}) =>
  Order.create({
    customer_id:    customer._id,
    vendor_id:      vendor._id,
    products: [{
      product_id: new mongoose.Types.ObjectId(),
      name: 'Item', quantity: 1, price: 1000, regular_price: 1000,
    }],
    subtotal:       1000,
    shipping_fee:   0,
    total_amount:   1000,
    payment_method: 'wallet',
    // Wallet orders are paid at checkout; unpaid orders never count as revenue.
    payment_status: 'paid',
    ...overrides,
  })

const makeLogistics = async () => {
  const user = await createUser({ role: 'logistics' })
  const firm = await LogisticsCompany.create({
    user_id:       user._id,
    company_name:  faker.company.name(),
    contact_email: faker.internet.email().toLowerCase(),
    contact_phone: '+237600000000',
  })
  return { user, firm }
}

/** Manager with an assigned vendor (+store) and a customer with an order. */
const setup = async (perms = ALL_PERMS) => {
  const manager  = await createManager()
  const { user: vendorUser, vendor } = await createVendor({ user: { onboarded: true } })
  const customer = await createUser()
  await assign(manager, vendorUser, { permissions: perms })
  return { manager, vendorUser, vendor, customer }
}

describe('managed account messaging', () => {
  it('reads and replies as the assigned account while preserving the manager inbox', async () => {
    const {manager,vendorUser,customer}=await setup()
    await Message.create({sender_id:customer._id,receiver_id:vendorUser._id,text:'Managed account question'})
    const act=r=>r.set(asUser(manager)).set('X-Act-As',String(vendorUser._id))
    const inbox=await act(request(app).get('/api/v1/chat')).expect(200)
    expect(inbox.body.data.activeChats[0].partner._id).toBe(String(customer._id))
    await request(app).get('/api/v1/chat').set(asUser(manager)).expect(200).then(res=>expect(res.body.data.activeChats).toHaveLength(0))
    const body={receiver_id:String(customer._id),text:'Reply from the managed account',client_id:'managed-reply-once'}
    await act(request(app).post('/api/v1/chat').send(body)).expect(201)
    await act(request(app).post('/api/v1/chat').send(body)).expect(201)
    expect(await Message.countDocuments({sender_id:vendorUser._id,text:body.text})).toBe(1)
    expect(await Message.countDocuments({sender_id:manager._id})).toBe(0)
    await vi.waitFor(async()=>expect(await ActivityLog.countDocuments({manager_id:manager._id,user_id:vendorUser._id,category:'messages',method:'POST'})).toBeGreaterThan(0))
  })
  it('denies inbox access and sending without the messages permission', async () => {
    const {manager,vendorUser,customer}=await setup({...ALL_PERMS,messages:false})
    const act=r=>r.set(asUser(manager)).set('X-Act-As',String(vendorUser._id))
    await act(request(app).get('/api/v1/chat')).expect(403)
    await act(request(app).post('/api/v1/chat').send({receiver_id:String(customer._id),text:'Denied'})).expect(403)
    expect(await Message.countDocuments()).toBe(0)
  })
  it('denies messages immediately when the assignment is revoked', async () => {
    const {manager,vendorUser}=await setup()
    await ManagerAssignment.updateOne({manager_id:manager._id,user_id:vendorUser._id},{$set:{status:'revoked'}})
    await request(app).get('/api/v1/chat').set(asUser(manager)).set('X-Act-As',String(vendorUser._id)).expect(404)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 1. Manager space
// ═════════════════════════════════════════════════════════════════════════════

describe('Manager space — access', () => {
  it('rejects non-managers', async () => {
    const vendor = await createUser({ role: 'vendor' })
    const admin  = await createAdmin()
    await request(app).get('/api/v1/manager/overview').set(asUser(vendor)).expect(403)
    await request(app).get('/api/v1/manager/overview').set(asUser(admin)).expect(403)
  })

  it('lists only active, unexpired, manageable accounts', async () => {
    const manager = await createManager()
    const active  = await createUser()
    const expired = await createUser()
    const revoked = await createUser()
    const deactivated = await createUser({ is_active: false })
    await assign(manager, active)
    await assign(manager, expired, { expires_at: new Date(Date.now() - 1000) })
    await assign(manager, revoked, { status: 'revoked' })
    await assign(manager, deactivated)

    const res = await request(app).get('/api/v1/manager/accounts').set(asUser(manager)).expect(200)
    expect(res.body.data.map((a) => a.id)).toEqual([String(active._id)])
  })
})

describe('Manager space — overview & tasks', () => {
  it('counts new (placed) orders and open disputes as tasks', async () => {
    const { manager, vendorUser, vendor, customer } = await setup()
    const customerAcct = await createUser()
    await assign(manager, customerAcct)

    const order = await makeOrder(customer, vendor) // default order_status: placed
    await makeOrder(customer, vendor, { order_status: 'delivered' })
    await Dispute.create({
      order_id: order._id, initiator_id: customerAcct._id,
      reason: 'item_not_received', description: 'Never came',
    })

    const res = await request(app).get('/api/v1/manager/overview').set(asUser(manager)).expect(200)
    expect(res.body.data.byType.order).toBe(1)
    expect(res.body.data.byType.dispute).toBe(1)
    expect(res.body.data.totals.tasks).toBe(2)

    const tasks = await request(app).get('/api/v1/manager/tasks').set(asUser(manager)).expect(200)
    const orderTask = tasks.body.data.find((t) => t.type === 'order')
    expect(orderTask.userId).toBe(String(vendorUser._id))
    expect(orderTask.href).toBe(`/manager/as/${vendorUser._id}/orders`)
  })

  it('excludes cancelled/refunded orders from revenue', async () => {
    const { manager, vendor, customer } = await setup()
    await makeOrder(customer, vendor, { total_amount: 5000, order_status: 'completed' })
    await makeOrder(customer, vendor, { total_amount: 7000, order_status: 'cancelled' })
    await makeOrder(customer, vendor, { total_amount: 9000, order_status: 'refunded' })

    const res = await request(app).get('/api/v1/manager/overview').set(asUser(manager)).expect(200)
    expect(res.body.data.totals.orders30d).toBe(3)
    expect(res.body.data.totals.revenue30d).toBe(5000)
  })

  it('links waiting shipments to the logistics manifests page', async () => {
    const manager = await createManager()
    const { user, firm } = await makeLogistics()
    await assign(manager, user)
    await Shipment.create({
      vendor_id: new mongoose.Types.ObjectId(), logistics_id: firm._id,
      tracking_code: `AURA-${Date.now()}`, price: 1500,
    })

    const res = await request(app).get('/api/v1/manager/tasks').set(asUser(manager)).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].href).toBe(`/manager/as/${user._id}/manifests`)

    const ships = await request(app)
      .get(`/api/v1/manager/shipments?account=${user._id}`).set(asUser(manager)).expect(200)
    expect(ships.body.data).toHaveLength(1)
  })
})

describe('Accounts metrics', () => {
  const HOUR = 3600 * 1000
  const rowFor = (res, user) => res.body.data.find((a) => a.id === String(user._id))

  it('returns 30-day revenue/orders, balance and pending withdrawals per vendor', async () => {
    const { manager, vendorUser, vendor, customer } = await setup()
    await User.updateOne({ _id: vendorUser._id }, { wallet_balance: 25000 })
    await makeOrder(customer, vendor, { total_amount: 5000, order_status: 'completed' })
    await makeOrder(customer, vendor, { total_amount: 7000, order_status: 'cancelled' })
    await makeOrder(customer, vendor, {
      total_amount: 9000, order_status: 'completed', createdAt: new Date(Date.now() - 40 * 24 * HOUR),
    })
    await WithdrawalRequest.create({
      requested_by: vendorUser._id, role: 'vendor', amount: 3000, withdrawal_method: 'momo',
      recipient_details: { first_name: 'A', last_name: 'B', country: 'CM', phone_number: '+237600000000' },
    })

    const res = await request(app).get('/api/v1/manager/accounts').set(asUser(manager)).expect(200)
    expect(rowFor(res, vendorUser)).toMatchObject({
      revenue30d: 5000, orders30d: 2, balance: 25000, pendingWithdrawals: 1,
    })
  })

  it('computes logistics revenue from shipments and zero for customers', async () => {
    const manager = await createManager()
    const { user: logisticsUser, firm } = await makeLogistics()
    const customer = await createUser()
    await assign(manager, logisticsUser)
    await assign(manager, customer)
    const ship = (price, status) => Shipment.create({
      vendor_id: new mongoose.Types.ObjectId(), logistics_id: firm._id,
      tracking_code: `AURA-${faker.string.alphanumeric(8)}`, price, status,
    })
    await ship(1500, 'delivered')
    await ship(2000, 'cancelled')

    const res = await request(app).get('/api/v1/manager/accounts').set(asUser(manager)).expect(200)
    expect(rowFor(res, logisticsUser)).toMatchObject({ revenue30d: 1500, orders30d: 2 })
    expect(rowFor(res, customer)).toMatchObject({ revenue30d: 0, orders30d: 0, balance: 0, pendingWithdrawals: 0 })
  })

  it('derives health: urgent for >24h task or dispute, attention for any task, ok otherwise', async () => {
    const manager = await createManager()
    const accounts = await Promise.all([0, 1, 2].map(() => createVendor({ user: { onboarded: true } })))
    const [a, b, c] = accounts
    const d = await createUser()
    const customer = await createUser()
    for (const acct of [a.user, b.user, c.user, d]) await assign(manager, acct)

    await makeOrder(customer, a.vendor, { createdAt: new Date(Date.now() - 25 * HOUR) })
    await makeOrder(customer, b.vendor, { createdAt: new Date(Date.now() - 1 * HOUR) })
    const order = await makeOrder(customer, c.vendor, { order_status: 'completed' })
    await Dispute.create({
      order_id: order._id, initiator_id: d._id, reason: 'item_not_received', description: 'x',
    })

    const res = await request(app).get('/api/v1/manager/accounts').set(asUser(manager)).expect(200)
    expect(rowFor(res, a.user).health).toBe('urgent')
    expect(rowFor(res, b.user).health).toBe('attention')
    expect(rowFor(res, c.user).health).toBe('ok')
    expect(rowFor(res, d).health).toBe('urgent')
  })
})

describe('Overview deltas, trend and report series', () => {
  const DAY = 864e5

  it('overview returns previous-period totals and a 30-day zero-filled trend', async () => {
    const { manager, vendor, customer } = await setup()
    await makeOrder(customer, vendor, { total_amount: 5000, order_status: 'completed' })
    await makeOrder(customer, vendor, {
      total_amount: 2000, order_status: 'completed', createdAt: new Date(Date.now() - 40 * DAY),
    })

    const res = await request(app).get('/api/v1/manager/overview').set(asUser(manager)).expect(200)
    const { previous, trend } = res.body.data
    expect(previous).toEqual({ orders30d: 1, revenue30d: 2000 })
    expect(trend).toHaveLength(30)
    expect(trend.at(-1)).toEqual({ date: new Date().toISOString().slice(0, 10), revenue: 5000 })
    expect(trend[0].revenue).toBe(0)
  })

  it('overview with no accounts returns zero totals and null-safe previous', async () => {
    const manager = await createManager()
    const res = await request(app).get('/api/v1/manager/overview').set(asUser(manager)).expect(200)
    expect(res.body.data.totals.accounts).toBe(0)
    expect(res.body.data.previous).toEqual({ orders30d: 0, revenue30d: 0 })
    expect(res.body.data.trend).toHaveLength(30)
  })

  it('reports include delivered and cancelled rates', async () => {
    const { manager, vendor, customer } = await setup()
    await makeOrder(customer, vendor, { order_status: 'completed' })
    await makeOrder(customer, vendor, { order_status: 'cancelled' })
    const res = await request(app).get('/api/v1/manager/reports').set(asUser(manager)).expect(200)
    expect(res.body.data[0]).toMatchObject({ deliveredRate: 0.5, cancelledRate: 0.5 })
  })

  it('report series is zero-filled per day and validates the range', async () => {
    const { manager, vendor, customer } = await setup()
    await makeOrder(customer, vendor, {
      total_amount: 3000, order_status: 'completed', createdAt: new Date('2026-01-02T10:00:00Z'),
    })

    const res = await request(app)
      .get('/api/v1/manager/reports/series?from=2026-01-01&to=2026-01-03').set(asUser(manager)).expect(200)
    expect(res.body.data).toEqual([
      { date: '2026-01-01', revenue: 0, orders: 0 },
      { date: '2026-01-02', revenue: 3000, orders: 1 },
      { date: '2026-01-03', revenue: 0, orders: 0 },
    ])

    await request(app)
      .get('/api/v1/manager/reports/series?from=2025-01-01&to=2026-06-01').set(asUser(manager)).expect(400)
    await request(app)
      .get('/api/v1/manager/reports/series?from=nope').set(asUser(manager)).expect(400)
  })
})

describe('Manager space — reports', () => {
  it('rejects an invalid date range with 400 instead of 500', async () => {
    const manager = await createManager()
    await request(app).get('/api/v1/manager/reports?from=garbage').set(asUser(manager)).expect(400)
    await request(app)
      .get('/api/v1/manager/reports?from=2026-02-01&to=2026-01-01').set(asUser(manager)).expect(400)
  })

  it('reports per-account revenue and counts completed as delivered', async () => {
    const { manager, vendorUser, vendor, customer } = await setup()
    await makeOrder(customer, vendor, { total_amount: 4000, order_status: 'completed' })
    await makeOrder(customer, vendor, { total_amount: 2000, order_status: 'cancelled' })

    const res = await request(app).get('/api/v1/manager/reports').set(asUser(manager)).expect(200)
    expect(res.body.data).toEqual([expect.objectContaining({
      userId: String(vendorUser._id), orders: 2, revenue: 4000, delivered: 1, cancelled: 1,
    })])
  })
})

describe('Manager space — notes', () => {
  it('creates, updates, filters, and deletes notes', async () => {
    const { manager, vendorUser } = await setup()
    const created = await request(app)
      .post('/api/v1/manager/notes').set(asUser(manager))
      .send({ body: '  Call vendor  ', user_id: String(vendorUser._id) })
      .expect(200)
    expect(created.body.data.body).toBe('Call vendor')
    const id = created.body.data._id

    await request(app).patch(`/api/v1/manager/notes/${id}`).set(asUser(manager))
      .send({ done: true }).expect(200)
    const list = await request(app)
      .get(`/api/v1/manager/notes?account=${vendorUser._id}`).set(asUser(manager)).expect(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0].done).toBe(true)

    await request(app).delete(`/api/v1/manager/notes/${id}`).set(asUser(manager)).expect(200)
  })

  it('validates input and scope', async () => {
    const manager  = await createManager()
    const stranger = await createUser()
    await request(app).post('/api/v1/manager/notes').set(asUser(manager)).send({ body: '   ' }).expect(400)
    await request(app).post('/api/v1/manager/notes').set(asUser(manager))
      .send({ body: 'x', user_id: String(stranger._id) }).expect(404)
    await request(app).post('/api/v1/manager/notes').set(asUser(manager))
      .send({ body: 'x', remind_at: 'not-a-date' }).expect(400)
    await request(app).get('/api/v1/manager/notes?account=bad-id').set(asUser(manager)).expect(200)
  })

  it('cannot touch another manager\'s notes', async () => {
    const a = await createManager()
    const b = await createManager()
    const note = await request(app).post('/api/v1/manager/notes').set(asUser(a)).send({ body: 'mine' })
    await request(app).patch(`/api/v1/manager/notes/${note.body.data._id}`).set(asUser(b))
      .send({ done: true }).expect(404)
  })
})

describe('Manager space — settings', () => {
  it('persists notification preferences', async () => {
    const manager = await createManager()
    await request(app).patch('/api/v1/manager/settings').set(asUser(manager))
      .send({ notify_email: false, daily_digest: true }).expect(200)

    const res = await request(app).get('/api/v1/manager/settings').set(asUser(manager)).expect(200)
    expect(res.body.data).toMatchObject({ notify_email: false, notify_push: true, daily_digest: true })
  })
})

describe('Manager space — account session', () => {
  it('returns the assigned user profile for the workspace', async () => {
    const { manager, vendorUser } = await setup()
    const res = await request(app)
      .get(`/api/v1/manager/accounts/${vendorUser._id}/session`).set(asUser(manager)).expect(200)
    expect(res.body.data.user._id).toBe(String(vendorUser._id))
    expect(res.body.data.user.role).toBe('vendor')
    expect(res.body.data.user.password).toBeUndefined()
    expect(res.body.data.permissions.money).toBe(true)
  })

  it('404s for an unassigned or malformed account', async () => {
    const manager  = await createManager()
    const stranger = await createUser()
    await request(app).get(`/api/v1/manager/accounts/${stranger._id}/session`).set(asUser(manager)).expect(404)
    await request(app).get('/api/v1/manager/accounts/nope/session').set(asUser(manager)).expect(404)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. Workspace delegation (X-Act-As)
// ═════════════════════════════════════════════════════════════════════════════

describe('Act-as — identity swap', () => {
  it('runs as the target on any router (e.g. /auth/me)', async () => {
    const { manager, vendorUser } = await setup()
    const res = await request(app).get('/api/v1/auth/me')
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id)).expect(200)
    expect(res.body.data.user._id).toBe(String(vendorUser._id))
  })

  it('works on the /api mount as well as /api/v1', async () => {
    const { manager, vendorUser } = await setup()
    const res = await request(app).get('/api/auth/me')
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id)).expect(200)
    expect(res.body.data.user._id).toBe(String(vendorUser._id))
  })

  it('lists the vendor\'s products as the vendor', async () => {
    const { manager, vendorUser, vendor } = await setup()
    await createProductForVendor(vendor._id)
    const res = await request(app).get('/api/v1/vendor/products')
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id)).expect(200)
    expect(JSON.stringify(res.body)).toContain(String(vendor._id))
  })

  it('performs writes on routers that previously ignored X-Act-As and logs them', async () => {
    const { manager, vendorUser, vendor } = await setup()
    const product = await createProductForVendor(vendor._id)

    await request(app).delete(`/api/v1/products/${product._id}`)
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id)).expect(200)

    expect((await Product.findById(product._id)).status).toBe('archived')
    // the response 'finish' hook writes the log asynchronously
    await new Promise((r) => setTimeout(r, 200))
    const log = await ActivityLog.findOne({ manager_id: manager._id })
    expect(log).toMatchObject({ category: 'products', method: 'DELETE' })
    expect(String(log.user_id)).toBe(String(vendorUser._id))
  })

  it('switches between accounts with one token and never mixes their data', async () => {
    const { manager, vendorUser: userA, vendor: vendorA } = await setup()
    const { user: userB, vendor: vendorB } = await createVendor({ user: { onboarded: true } })
    await assign(manager, userB)
    const productA = await createProductForVendor(vendorA._id)
    const productB = await createProductForVendor(vendorB._id)
    const token = asUser(manager)

    for (const [user, mine, theirs] of [
      [userA, productA, productB], [userB, productB, productA], [userA, productA, productB],
    ]) {
      const res = await request(app).get('/api/v1/vendor/products')
        .set(token).set('X-Act-As', String(user._id)).expect(200)
      const body = JSON.stringify(res.body)
      expect(body).toContain(String(mine._id))
      expect(body).not.toContain(String(theirs._id))
    }

    // Back in the manager's own space with the same token
    const own = await request(app).get('/api/v1/auth/me').set(token).expect(200)
    expect(own.body.data.user._id).toBe(String(manager._id))
  })

  it('leaves the manager\'s own space running as the manager', async () => {
    const { manager, vendorUser } = await setup()
    const res = await request(app).get('/api/v1/manager/accounts')
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id)).expect(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('ignores the header for non-managers', async () => {
    const customer = await createUser()
    const victim   = await createUser()
    const res = await request(app).get('/api/v1/auth/me')
      .set(asUser(customer)).set('X-Act-As', String(victim._id)).expect(200)
    expect(res.body.data.user._id).toBe(String(customer._id))
  })

  it('does not crash public routes or bypass auth without a token', async () => {
    const victim = await createUser()
    await request(app).get('/api/v1/products').set('X-Act-As', String(victim._id)).expect(200)
    await request(app).get('/api/v1/auth/me').set('X-Act-As', String(victim._id)).expect(401)
  })
})

describe('Act-as — enforcement', () => {
  it('404s for unassigned, expired, or malformed targets', async () => {
    const manager  = await createManager()
    const stranger = await createUser()
    const expired  = await createUser()
    await assign(manager, expired, { expires_at: new Date(Date.now() - 1000) })

    for (const id of [String(stranger._id), String(expired._id), 'not-an-id']) {
      const res = await request(app).get('/api/v1/auth/me').set(asUser(manager)).set('X-Act-As', id).expect(404)
      // the web client keys "access lost → leave workspace" on this code
      expect(res.body.code).toBe('ASSIGNMENT_NOT_FOUND')
    }
  })

  it('enforces permission categories (reads and writes)', async () => {
    const { manager, vendorUser, vendor } = await setup({ ...ALL_PERMS, money: false, products: false })
    const product = await createProductForVendor(vendor._id)
    const act = (r) => r.set(asUser(manager)).set('X-Act-As', String(vendorUser._id))

    await act(request(app).get('/api/v1/wallet')).expect(403)
    await act(request(app).delete(`/api/v1/products/${product._id}`)).expect(403)
    expect((await Product.findById(product._id)).status).not.toBe('archived')
  })

  it('blocks uncategorized writes and sensitive paths', async () => {
    const { manager, vendorUser } = await setup()
    const act = (r) => r.set(asUser(manager)).set('X-Act-As', String(vendorUser._id))

    await act(request(app).patch('/api/v1/users/me').send({ name: 'Hacked' })).expect(403)
    await act(request(app).post('/api/v1/auth/delete-account').send({ confirmText: 'DELETE' })).expect(403)
    await act(request(app).get('/api/v1/security/sessions')).expect(403)
    await act(request(app).get('/api/v1/admin/my-managers')).expect(403)
    expect((await User.findById(vendorUser._id)).name).not.toBe('Hacked')
  })

  it('stops working the moment access is revoked mid-session', async () => {
    const { manager, vendorUser } = await setup()
    const act = () => request(app).get('/api/v1/auth/me')
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id))
    await act().expect(200)
    await request(app).post(`/api/v1/admin/my-managers/${(await ManagerAssignment.findOne({ user_id: vendorUser._id }))._id}/revoke`)
      .set(asUser(vendorUser)).expect(200)
    const res = await act().expect(404)
    expect(res.body.code).toBe('ASSIGNMENT_NOT_FOUND')
  })

  it('rejects act-as with an invalidated manager token (logged out elsewhere)', async () => {
    const { manager, vendorUser } = await setup()
    const header = asUser(manager)
    await User.updateOne({ _id: manager._id }, { $inc: { token_version: 1 } })
    const res = await request(app).get('/api/v1/auth/me')
      .set(header).set('X-Act-As', String(vendorUser._id)).expect(401)
    expect(res.body.message).toMatch(/session is no longer valid/i)
  })

  it('refuses to act as an account that became a manager', async () => {
    const { manager, vendorUser } = await setup()
    await User.updateOne({ _id: vendorUser._id }, { role: 'manager' })
    await request(app).get('/api/v1/auth/me')
      .set(asUser(manager)).set('X-Act-As', String(vendorUser._id)).expect(404)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. A manager is not an admin
// ═════════════════════════════════════════════════════════════════════════════

describe('No admin powers without act-as', () => {
  it('cannot use admin-only endpoints', async () => {
    const manager = await createManager()
    await request(app).get('/api/v1/chat/admin/all').set(asUser(manager)).expect(403)
    await request(app).get('/api/v1/reviews/admin').set(asUser(manager)).expect(403)
    await request(app).post('/api/v1/categories').set(asUser(manager)).send({ name: 'X' }).expect(403)
    await request(app).get('/api/v1/subscriptions/admin/overview').set(asUser(manager)).expect(403)
    await request(app).get('/api/v1/admin/users').set(asUser(manager)).expect(403)
  })

  it('cannot read or change orders it is not a party to', async () => {
    const manager  = await createManager()
    const customer = await createUser()
    const { vendor } = await createVendor()
    const order = await makeOrder(customer, vendor)

    await request(app).get(`/api/v1/orders/${order._id}`).set(asUser(manager)).expect(403)
    await request(app).patch(`/api/v1/orders/${order._id}/status`).set(asUser(manager))
      .send({ status: 'processing' }).expect(403)
    await request(app).post(`/api/v1/escrow/release/${order._id}`).set(asUser(manager)).expect(403)
    expect((await Order.findById(order._id)).order_status).toBe('placed')
  })

  it('does not see every order thread on the platform', async () => {
    const manager  = await createManager()
    const customer = await createUser()
    const { vendor } = await createVendor()
    await makeOrder(customer, vendor)

    const res = await request(app).get('/api/v1/messages/order-threads/mine').set(asUser(manager))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain(String(customer._id))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. Assignment lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe('Assignment lifecycle', () => {
  it('user invite → manager accepts → account appears in scope', async () => {
    const manager = await createManager()
    const user    = await createUser()

    await request(app).post('/api/v1/admin/my-managers/invite').set(asUser(user))
      .send({ email: manager.email }).expect(200)
    const inv = await request(app).get('/api/v1/manager/invitations').set(asUser(manager)).expect(200)
    expect(inv.body.data).toEqual([expect.objectContaining({
      direction: 'incoming', email: user.email, status: 'pending',
    })])

    await request(app).post(`/api/v1/manager/invitations/${inv.body.data[0].id}/respond`)
      .set(asUser(manager)).send({ accept: true }).expect(200)
    const accts = await request(app).get('/api/v1/manager/accounts').set(asUser(manager)).expect(200)
    expect(accts.body.data.map((a) => a.id)).toEqual([String(user._id)])
  })

  it('manager invite → user accepts; permissions are sanitised', async () => {
    const manager = await createManager()
    const user    = await createUser()
    await request(app).post('/api/v1/manager/invitations').set(asUser(manager))
      .send({ email: user.email, permissions: { money: true, hacker: true, orders: 'yes' } }).expect(200)

    const link = await ManagerAssignment.findOne({ manager_id: manager._id }).lean()
    expect(link.permissions).toEqual({ products: true, orders: true, messages: true, money: true, profile: true })
    expect(link.permissions.hacker).toBeUndefined()

    await request(app).post(`/api/v1/admin/invites/${link._id}/respond`).set(asUser(user))
      .send({ accept: true }).expect(200)
    expect((await ManagerAssignment.findById(link._id)).status).toBe('active')
  })

  it('managers and admins cannot invite a manager onto themselves', async () => {
    const manager = await createManager()
    const other   = await createManager()
    await request(app).post('/api/v1/admin/my-managers/invite').set(asUser(other))
      .send({ email: manager.email }).expect(403)
  })

  it('transfers accounts between managers and keeps expiry', async () => {
    const admin = await createAdmin()
    const from  = await createManager()
    const to    = await createManager()
    const user  = await createUser()
    const expires = new Date(Date.now() + 864e5)
    await assign(from, user, { expires_at: expires })

    const res = await request(app).post('/api/v1/admin/assignments/transfer').set(asUser(admin))
      .send({ fromManagerId: String(from._id), toManagerId: String(to._id) }).expect(200)
    expect(res.body.data.transferred).toBe(1)

    const fromAccts = await request(app).get('/api/v1/manager/accounts').set(asUser(from)).expect(200)
    const toAccts   = await request(app).get('/api/v1/manager/accounts').set(asUser(to)).expect(200)
    expect(fromAccts.body.data).toHaveLength(0)
    expect(toAccts.body.data).toHaveLength(1)
    expect(new Date(toAccts.body.data[0].expires_at).getTime()).toBe(expires.getTime())

    await request(app).post('/api/v1/admin/assignments/transfer').set(asUser(admin))
      .send({ fromManagerId: 'x', toManagerId: String(to._id) }).expect(400)
  })

  it('promoting a managed logistics user works and ends their managed links', async () => {
    const admin   = await createAdmin()
    const manager = await createManager()
    const { user } = await makeLogistics()
    await assign(manager, user)

    await request(app).post(`/api/v1/admin/managers/${user._id}/promote`).set(asUser(admin))
      .send({}).expect(200)
    expect((await User.findById(user._id)).role).toBe('manager')
    expect(await ManagerAssignment.countDocuments({ user_id: user._id })).toBe(0)
  })
})
