'use strict'
/**
 * tests/helpers/concurrency.js
 * Helpers for race-condition and atomicity tests.
 *
 * Usage:
 *   const { race, raceN } = require('../helpers/concurrency')
 *
 *   // Fire 10 concurrent wallet debits and check exactly one succeeded
 *   const results = await race(10, () =>
 *     adjustBalance(userId, -100, null, { ... })
 *   )
 *   expect(results.filter(r => r.ok).length).toBe(1)
 */

/**
 * Run `fn` concurrently `count` times and collect settled results.
 *
 * @param {number}   count  Number of concurrent invocations
 * @param {() => Promise<any>} fn  Factory — called once per invocation
 * @returns {Promise<Array<{ ok: boolean, value?: any, error?: Error }>>}
 */
const race = async (count, fn) => {
  const promises = Array.from({ length: count }, () =>
    fn().then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error })
    )
  )
  return Promise.all(promises)
}

/**
 * Run multiple DIFFERENT async functions simultaneously and return settled results.
 *
 * @param {Array<() => Promise<any>>} fns
 * @returns {Promise<Array<{ ok: boolean, value?: any, error?: Error }>>}
 */
const raceN = async (fns) =>
  Promise.all(
    fns.map((fn) =>
      fn().then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error })
      )
    )
  )

/**
 * Count how many results succeeded (ok === true).
 */
const countOk = (results) => results.filter((r) => r.ok).length

/**
 * Count how many results failed (ok === false).
 */
const countFailed = (results) => results.filter((r) => !r.ok).length

/**
 * Assert that exactly `n` of the concurrent operations succeeded.
 * Prints a summary on failure.
 */
const assertExactlyNSucceeded = (results, n) => {
  const succeeded = countOk(results)
  if (succeeded !== n) {
    const errors = results
      .filter((r) => !r.ok)
      .map((r) => r.error?.message)
      .join('; ')
    expect(succeeded).toBe(n) // will throw with a clear diff
    // extra context if vitest doesn't show it:
    console.error(`[concurrency] ${succeeded}/${results.length} succeeded. Errors: ${errors}`)
  }
}

module.exports = { race, raceN, countOk, countFailed, assertExactlyNSucceeded }
