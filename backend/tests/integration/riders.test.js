'use strict'
/**
 * Phase 2 — agency-managed rider accounts.
 */
const request = require('supertest')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const RiderProfile = require('../../models/RiderProfile.model')
const User = require('../../models/User.model')

let app
beforeAll(() => { app = buildApp() })

let agencyA, agencyB, ownerA, ownerB
const makeAgency = async (name) => {
  const owner = await createLogisticsUser()
  const firm = await LogisticsCompany.create({ user_id: owner._id, company_name: name, contact_email: faker.internet.email().toLowerCase(),
    contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'], is_verified: true })
  return { owner, firm }
}
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { rider_accounts: true } }])
  ;({ owner: ownerA, firm: agencyA } = await makeAgency('FastShip'))
  ;({ owner: ownerB, firm: agencyB } = await makeAgency('Swift Riders'))
})

const invite = (owner, body) => request(app).post('/api/v1/logistics/riders/invite').set(authHeader(signToken(owner))).send(body)

describe('Agency invites riders', () => {
  it('creates an account for a new rider and sends them an invitation', async () => {
    const res = await invite(ownerA, { email: 'Paul.Rider@Example.com', name: 'Paul Ndi', phone: '677111222', vehicle_type: 'motorcycle', vehicle_plate: 'lt 123 ab' })
    expect(res.status).toBe(201)
    expect(res.body.data.rider).toMatchObject({ status: 'invited', availability: 'offline', vehicle_plate: 'LT 123 AB' })
    const user = await User.findOne({ email: 'paul.rider@example.com' })
    expect(user.role).toBe('customer') // riders keep a normal account role
    const profile = await RiderProfile.findOne({ user_id: user._id })
    expect(profile.agency_id.toString()).toBe(agencyA._id.toString())
  })

  it('invites an existing customer without changing their role', async () => {
    const customer = await createUser({ email: 'amina@example.com' })
    expect((await invite(ownerA, { email: 'amina@example.com' })).status).toBe(201)
    expect((await User.findById(customer._id)).role).toBe('customer')
  })

  it('refuses business and staff accounts', async () => {
    const admin = await createUser({ role: 'admin' })
    expect((await invite(ownerA, { email: admin.email })).status).toBe(400)
    expect((await invite(ownerA, { email: ownerB.email })).status).toBe(400)
  })

  it('does not let a second agency take a rider who already rides for another', async () => {
    await invite(ownerA, { email: 'paul@example.com', name: 'Paul' })
    const res = await invite(ownerB, { email: 'paul@example.com', name: 'Paul' })
    expect(res.status).toBe(409)
    expect(res.body.message).not.toContain('FastShip') // does not reveal the other agency
  })

  it('is blocked while the rider_accounts flag is off', async () => {
    await PlatformSettings.updateOne({}, { $set: { features: { rider_accounts: false } } })
    expect((await invite(ownerA, { email: 'paul@example.com', name: 'Paul' })).status).toBe(403)
  })
})

describe('Agencies only see and manage their own riders', () => {
  it('lists only its own riders and cannot update another agency’s rider', async () => {
    await invite(ownerA, { email: 'a1@example.com', name: 'A One' })
    const bInvite = await invite(ownerB, { email: 'b1@example.com', name: 'B One' })
    const listA = await request(app).get('/api/v1/logistics/riders').set(authHeader(signToken(ownerA)))
    expect(listA.body.data.riders.map((r) => r.user.email)).toEqual(['a1@example.com'])

    const res = await request(app).patch(`/api/v1/logistics/riders/${bInvite.body.data.rider.id}`).set(authHeader(signToken(ownerA))).send({ status: 'inactive' })
    expect(res.status).toBe(404)
  })

  it('cannot be used by a customer', async () => {
    const customer = await createUser()
    expect((await request(app).get('/api/v1/logistics/riders').set(authHeader(signToken(customer)))).status).toBe(403)
  })
})

describe('Rider self-service', () => {
  const riderUser = async () => {
    await invite(ownerA, { email: 'paul@example.com', name: 'Paul' })
    return User.findOne({ email: 'paul@example.com' })
  }

  it('lets the rider accept, then go online and offline', async () => {
    const rider = await riderUser()
    const auth = authHeader(signToken(rider))
    expect((await request(app).patch('/api/v1/riders/me/availability').set(auth).send({ availability: 'online' })).status).toBe(403) // not accepted yet
    const me = await request(app).get('/api/v1/riders/me').set(auth)
    expect(me.body.data.rider).toMatchObject({ status: 'invited', agency: { name: 'FastShip' } })

    expect((await request(app).post('/api/v1/riders/me/accept').set(auth)).body.data.status).toBe('active')
    expect((await request(app).patch('/api/v1/riders/me/availability').set(auth).send({ availability: 'online' })).body.data.availability).toBe('online')

    const profile = await RiderProfile.findOne({ user_id: rider._id })
    expect(profile.history).toHaveLength(1)
    expect(profile.history[0].agency_id.toString()).toBe(agencyA._id.toString())
  })

  it('takes a deactivated rider offline and only lets the agency reactivate them', async () => {
    const rider = await riderUser()
    const auth = authHeader(signToken(rider))
    await request(app).post('/api/v1/riders/me/accept').set(auth)
    await request(app).patch('/api/v1/riders/me/availability').set(auth).send({ availability: 'online' })
    const profile = await RiderProfile.findOne({ user_id: rider._id })

    const off = await request(app).patch(`/api/v1/logistics/riders/${profile._id}`).set(authHeader(signToken(ownerA))).send({ status: 'inactive' })
    expect(off.body.data.rider).toMatchObject({ status: 'inactive', availability: 'offline' })
    expect((await request(app).patch('/api/v1/riders/me/availability').set(auth).send({ availability: 'online' })).status).toBe(403)

    const on = await request(app).patch(`/api/v1/logistics/riders/${profile._id}`).set(authHeader(signToken(ownerA))).send({ status: 'active' })
    expect(on.body.data.rider.status).toBe('active')
  })

  it('returns no rider profile for ordinary users and after declining', async () => {
    const someone = await createUser()
    expect((await request(app).get('/api/v1/riders/me').set(authHeader(signToken(someone)))).body.data.rider).toBeNull()
    const rider = await riderUser()
    const auth = authHeader(signToken(rider))
    await request(app).post('/api/v1/riders/me/decline').set(auth)
    expect((await request(app).get('/api/v1/riders/me').set(auth)).body.data.rider).toBeNull()
  })
})
