import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LABELS, labelFor } from '../../src/signals/labels.mjs'

test('a single relayer yields the single-operator label (Poisoner archetype: 1 relayer)', () => {
  const label = labelFor({ relayerDiversity: 1 })
  assert.equal(label, 'single-operator')
})

test('at most 5 relayers still yields the single-operator label (boundary: <=5 relayers)', () => {
  const label = labelFor({ relayerDiversity: 5 })
  assert.equal(label, 'single-operator')
})

test('15 or more relayers yields the organic label (boundary: >=15 relayers)', () => {
  const label = labelFor({ relayerDiversity: 15 })
  assert.equal(label, 'organic')
})

test('343 relayers (organic archetype) yields the organic label', () => {
  const label = labelFor({ relayerDiversity: 343 })
  assert.equal(label, 'organic')
})

test('a relayer count between the two archetype boundaries yields the mixed-relayers label, not a fabricated bucket', () => {
  const label = labelFor({ relayerDiversity: 10 })
  assert.equal(label, 'mixed-relayers')
})

test('labelFor only ever returns a value from the closed LABELS vocabulary', () => {
  for (const relayerDiversity of [0, 1, 5, 6, 10, 14, 15, 343]) {
    const label = labelFor({ relayerDiversity })
    assert.ok(LABELS.includes(label), `label "${label}" is not in the closed vocabulary`)
  }
})
