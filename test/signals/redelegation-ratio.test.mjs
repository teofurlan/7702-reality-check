import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redelegationRatio } from '../../src/signals/signals.mjs'

test('redelegationRatio matches the Poisoner archetype worked example', () => {
  const ratio = redelegationRatio(9743, 1127)
  assert.ok(Math.abs(ratio - 8.64) < 0.01, `expected ~8.64 (+/-0.01), got ${ratio}`)
})

test('redelegationRatio is 1.00x for a contract with no re-delegation (organic archetype)', () => {
  const ratio = redelegationRatio(343, 343)
  assert.equal(ratio, 1)
})

test('redelegationRatio never divides by zero distinct authorities', () => {
  const ratio = redelegationRatio(5, 0)
  assert.equal(ratio, 5)
})
