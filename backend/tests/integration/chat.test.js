'use strict'
/**
 * tests/integration/chat.test.js
 * Prompt 10 — Chat/messaging flows: send, inbox, conversation, mark-read, delete.
 *
 * Sections:
 *   1. POST /chat               — send a message
 *   2. GET  /chat               — user inbox (distinct conversations)
 *   3. GET  /chat/:userId       — conversation thread between two users
 *   4. PATCH /chat/read/:userId — mark all messages from a user as read
 *   5. DELETE /chat/message/:id — delete a message (for me / for everyone)
 *   6. GET  /chat/admin/all     — admin view (access control)
 */

const request   = require('supertest')
const mongoose  = require('mongoose')

const { buildApp }              = require('../setup/app')
const { createUser, createAdmin } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const Message = require('../../models/Message.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let userA, userB, admin

beforeEach(async () => {
  userA = await createUser()
  userB = await createUser()
  admin = await createAdmin()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

/** Create a message directly in DB using correct model field names. */
const makeMessage = (senderId, receiverId, overrides = {}) =>
  Message.create({
    sender_id:    senderId,
    receiver_id:  receiverId,
    text:         'Hello from test!',
    read_status:  false,
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /chat — send a message
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /chat — send a message', () => {
  it('sends a text message and returns 201 with the message object', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set(authHeader(signToken(userA)))
      .send({ receiver_id: userB._id, text: 'Hey there!' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.message.text).toBe('Hey there!')
    expect(res.body.data.message.sender_id._id.toString()).toBe(userA._id.toString())
  })

  it('returns 400 when receiver_id is missing', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set(authHeader(signToken(userA)))
      .send({ text: 'No receiver!' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ receiver_id: userB._id, text: 'Hello' })

    expect(res.status).toBe(401)
  })

  it('is idempotent — duplicate client_id returns the same message', async () => {
    const clientId = new mongoose.Types.ObjectId().toString()

    const res1 = await request(app)
      .post('/api/v1/chat')
      .set(authHeader(signToken(userA)))
      .send({ receiver_id: userB._id, text: 'First send', client_id: clientId })

    const res2 = await request(app)
      .post('/api/v1/chat')
      .set(authHeader(signToken(userA)))
      .send({ receiver_id: userB._id, text: 'Retry send', client_id: clientId })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    // Both should refer to the same message document
    expect(res1.body.data.message._id).toBe(res2.body.data.message._id)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /chat — user inbox
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /chat — user inbox (distinct conversations)', () => {
  it('returns an empty inbox when the user has no messages', async () => {
    const res = await request(app)
      .get('/api/v1/chat')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.activeChats).toHaveLength(0)
  })

  it('returns one conversation entry after a message is sent', async () => {
    await makeMessage(userA._id, userB._id)

    const res = await request(app)
      .get('/api/v1/chat')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.data.activeChats).toHaveLength(1)
  })

  it('deduplicates — multiple messages with the same partner appear as one conversation', async () => {
    await makeMessage(userA._id, userB._id, { text: 'First' })
    await makeMessage(userA._id, userB._id, { text: 'Second' })
    await makeMessage(userB._id, userA._id, { text: 'Reply' })

    const res = await request(app)
      .get('/api/v1/chat')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.data.activeChats).toHaveLength(1)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/chat')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /chat/:userId — conversation thread
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /chat/:userId — conversation thread', () => {
  it('returns messages between two users in chronological order', async () => {
    await makeMessage(userA._id, userB._id, { text: 'Msg 1' })
    await makeMessage(userB._id, userA._id, { text: 'Msg 2' })

    const res = await request(app)
      .get(`/api/v1/chat/${userB._id}`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.messages).toHaveLength(2)
    expect(res.body.data.total).toBe(2)
  })

  it('returns an empty thread between users with no prior messages', async () => {
    const res = await request(app)
      .get(`/api/v1/chat/${userB._id}`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.data.messages).toHaveLength(0)
  })

  it('does not include messages from a third-party conversation', async () => {
    const userC = await createUser()
    await makeMessage(userA._id, userC._id, { text: 'Private to C' })

    const res = await request(app)
      .get(`/api/v1/chat/${userB._id}`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.data.messages).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get(`/api/v1/chat/${userB._id}`)
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /chat/read/:userId — mark as read
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /chat/read/:userId — mark messages from a user as read', () => {
  it('marks unread messages as read and returns 200', async () => {
    // userB sends messages to userA (unread)
    await makeMessage(userB._id, userA._id, { read_status: false })
    await makeMessage(userB._id, userA._id, { read_status: false })

    // userA marks userB's messages as read
    const res = await request(app)
      .patch(`/api/v1/chat/read/${userB._id}`)
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify in DB
    const unread = await Message.countDocuments({
      sender_id: userB._id,
      receiver_id: userA._id,
      read_status: false,
    })
    expect(unread).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /chat/message/:id — delete message
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /chat/message/:id — delete a message', () => {
  it('deletes a message "for me" — hides it from the requester only', async () => {
    const msg = await makeMessage(userA._id, userB._id)

    const res = await request(app)
      .delete(`/api/v1/chat/message/${msg._id}`)
      .set(authHeader(signToken(userA)))
      .send({ type: 'me' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Message still exists in DB but is soft-deleted for userA
    const still = await Message.findById(msg._id)
    expect(still).not.toBeNull()
    expect(still.deleted_for.map(id => id.toString())).toContain(userA._id.toString())
  })

  it('deletes "for everyone" when the sender requests it', async () => {
    const msg = await makeMessage(userA._id, userB._id)

    const res = await request(app)
      .delete(`/api/v1/chat/message/${msg._id}`)
      .set(authHeader(signToken(userA)))
      .send({ type: 'everyone' })

    expect(res.status).toBe(200)
    const updated = await Message.findById(msg._id)
    expect(updated.deleted_everyone).toBe(true)
    expect(updated.text).toBe('This message was deleted')
  })

  it('returns 403 when receiver tries to delete "for everyone" (sender-only action)', async () => {
    const msg = await makeMessage(userA._id, userB._id)

    const res = await request(app)
      .delete(`/api/v1/chat/message/${msg._id}`)
      .set(authHeader(signToken(userB)))   // receiver, not sender
      .send({ type: 'everyone' })

    expect(res.status).toBe(403)
  })

  it('returns 403 when a third-party tries to delete a message', async () => {
    const msg = await makeMessage(userA._id, userB._id)
    const userC = await createUser()

    const res = await request(app)
      .delete(`/api/v1/chat/message/${msg._id}`)
      .set(authHeader(signToken(userC)))
      .send({ type: 'me' })

    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent message', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .delete(`/api/v1/chat/message/${fakeId}`)
      .set(authHeader(signToken(userA)))
      .send({ type: 'me' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /chat/admin/all — admin access control
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /chat/admin/all — admin-only message view', () => {
  it('returns all messages to an admin user', async () => {
    await makeMessage(userA._id, userB._id)

    const res = await request(app)
      .get('/api/v1/chat/admin/all')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.messages.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 when a regular user calls the admin endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/chat/admin/all')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Performance paths: cursor paging and the lean inbox
// ─────────────────────────────────────────────────────────────────────────────
describe('Cursor paging and inbox summaries', () => {
  const seed = async (from, to, n, start = Date.now() - 1e6) => {
    const docs = Array.from({ length: n }, (_, i) => ({ sender_id: i % 2 ? from._id : to._id, receiver_id: i % 2 ? to._id : from._id, text: `m${i}`, read_status: true, createdAt: new Date(start + i * 1000) }))
    return Message.insertMany(docs)
  }

  it('pages back through a thread with ?before= without gaps or repeats', async () => {
    const a = await createUser(); const b = await createUser()
    await seed(a, b, 25)
    const auth = authHeader(signToken(a))
    const first = await request(app).get(`/api/v1/chat/${b._id}`).query({ limit: 10 }).set(auth)
    expect(first.body.data.has_more).toBe(true)
    const seen = [...first.body.data.messages.map((m) => m.text)]
    let cursor = first.body.data.messages[0]._id
    for (;;) {
      const r = await request(app).get(`/api/v1/chat/${b._id}`).query({ limit: 10, before: cursor }).set(auth)
      expect(r.status).toBe(200)
      seen.unshift(...r.body.data.messages.map((m) => m.text))
      if (!r.body.data.has_more) break
      cursor = r.body.data.messages[0]._id
    }
    expect(seen).toEqual(Array.from({ length: 25 }, (_, i) => `m${i}`))
    // A cursor from another conversation is refused.
    const c = await createUser()
    const [foreign] = await seed(b, c, 1)
    expect((await request(app).get(`/api/v1/chat/${b._id}`).query({ before: foreign._id.toString() }).set(auth)).status).toBe(400)
  })

  it('shows each partner once with the newest visible message and unread count', async () => {
    const me = await createUser(); const p1 = await createUser(); const p2 = await createUser()
    const t = Date.now() - 1e5
    await Message.insertMany([
      { sender_id: p1._id, receiver_id: me._id, text: 'p1 old', read_status: false, createdAt: new Date(t) },
      { sender_id: p1._id, receiver_id: me._id, text: 'p1 new', read_status: false, createdAt: new Date(t + 3000) },
      { sender_id: me._id, receiver_id: p2._id, text: 'to p2', read_status: false, createdAt: new Date(t + 1000) },
      { sender_id: p2._id, receiver_id: me._id, text: 'p2 hidden', read_status: true, deleted_for: [me._id], createdAt: new Date(t + 5000) },
    ])
    const r = await request(app).get('/api/v1/chat').set(authHeader(signToken(me)))
    const chats = r.body.data.activeChats
    expect(chats.map((c) => c.snippet)).toEqual(['p1 new', 'to p2'])
    expect(chats[0].unread_count).toBe(2)
    expect(chats[1].unread_count).toBe(0)
  })
})
