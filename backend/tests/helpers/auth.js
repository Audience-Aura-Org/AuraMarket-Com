'use strict'
/**
 * tests/helpers/auth.js
 * JWT signing and supertest authentication helpers.
 *
 * Usage:
 *   const { signToken, authHeader, loginAs } = require('../helpers/auth')
 *
 *   const user = await createUser()
 *   const token = signToken(user)
 *
 *   await request(app)
 *     .get('/api/v1/users/profile')
 *     .set(authHeader(token))
 *     .expect(200)
 */

const jwt = require('jsonwebtoken')

/** Sign a JWT for a user document (or any object with _id and role). */
const signToken = (user, expiresIn = '1h') => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[auth helper] JWT_SECRET is not set')
  return jwt.sign(
    {
      id:            user._id?.toString() || user.id?.toString(),
      role:          user.role,
      tokenVersion: user.token_version ?? 0, // camelCase — matches authOtp.service.js & auth.middleware.js
    },
    secret,
    { expiresIn }
  )
}

/**
 * Returns the Authorization header object for supertest's `.set()`.
 * @param {string} token  Raw JWT (no "Bearer " prefix needed)
 */
const authHeader = (token) => ({ Authorization: `Bearer ${token}` })

/**
 * Create a signed token for a user and return it as a header object.
 * Convenience wrapper for the common pattern.
 * @param {object} user  User document (must have _id and role)
 */
const asUser = (user) => authHeader(signToken(user))

/**
 * Create an expired token for a user (useful for auth expiry tests).
 */
const expiredToken = (user) => signToken(user, '-1s')

module.exports = { signToken, authHeader, asUser, expiredToken }
