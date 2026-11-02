'use strict'
/**
 * Mobile Money fallback: PawaPay → PayUnit → Eversend, only after a failure that
 * proves nothing reached the customer's phone; Eversend never under 500 XAF.
 */
const { withMobileMoneyFallback, chainFor, isSafeToFallback } = require('../../services/payment/mobileMoneyFallback')

const fail = (message, extra = {}) => Object.assign(new Error(message), extra)

describe('Mobile Money fallback', () => {
  it('uses the first gateway when it works', async () => {
    const tried = []
    const r = await withMobileMoneyFallback('pawapay', 1500, async (g) => { tried.push(g); return { reference: 'R1' } })
    expect(r).toMatchObject({ gateway: 'pawapay', reference: 'R1', fallback_used: false })
    expect(tried).toEqual(['pawapay'])
  })

  it('moves PawaPay → PayUnit → Eversend on clear pre-charge failures, cleaning up each one', async () => {
    const tried = []; const cleaned = []
    const r = await withMobileMoneyFallback('pawapay', 1500, async (g) => {
      tried.push(g)
      if (g !== 'eversend') throw fail(`${g} unavailable`, { response: { status: 503 } })
      return { reference: 'R3' }
    }, { onFallback: (g) => { cleaned.push(g) } })
    expect(tried).toEqual(['pawapay', 'payunit', 'eversend'])
    expect(cleaned).toEqual(['pawapay', 'payunit'])
    expect(r).toMatchObject({ gateway: 'eversend', fallback_used: true })
  })

  it('starts Orange numbers at PayUnit, and never uses Eversend under 500 XAF', async () => {
    expect(chainFor('payunit', 1000)).toEqual(['payunit', 'eversend'])
    expect(chainFor('pawapay', 300)).toEqual(['pawapay', 'payunit'])
    await expect(withMobileMoneyFallback('payunit', 300, async () => { throw fail('PayUnit down') })).rejects.toThrow('PayUnit down')
  })

  it('never retries after a timeout or a prompt already pending (the customer could pay twice)', async () => {
    for (const err of [fail('timeout of 15000ms exceeded', { code: 'ECONNABORTED' }), fail('A payment is already pending on your phone. Please approve the USSD prompt')]) {
      const tried = []
      await expect(withMobileMoneyFallback('pawapay', 1500, async (g) => { tried.push(g); throw err })).rejects.toBe(err)
      expect(tried).toEqual(['pawapay'])
      expect(isSafeToFallback(err)).toBe(false)
    }
  })

  it('reports the first error when every route fails', async () => {
    await expect(withMobileMoneyFallback('pawapay', 1500, async (g) => { throw fail(`${g} refused`) })).rejects.toThrow('pawapay refused')
  })
})
