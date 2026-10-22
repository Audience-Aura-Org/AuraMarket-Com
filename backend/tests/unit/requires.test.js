'use strict'
/**
 * tests/unit/requires.test.js
 * Every relative require() in the backend must resolve. Lazy requires inside
 * try/catch fail silently at runtime (e.g. a wrong '../' depth meant wallet
 * balance pushes after payouts never fired), so catch them statically.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const SKIP = new Set(['node_modules', 'tests', '.git', 'coverage', 'uploads', 'logs', 'public', 'dist'])

const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (SKIP.has(e.name)) return []
  const p = path.join(dir, e.name)
  if (e.isDirectory()) return sourceFiles(p)
  return p.endsWith('.js') ? [p] : []
})

describe('relative requires', () => {
  it('all resolve to a real module', { timeout: 30_000 }, () => {
    const broken = []
    for (const file of sourceFiles(ROOT)) {
      const code = fs.readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*)/.test(line)) // ignore commented-out requires
        .join('\n')
      for (const [, spec] of code.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        try {
          require.resolve(path.resolve(path.dirname(file), spec))
        } catch {
          broken.push(`${path.relative(ROOT, file)} -> ${spec}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
