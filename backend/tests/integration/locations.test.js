'use strict'
/**
 * Phase 1 — location search and pin → quartier resolution.
 */
const request = require('supertest')
const { buildApp } = require('../setup/app')
const LogisticZone = require('../../models/LogisticZone.model')
const Place = require('../../models/Place.model')

let app, douala, akwa, bonamoussadi, makepe
beforeAll(() => { app = buildApp() })

beforeEach(async () => {
  await LogisticZone.syncIndexes()
  await Place.syncIndexes()
  douala = await LogisticZone.create({ name: 'Douala', type: 'city', level: 0, centroid: { type: 'Point', coordinates: [9.7043, 4.0511] } })
  const littoral = await LogisticZone.create({ name: 'Douala V', type: 'district', level: 1, parent_id: douala._id, ancestors: [douala._id] })
  const quartier = (name, lng, lat) => LogisticZone.create({ name, type: 'quartier', level: 2, parent_id: littoral._id, ancestors: [douala._id, littoral._id], centroid: { type: 'Point', coordinates: [lng, lat] } })
  akwa = await quartier('Akwa', 9.6966, 4.0483)
  bonamoussadi = await quartier('Bonamoussadi', 9.7427, 4.0946)
  makepe = await quartier('Makèpè', 9.7546, 4.0767)
  await LogisticZone.create({ name: 'Ndogbong', type: 'quartier', level: 2, parent_id: littoral._id, ancestors: [douala._id, littoral._id] }) // no coordinates yet
  await Place.create({ name: 'Carrefour Bonamoussadi', kind: 'junction', zone_id: bonamoussadi._id, location: { type: 'Point', coordinates: [9.7431, 4.0951] }, approved: true })
  await Place.create({ name: 'Bonamoussadi Unverified Spot', zone_id: bonamoussadi._id, location: { type: 'Point', coordinates: [9.74, 4.09] }, approved: false })
})

describe('GET /locations/search', () => {
  it('finds quartiers without accents and ranks them before their city and district', async () => {
    const res = await request(app).get('/api/v1/locations/search?q=makepe')
    expect(res.status).toBe(200)
    expect(res.body.data.results[0]).toMatchObject({ kind: 'quartier', name: 'Makèpè', city: 'Douala', district: 'Douala V' })
    expect(res.body.data.results[0].zone_id).toBe(makepe._id.toString())
    expect(res.body.data.results[0].point).toEqual({ lng: 9.7546, lat: 4.0767 })
  })

  it('includes approved landmarks with their priced quartier, never unapproved ones', async () => {
    const res = await request(app).get('/api/v1/locations/search?q=bonamoussadi')
    const names = res.body.data.results.map((r) => r.name)
    expect(names).toContain('Carrefour Bonamoussadi')
    expect(names).not.toContain('Bonamoussadi Unverified Spot')
    const place = res.body.data.results.find((r) => r.kind === 'place')
    expect(place).toMatchObject({ quartier: 'Bonamoussadi', zone_id: bonamoussadi._id.toString() })
  })

  it('ignores one-letter queries', async () => {
    const res = await request(app).get('/api/v1/locations/search?q=a')
    expect(res.body.data.results).toEqual([])
  })
})

describe('GET /locations/resolve', () => {
  it('picks the quartier a pin clearly falls in', async () => {
    const res = await request(app).get('/api/v1/locations/resolve?lat=4.0480&lng=9.6970')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ needs_confirmation: false, zone: { name: 'Akwa', city: 'Douala' } })
  })

  it('asks the customer to confirm when a pin sits between two quartiers', async () => {
    // Roughly midway between Bonamoussadi and Makèpè.
    const res = await request(app).get('/api/v1/locations/resolve?lat=4.0857&lng=9.7487')
    expect(res.body.data.needs_confirmation).toBe(true)
    expect(res.body.data.reason).toBe('between_quartiers')
    expect(res.body.data.alternatives.length).toBeGreaterThan(0)
  })

  it('asks for confirmation when the pin is far from every known quartier', async () => {
    const res = await request(app).get('/api/v1/locations/resolve?lat=3.8480&lng=11.5021') // Yaoundé
    expect(res.body.data).toMatchObject({ needs_confirmation: true, reason: 'far_from_known_quartiers' })
  })

  it('rejects coordinates outside Cameroon', async () => {
    const res = await request(app).get('/api/v1/locations/resolve?lat=48.85&lng=2.35')
    expect(res.status).toBe(400)
  })
})
