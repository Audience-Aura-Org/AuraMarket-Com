'use strict'
/**
 * tests/integration/qa.test.js
 * Prompt 12 — Product Q&A flows: ask, answer, list.
 *
 * Sections:
 *   1. GET  /qa/product/:productId — public Q&A list
 *   2. POST /qa/ask                — ask a question (protected)
 *   3. PATCH /qa/answer/:id        — vendor answers a question
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }          = require('../setup/app')
const { createUser, createVendor } = require('../factories')
const { signToken, authHeader }    = require('../helpers/auth')

const Product  = require('../../models/Product.model')
const Question = require('../../models/Question.model')
const Vendor   = require('../../models/Vendor.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture — one vendor + one retail product
// ─────────────────────────────────────────────────────────────────────────────
let vendorUser, vendorDoc, productId

beforeEach(async () => {
  const created = await createVendor()
  vendorUser = created.user
  vendorDoc  = created.vendor

  productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:           productId,
    vendor_id:     vendorDoc._id,
    name:          faker.commerce.productName(),
    description:   faker.commerce.productDescription(),
    price:         5_000,
    stock:         10,
    status:        'active',
    category:      'Electronics',
    images:        [],
    meal:          null,
    is_meal:       false,
    has_variants:  false,
    view_count:    0,
    purchase_count: 0,
    createdAt:     new Date(),
    updatedAt:     new Date(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper — seed a question directly in the DB
// ─────────────────────────────────────────────────────────────────────────────
const makeQuestion = (userId, overrides = {}) =>
  Question.create({
    product_id:    productId,
    user_id:       userId,
    question_text: 'Is this product waterproof?',
    is_public:     true,
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /qa/product/:productId — public Q&A list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /qa/product/:productId — public Q&A list', () => {
  it('returns an empty list when no questions exist', async () => {
    const res = await request(app).get(`/api/v1/qa/product/${productId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.questions)).toBe(true)
    expect(res.body.data.questions).toHaveLength(0)
    expect(res.body.count).toBe(0)
  })

  it('returns public questions for a product', async () => {
    const buyer = await createUser()
    await makeQuestion(buyer._id)

    const res = await request(app).get(`/api/v1/qa/product/${productId}`)

    expect(res.status).toBe(200)
    expect(res.body.data.questions.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.questions[0].question_text).toBe('Is this product waterproof?')
  })

  it('does not return private (is_public: false) questions', async () => {
    const buyer = await createUser()
    await makeQuestion(buyer._id, { is_public: false })

    const res = await request(app).get(`/api/v1/qa/product/${productId}`)

    expect(res.status).toBe(200)
    expect(res.body.data.questions).toHaveLength(0)
  })

  it('does not require authentication', async () => {
    const res = await request(app).get(`/api/v1/qa/product/${productId}`)
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /qa/ask — ask a question
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /qa/ask — ask a product question', () => {
  it('creates a question and returns 201', async () => {
    const buyer = await createUser()

    const res = await request(app)
      .post('/api/v1/qa/ask')
      .set(authHeader(signToken(buyer)))
      .send({ product_id: productId, question_text: 'Does it come in blue?' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.question.question_text).toBe('Does it come in blue?')
    expect(res.body.data.question.user_id.toString()).toBe(buyer._id.toString())
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/qa/ask')
      .send({ product_id: productId, question_text: 'No auth?' })

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /qa/answer/:id — vendor answers a question
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /qa/answer/:id — vendor answers a question', () => {
  it('allows the product vendor to post an answer (200)', async () => {
    const buyer    = await createUser()
    const question = await makeQuestion(buyer._id)

    const res = await request(app)
      .patch(`/api/v1/qa/answer/${question._id}`)
      .set(authHeader(signToken(vendorUser)))
      .send({ answer_text: 'Yes, it is fully waterproof up to 30 m.' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.question.answer_text).toBe('Yes, it is fully waterproof up to 30 m.')
    expect(res.body.data.question.answered_by).toBeTruthy()
  })

  it('returns 403 when a non-owning vendor tries to answer', async () => {
    const buyer       = await createUser()
    const otherVendor = await createVendor()
    const question    = await makeQuestion(buyer._id)

    const res = await request(app)
      .patch(`/api/v1/qa/answer/${question._id}`)
      .set(authHeader(signToken(otherVendor.user)))
      .send({ answer_text: 'I do not own this product.' })

    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent question', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/qa/answer/${fakeId}`)
      .set(authHeader(signToken(vendorUser)))
      .send({ answer_text: 'Ghost answer.' })

    expect(res.status).toBe(404)
  })

  it('returns 401 without authentication', async () => {
    const buyer    = await createUser()
    const question = await makeQuestion(buyer._id)

    const res = await request(app)
      .patch(`/api/v1/qa/answer/${question._id}`)
      .send({ answer_text: 'No token.' })

    expect(res.status).toBe(401)
  })
})
