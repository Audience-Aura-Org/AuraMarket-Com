'use strict'
/**
 * Admin audit log: server-side category filter (old lowercase and new model-name
 * target types), paging and high-priority count.
 */
const request = require('supertest')
const mongoose = require('mongoose')
const { buildApp } = require('../setup/app')
const { createAdmin, createUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
const AuditLog = require('../../models/AuditLog.model')

let app
beforeAll(() => { app = buildApp() })

it('filters by category across old and new entries, pages, and counts high-priority events', async () => {
  const admin = await createAdmin()
  const id = () => new mongoose.Types.ObjectId()
  await AuditLog.create([
    { user_id: admin._id, action: 'user_ban', target_type: 'user', target_id: id() },
    { user_id: admin._id, action: 'role_change', target_type: 'User', target_id: id() },
    { user_id: admin._id, action: 'rider_cash_handover', target_type: 'RiderProfile', target_id: id(), changes: { old: { holding: 17000 }, new: { holding: 10000 } } },
    { user_id: admin._id, action: 'payment_settled', target_type: 'Transaction', target_id: id() },
    { user_id: admin._id, action: 'price_change', target_type: 'product', target_id: id() },
  ])
  const get = (q) => request(app).get('/api/v1/admin/audit').query(q).set(authHeader(signToken(admin)))

  const users = await get({ category: 'users' })
  expect(users.body.data.total).toBe(2)
  expect(users.body.data.high_priority).toBe(2) // ban + role change
  expect((await get({ category: 'deliveries' })).body.data.logs[0]).toMatchObject({ action: 'rider_cash_handover', changes: { new: { holding: 10000 } } })
  expect((await get({ category: 'payments' })).body.data.total).toBe(1)

  const paged = await get({ limit: 2, page: 2 })
  expect(paged.body.data).toMatchObject({ total: 5, page: 2, pages: 3 })
  expect(paged.body.data.logs).toHaveLength(2)

  expect((await request(app).get('/api/v1/admin/audit').set(authHeader(signToken(await createUser())))).status).toBe(403)
})
