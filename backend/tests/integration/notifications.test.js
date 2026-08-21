'use strict'
/**
 * tests/integration/notifications.test.js
 * Prompt 8 — Notification CRUD flows.
 *
 * Sections:
 *   1. GET  /notifications          — list own notifications + 401 guard
 *   2. PATCH /notifications/:id/read  — mark single as read + 404 guard
 *   3. PATCH /notifications/read-all  — bulk mark-read
 *   4. DELETE /notifications/:id      — delete own + 404 guard
 */

const request   = require('supertest')
const mongoose  = require('mongoose')

const { buildApp }          = require('../setup/app')
const { createUser }        = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const Notification = require('../../models/Notification.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let userA, userB

beforeEach(async () => {
  userA = await createUser()
  userB = await createUser()
})

// Helper: create a Notification for a given recipient
const makeNotification = (recipientId, overrides = {}) =>
  Notification.create({
    recipient: recipientId,
    title:     'Test notification',
    message:   'This is a test message.',
    type:      'system_alert',
    is_read:   false,
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /notifications — list own notifications
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /notifications — list own notifications', () => {
  it('returns only the authenticated user\'s notifications', async () => {
    await makeNotification(userA._id)
    await makeNotification(userA._id)
    await makeNotification(userB._id) // should NOT appear for userA

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(2)
    res.body.data.notifications.forEach(n => {
      expect(n.recipient.toString()).toBe(userA._id.toString())
    })
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/notifications')
    expect(res.status).toBe(401)
  })

  it('returns an empty array when the user has no notifications', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(0)
    expect(res.body.data.notifications).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /notifications/:id/read — mark one as read
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /notifications/:id/read — mark single notification as read', () => {
  it('marks own unread notification as read and returns updated doc', async () => {
    const notif = await makeNotification(userA._id, { is_read: false })

    const res = await request(app)
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.notification.is_read).toBe(true)
  })

  it('returns 404 when trying to mark another user\'s notification as read', async () => {
    const notif = await makeNotification(userB._id) // belongs to userB

    const res = await request(app)
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set(authHeader(signToken(userA))) // userA tries to mark it

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /notifications/read-all — mark all as read
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /notifications/read-all — bulk mark all as read', () => {
  it('marks all unread notifications as read and returns 200', async () => {
    await makeNotification(userA._id, { is_read: false })
    await makeNotification(userA._id, { is_read: false })

    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify they're actually marked read in DB
    const remaining = await Notification.find({ recipient: userA._id, is_read: false })
    expect(remaining).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE /notifications/:id — delete own notification
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /notifications/:id — delete a notification', () => {
  it('deletes own notification and returns 200', async () => {
    const notif = await makeNotification(userA._id)

    const res = await request(app)
      .delete(`/api/v1/notifications/${notif._id}`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const deleted = await Notification.findById(notif._id)
    expect(deleted).toBeNull()
  })

  it('returns 404 when trying to delete another user\'s notification', async () => {
    const notif = await makeNotification(userB._id)

    const res = await request(app)
      .delete(`/api/v1/notifications/${notif._id}`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(404)
  })
})
