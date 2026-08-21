'use strict'
/**
 * tests/helpers/time.js
 * Date and fake-timer helpers for time-sensitive tests.
 *
 * Usage:
 *   const { daysAgo, hoursAgo, inFuture, freezeTime, thawTime } = require('../helpers/time')
 *
 *   // Create an order 3 days ago (for escrow auto-release tests)
 *   const order = await createOrder(ids, { createdAt: daysAgo(3) })
 *
 *   // Freeze time for deterministic assertions
 *   const restore = freezeTime(new Date('2026-01-15T12:00:00Z'))
 *   try { ... } finally { restore() }
 */

/**
 * Returns a Date that is `n` days in the past.
 * @param {number} n
 */
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/**
 * Returns a Date that is `n` hours in the past.
 */
const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000)

/**
 * Returns a Date that is `n` minutes in the past.
 */
const minutesAgo = (n) => new Date(Date.now() - n * 60 * 1000)

/**
 * Returns a Date that is `n` days in the future.
 */
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)

/**
 * Returns a Date that is `n` hours in the future.
 */
const inHours = (n) => new Date(Date.now() + n * 60 * 60 * 1000)

/**
 * Returns a Date that is `n` minutes in the future.
 */
const inMinutes = (n) => new Date(Date.now() + n * 60 * 1000)

/**
 * Freeze `Date.now()` and `new Date()` to a fixed point in time.
 * Uses Vitest's fake timers internally.
 *
 * @param {Date|number} [at]  The instant to freeze to. Defaults to now.
 * @returns {() => void}      Restore function — call in `finally` or `afterEach`.
 */
const freezeTime = (at) => {
  const now = at ? new Date(at).getTime() : Date.now()
  // Vitest globalThis.vi is available when globals: true
  vi.useFakeTimers({ now, toFake: ['Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
  return () => vi.useRealTimers()
}

/**
 * Restore real timers (alias for vi.useRealTimers()).
 */
const thawTime = () => vi.useRealTimers()

/**
 * Advance fake timers by `ms` milliseconds.
 * Requires freezeTime() to have been called first.
 */
const advanceTime = async (ms) => {
  await vi.advanceTimersByTimeAsync(ms)
}

/**
 * Sleep for `ms` milliseconds (real time — not affected by fake timers).
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
  daysAgo,
  hoursAgo,
  minutesAgo,
  inDays,
  inHours,
  inMinutes,
  freezeTime,
  thawTime,
  advanceTime,
  sleep,
}
