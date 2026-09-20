import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  contractsByLabel,
  classifiedContracts,
  volumeSharePct,
  fundedRatioPct,
  sumTotalEth,
  maxRedelegation,
  separationRatio,
} from '../../src/artifact/ui-aggregates.mjs'

// Small hand-built projected-contracts fixture (already in the UI shape
// `ui-projection.mjs` produces: `auths`, `relayers`, `redelegation`,
// `funded`, `sampled`, `totalEth`, `label`). Exercises the exact grouping
// MetricsBar/BimodalChart need instead of each re-deriving it with its own
// hardcoded thresholds.
function fixtureContracts() {
  return [
    { addr: '0xa', auths: 100, relayers: 1, redelegation: 5, funded: 1, sampled: 100, totalEth: 0.1, label: 'single-operator' },
    { addr: '0xb', auths: 200, relayers: 2, redelegation: 10, funded: 0, sampled: 100, totalEth: 0, label: 'single-operator' },
    { addr: '0xc', auths: 50, relayers: 20, funded: 40, redelegation: 1, sampled: 100, totalEth: 5, label: 'organic' },
    { addr: '0xd', auths: 10, relayers: 1, redelegation: 1, funded: null, sampled: 0, totalEth: 0, label: 'insufficient-volume' },
  ]
}

test('contractsByLabel returns only contracts matching the given label', () => {
  const result = contractsByLabel(fixtureContracts(), 'single-operator')
  assert.equal(result.length, 2)
  assert.ok(result.every((c) => c.label === 'single-operator'))
})

test('classifiedContracts excludes insufficient-volume contracts', () => {
  const result = classifiedContracts(fixtureContracts())
  assert.equal(result.length, 3)
  assert.ok(result.every((c) => c.label !== 'insufficient-volume'))
})

test('volumeSharePct computes the group share of total authorizations as a percentage', () => {
  const singleOp = contractsByLabel(fixtureContracts(), 'single-operator')
  // (100 + 200) / 360 * 100
  assert.ok(Math.abs(volumeSharePct(singleOp, 360) - 83.333) < 0.01)
})

test('volumeSharePct returns null rather than dividing by zero when totalAuths is 0', () => {
  assert.equal(volumeSharePct(fixtureContracts(), 0), null)
})

test('fundedRatioPct sums funded and sampled across the group, treating null funded as unsampled (not zero)', () => {
  const singleOp = contractsByLabel(fixtureContracts(), 'single-operator')
  // funded: 1 + 0 = 1, sampled: 100 + 100 = 200 -> 0.5%
  assert.ok(Math.abs(fundedRatioPct(singleOp) - 0.5) < 0.001)
})

test('fundedRatioPct returns null when no contract in the group was sampled', () => {
  const insufficient = contractsByLabel(fixtureContracts(), 'insufficient-volume')
  assert.equal(fundedRatioPct(insufficient), null)
})

test('sumTotalEth sums totalEth across the group', () => {
  const organic = contractsByLabel(fixtureContracts(), 'organic')
  assert.equal(sumTotalEth(organic), 5)
})

test('maxRedelegation returns the highest redelegation ratio in the group, or null for an empty group', () => {
  const singleOp = contractsByLabel(fixtureContracts(), 'single-operator')
  assert.equal(maxRedelegation(singleOp), 10)
  assert.equal(maxRedelegation([]), null)
})

test('separationRatio divides two percentages and returns null instead of Infinity/NaN when it cannot be derived', () => {
  assert.equal(separationRatio(30, 1), 30)
  assert.equal(separationRatio(30, 0), null)
  assert.equal(separationRatio(null, 1), null)
  assert.equal(separationRatio(30, null), null)
})
