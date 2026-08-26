'use strict'
/**
 * tests/setup/unit-env.js
 * Minimal env vars for unit tests that don't need MongoDB or Redis.
 */

process.env.NODE_ENV    ||= 'test'
process.env.JWT_SECRET  ||= 'auradime-test-jwt-secret-32-chars!!'
process.env.JWT_EXPIRES_IN ||= '24h'
process.env.PAYUNIT_WEBHOOK_SECRET  ||= 'test-payunit-secret'
process.env.EVERSEND_WEBHOOK_SECRET ||= 'test-eversend-secret'
