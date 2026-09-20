import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recoverAuthorities, RecoveryLimitExceededError } from '../../src/scan/recover.mjs'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/traps/recovery-cap.json', import.meta.url)),
)

test('recoverAuthorities recovers every tuple it is given, with no ceiling (Trap D)', async () => {
  const result = await recoverAuthorities(fixture.tuples)

  assert.equal(result.failures, 0)
  // Data-driven, never a hardcoded expectation: the claim is "all of them",
  // not "a particular number the fixture happens to hold today".
  assert.equal(result.authorities.size, fixture.tuples.length)
})

test('recoverAuthorities throws instead of truncating when maxTuples is exceeded (Trap D)', async () => {
  await assert.rejects(
    () => recoverAuthorities(fixture.tuples, { maxTuples: fixture.tuples.length - 1 }),
    RecoveryLimitExceededError,
  )
})

test('recover.mjs contains no slice, so truncation cannot reappear silently (Trap D)', () => {
  const source = readFileSync(new URL('../../src/scan/recover.mjs', import.meta.url), 'utf8')

  // Structural, not behavioural. A fixture of N tuples only ever proves there
  // is no cap at or below N; this proves there is no cap at any N, which is
  // the actual contract, and it is what the original spike violated.
  assert.equal(/\.slice\s*\(/.test(source), false)
})
