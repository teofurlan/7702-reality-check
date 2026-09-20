import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { projectArtifactForUi } from '../../src/artifact/ui-projection.mjs'

function fakeArtifact() {
  return {
    schemaVersion: 1,
    fromBlock: 100,
    toBlock: 139,
    balanceBlock: 150,
    type4TxCount: 12,
    authorizationCount: 12,
    distinctDelegates: 2,
    // Deliberately different from perContractAuthoritySumWithOverlap below —
    // this is the exact shape of the original bug (see the regression test).
    distinctGlobalAuthorityCount: 100,
    perContractAuthoritySumWithOverlap: 150,
    globalRedelegationRatio: 1.5,
    recoveryFailures: 0,
    unsampledContracts: 1,
    contracts: [
      {
        delegate: '0xcontract1',
        authorizations: 120,
        distinctAuthorities: 90,
        relayerDiversity: 2,
        redelegationRatio: 1.33,
        medianNonce: 5,
        funded: 4,
        sampled: 10,
        totalEth: 1.5,
        fundedRatio: 0.4,
        label: 'single-operator',
      },
      {
        delegate: '0xcontract2',
        authorizations: 30,
        distinctAuthorities: 10,
        relayerDiversity: 1,
        redelegationRatio: 3,
        medianNonce: 0,
        funded: null,
        sampled: 0,
        totalEth: 0,
        fundedRatio: null,
        label: 'insufficient-volume',
      },
    ],
  }
}

// Regression guard for the original bug this project exists to debunk:
// MetricsBar's "Distinct Wallets" headline was fed from a SUM of per-contract
// distinct counts (perContractAuthoritySumWithOverlap), which double-counts
// any authority that delegated to more than one contract. Measured on the
// real dataset the sum was 24,305 against a true distinct count of 18,105 —
// a 34.24% inflation. This test fails loudly if that wiring is ever
// reintroduced.
test('globalUnique headline comes from distinctGlobalAuthorityCount, never from perContractAuthoritySumWithOverlap (regression guard for the sum-as-global bug)', () => {
  const artifact = fakeArtifact()
  const projected = projectArtifactForUi(artifact)

  assert.equal(projected.globalUnique, 100)
  assert.notEqual(projected.globalUnique, 150)
  assert.equal(projected.globalUnique, artifact.distinctGlobalAuthorityCount)
})

test('perContractSumWithOverlap is exposed as its own separate field, never used as the headline', () => {
  const artifact = fakeArtifact()
  const projected = projectArtifactForUi(artifact)

  assert.equal(projected.perContractSumWithOverlap, 150)
})

test('top-level fields map across correctly, preserving the field names the existing components already consume', () => {
  const artifact = fakeArtifact()
  const projected = projectArtifactForUi(artifact)

  assert.equal(projected.fromBlock, artifact.fromBlock)
  assert.equal(projected.toBlock, artifact.toBlock)
  assert.equal(projected.balanceBlock, artifact.balanceBlock)
  assert.equal(projected.totalType4Tx, artifact.type4TxCount)
  assert.equal(projected.totalAuths, artifact.authorizationCount)
  assert.equal(projected.uniqueContracts, artifact.distinctDelegates)
  assert.equal(projected.globalRedelegation, artifact.globalRedelegationRatio)
  assert.equal(projected.recoveryFailures, artifact.recoveryFailures)
  assert.equal(projected.unsampledContracts, artifact.unsampledContracts)
})

test('every per-contract field maps across correctly', () => {
  const artifact = fakeArtifact()
  const projected = projectArtifactForUi(artifact)
  const [first] = projected.contracts

  assert.equal(first.addr, '0xcontract1')
  assert.equal(first.auths, 120)
  assert.equal(first.unique, 90)
  assert.equal(first.relayers, 2)
  assert.equal(first.redelegation, 1.33)
  assert.equal(first.medNonce, 5)
  assert.equal(first.funded, 4)
  assert.equal(first.sampled, 10)
  assert.equal(first.totalEth, 1.5)
  assert.equal(first.fundedRatio, 0.4)
  assert.equal(first.label, 'single-operator')
})

test('a funded: null / fundedRatio: null contract survives projection as null, never coerced to 0', () => {
  const artifact = fakeArtifact()
  const projected = projectArtifactForUi(artifact)
  const [, unmeasured] = projected.contracts

  assert.equal(unmeasured.funded, null)
  assert.equal(unmeasured.fundedRatio, null)
  assert.notEqual(unmeasured.funded, 0)
  assert.notEqual(unmeasured.fundedRatio, 0)
})

test('the projection of the real committed data/artifact.json has globalUnique === distinctGlobalAuthorityCount and a non-empty contracts array', () => {
  const realArtifact = JSON.parse(
    readFileSync(new URL('../../data/artifact.json', import.meta.url), 'utf8'),
  )
  const projected = projectArtifactForUi(realArtifact)

  assert.equal(projected.globalUnique, realArtifact.distinctGlobalAuthorityCount)
  assert.ok(projected.contracts.length > 0)
})
