/**
 * vitest.config.mjs
 * Auradime — Vitest test runner configuration (Vitest 4.x).
 *
 * Three projects:
 *   unit        – fast, no DB/HTTP; pure function tests
 *   integration – full Express app via supertest + MongoMemoryReplSet
 *   concurrency – atomicity / race-condition tests; runs serially (fileParallelism: false)
 *
 * Global setup (starts the MongoDB replica set) runs once before all projects.
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ── Shared settings (inherited by all projects) ──────────────────────────
    globals: true,
    environment: 'node',
    pool: 'forks',           // child_process.fork — honours CJS require() natively
    reporters: ['verbose'],
    testTimeout: 15_000,
    hookTimeout: 15_000,

    // ── Global setup: starts MongoMemoryReplSet, sets env vars ───────────────
    // Runs once across the entire vitest run, before any project setups.
    globalSetup: ['./tests/globalSetup.js'],

    // ── Coverage ─────────────────────────────────────────────────────────────
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'controllers/**/*.js',
        'services/**/*.js',
        'utils/**/*.js',
        'middleware/**/*.js',
      ],
      exclude: [
        'tests/**',
        'scripts/**',
        'migrations/**',
        'uploads/**',
        'logs/**',
        'node_modules/**',
      ],
      // Baseline thresholds — raise these as the test suite grows.
      thresholds: {
        lines:      0,
        functions:  0,
        branches:   0,
        statements: 0,
      },
    },

    // ── Projects ─────────────────────────────────────────────────────────────
    projects: [
      // ── Unit ───────────────────────────────────────────────────────────────
      // No DB, no HTTP. Pure function / module tests.
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          globals: true,
          environment: 'node',
          pool: 'forks',
        },
      },

      // ── Integration ────────────────────────────────────────────────────────
      // Supertest over the full Express app against MongoMemoryReplSet.
      // fileParallelism: false — integration files share the same MongoMemoryReplSet.
      // Running files in parallel causes afterEach wipes from one fork to delete
      // documents that another fork is mid-test using, producing spurious 401s
      // ("user no longer exists") and MongoDB write conflicts.
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          globals: true,
          environment: 'node',
          pool: 'forks',
          setupFiles: [
            './tests/setup/redis.js',
            './tests/setup/db.js',
          ],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },

      // ── Concurrency ────────────────────────────────────────────────────────
      // Race-condition and atomicity tests.
      // fileParallelism: false ensures test FILES run sequentially (one at a time),
      // preventing concurrent workers from interfering with each other's DB state.
      {
        test: {
          name: 'concurrency',
          include: ['tests/concurrency/**/*.test.js'],
          globals: true,
          environment: 'node',
          pool: 'forks',
          setupFiles: [
            './tests/setup/redis.js',
            './tests/setup/db.js',
          ],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
