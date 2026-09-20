import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fundedRatio } from '../../src/signals/signals.mjs'

test('fundedRatio is null, not zero, when the contract was never balance-sampled', () => {
  assert.equal(fundedRatio(null, 0), null)
})

test('fundedRatio is a measured zero, not null, for a sampled contract with no funded wallets', () => {
  assert.equal(fundedRatio(0, 100), 0)
})

test('fundedRatio computes the share for a normal sample (organic archetype)', () => {
  assert.equal(fundedRatio(74, 100), 0.74)
})
