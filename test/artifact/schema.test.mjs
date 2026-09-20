import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateArtifact } from '../../src/artifact/validate.mjs'
import { buildArtifact, ARTIFACT_VERSION } from '../../src/artifact/schema.mjs'
import { unionAuthorities } from '../../src/scan/dedupe.mjs'
import { computeSignals } from '../../src/signals/signals.mjs'
import { overlapRecords } from '../fixtures/overlap-synthetic.mjs'

function fullyPopulatedArtifact() {
  return {
    schemaVersion: 1,
    fromBlock: 100,
    toBlock: 139,
    balanceBlock: 150,
    type4TxCount: 12,
    authorizationCount: 12,
    distinctDelegates: 1,
    distinctGlobalAuthorityCount: 3,
    perContractAuthoritySumWithOverlap: 3,
    globalRedelegationRatio: 4,
    recoveryFailures: 0,
    unsampledContracts: 0,
    contracts: [
      {
        delegate: '0xcontract1',
        authorizations: 12,
        distinctAuthorities: 3,
        relayerDiversity: 2,
        redelegationRatio: 4,
        medianNonce: 5,
        funded: 2,
        sampled: 3,
        totalEth: 1.5,
        fundedRatio: 2 / 3,
        label: 'single-operator',
      },
    ],
  }
}

test('a candidate missing required fields fails validation and names distinctGlobalAuthorityCount', () => {
  const { valid, errors } = validateArtifact({ schemaVersion: 1 })

  assert.equal(valid, false)
  assert.ok(
    errors.some((error) => error.includes('distinctGlobalAuthorityCount')),
    `expected an error naming distinctGlobalAuthorityCount, got: ${JSON.stringify(errors)}`,
  )
})

test('a fully populated artifact passes validation with no errors', () => {
  assert.deepEqual(validateArtifact(fullyPopulatedArtifact()), { valid: true, errors: [] })
})

test('a candidate missing unsampledContracts fails validation and names unsampledContracts', () => {
  const missingUnsampled = fullyPopulatedArtifact()
  delete missingUnsampled.unsampledContracts

  const { valid, errors } = validateArtifact(missingUnsampled)

  assert.equal(valid, false)
  assert.ok(
    errors.some((error) => error.includes('unsampledContracts')),
    `expected an error naming unsampledContracts, got: ${JSON.stringify(errors)}`,
  )
})

test('a populated artifact carrying unsampledContracts is valid', () => {
  const artifact = { ...fullyPopulatedArtifact(), unsampledContracts: 3 }

  assert.deepEqual(validateArtifact(artifact), { valid: true, errors: [] })
})

test('a candidate missing balanceBlock fails validation and names balanceBlock', () => {
  const missingBalanceBlock = fullyPopulatedArtifact()
  delete missingBalanceBlock.balanceBlock

  const { valid, errors } = validateArtifact(missingBalanceBlock)

  assert.equal(valid, false)
  assert.ok(
    errors.some((error) => error.includes('balanceBlock')),
    `expected an error naming balanceBlock, got: ${JSON.stringify(errors)}`,
  )
})

test('a contract entry with fundedRatio: null and sampled: 0 is valid (unmeasured is legal)', () => {
  const artifact = fullyPopulatedArtifact()
  artifact.contracts[0] = {
    ...artifact.contracts[0],
    funded: null,
    sampled: 0,
    fundedRatio: null,
  }

  assert.deepEqual(validateArtifact(artifact), { valid: true, errors: [] })
})

test('a contract entry with a non-number totalEth is invalid', () => {
  const artifact = fullyPopulatedArtifact()
  artifact.contracts[0] = {
    ...artifact.contracts[0],
    totalEth: '1.5',
  }

  const { valid, errors } = validateArtifact(artifact)

  assert.equal(valid, false)
  assert.ok(
    errors.some((error) => error.includes('totalEth')),
    `expected an error naming totalEth, got: ${JSON.stringify(errors)}`,
  )
})

test('a candidate with the two authority-count fields swapped is rejected, naming perContractAuthoritySumWithOverlap', () => {
  const swapped = {
    ...fullyPopulatedArtifact(),
    // was 3/3 (equal, valid); flip so the sum is now strictly below the
    // global distinct count, which must never be legal.
    distinctGlobalAuthorityCount: 5,
    perContractAuthoritySumWithOverlap: 3,
  }

  const { valid, errors } = validateArtifact(swapped)

  assert.equal(valid, false)
  assert.ok(
    errors.some((error) => error.includes('perContractAuthoritySumWithOverlap')),
    `expected an error naming perContractAuthoritySumWithOverlap, got: ${JSON.stringify(errors)}`,
  )
})

test('equality between the two authority-count fields is valid, not rejected', () => {
  const equalArtifact = {
    ...fullyPopulatedArtifact(),
    distinctGlobalAuthorityCount: 3,
    perContractAuthoritySumWithOverlap: 3,
  }

  assert.equal(validateArtifact(equalArtifact).valid, true)
})

test('validateArtifact never throws for null, undefined, or a partial object', () => {
  assert.doesNotThrow(() => validateArtifact(null))
  assert.doesNotThrow(() => validateArtifact(undefined))
  assert.doesNotThrow(() => validateArtifact({}))
  assert.doesNotThrow(() => validateArtifact('not an object'))
  assert.doesNotThrow(() => validateArtifact(42))

  assert.equal(validateArtifact(null).valid, false)
  assert.equal(validateArtifact(undefined).valid, false)
  assert.equal(validateArtifact({}).valid, false)
})

test('overlap trap: one authority delegating to two contracts makes the per-contract sum exceed the global union (hand-written literals, no RPC)', () => {
  const distinctGlobalAuthorityCount = unionAuthorities(overlapRecords).size
  const perContractAuthoritySumWithOverlap = overlapRecords.reduce(
    (sum, record) => sum + record.distinctAuthorities,
    0,
  )

  // Overlap is guaranteed by construction (0xauthorityb is in both records),
  // so a correct union-based count must already be strictly smaller than the
  // naive per-contract sum before either number ever reaches the artifact.
  assert.ok(distinctGlobalAuthorityCount < perContractAuthoritySumWithOverlap)

  const signalsByDelegate = new Map(
    overlapRecords.map((record) => {
      const signals = computeSignals(record)
      return [record.delegate, { ...signals, funded: null, sampled: 0, label: 'single-operator' }]
    }),
  )

  const scan = {
    fromBlock: 100,
    toBlock: 139,
    balanceBlock: 139,
    type4TxCount: 7,
    authorizationCount: 7,
    recoveryFailureCount: 0,
    unsampledContracts: 0,
    distinctGlobalAuthorityCount,
    perContractAuthoritySumWithOverlap,
  }

  const artifact = buildArtifact(scan, overlapRecords, signalsByDelegate)

  assert.equal(artifact.schemaVersion, ARTIFACT_VERSION)
  assert.equal(artifact.distinctGlobalAuthorityCount, distinctGlobalAuthorityCount)
  assert.equal(artifact.perContractAuthoritySumWithOverlap, perContractAuthoritySumWithOverlap)
  assert.ok(artifact.perContractAuthoritySumWithOverlap > artifact.distinctGlobalAuthorityCount)
  assert.deepEqual(validateArtifact(artifact), { valid: true, errors: [] })
})

test('buildArtifact reports funded: null for an unmeasured contract (sampled: 0, ranked below TOP_N)', () => {
  const record = {
    delegate: '0xunmeasured',
    authorizations: 12,
    distinctAuthorities: 3,
    relayers: new Set(['0xrelayer1']),
    nonces: [0, 1, 2],
    authorities: new Set(['0xauthoritya', '0xauthorityb', '0xauthorityc']),
  }
  const signals = computeSignals(record)
  const signalsByDelegate = new Map([
    [record.delegate, { ...signals, funded: null, sampled: 0, label: 'single-operator' }],
  ])
  const scan = {
    fromBlock: 1,
    toBlock: 10,
    balanceBlock: 10,
    type4TxCount: 12,
    authorizationCount: 12,
    recoveryFailureCount: 0,
    unsampledContracts: 0,
    distinctGlobalAuthorityCount: 3,
    perContractAuthoritySumWithOverlap: 3,
  }

  const artifact = buildArtifact(scan, [record], signalsByDelegate)

  assert.equal(artifact.contracts[0].funded, null)
  assert.equal(artifact.contracts[0].sampled, 0)
  assert.equal(validateArtifact(artifact).valid, true)
})

test('buildArtifact reports funded: 0 (measured zero), not null, for a TOP_N sampled contract with no funded wallets', () => {
  const record = {
    delegate: '0xsampledzero',
    authorizations: 12,
    distinctAuthorities: 3,
    relayers: new Set(['0xrelayer1']),
    nonces: [0, 1, 2],
    authorities: new Set(['0xauthoritya', '0xauthorityb', '0xauthorityc']),
  }
  const signals = computeSignals(record)
  const signalsByDelegate = new Map([
    [record.delegate, { ...signals, funded: 0, sampled: 100, label: 'single-operator' }],
  ])
  const scan = {
    fromBlock: 1,
    toBlock: 10,
    balanceBlock: 10,
    type4TxCount: 12,
    authorizationCount: 12,
    recoveryFailureCount: 0,
    unsampledContracts: 0,
    distinctGlobalAuthorityCount: 3,
    perContractAuthoritySumWithOverlap: 3,
  }

  const artifact = buildArtifact(scan, [record], signalsByDelegate)

  assert.equal(artifact.contracts[0].funded, 0)
  assert.ok(artifact.contracts[0].sampled > 0)
  assert.equal(validateArtifact(artifact).valid, true)
})

// Structural guard, same pattern as no-recovery-cap.test.mjs / no-risk-score
// (Phase 4): proves the artifact layer never carries a 0-100 risk score by
// inspecting the source itself, so the property holds for every field name
// ever declared here, not only the ones exercised above.
test('source-level guard: schema.mjs and validate.mjs never declare a risk/score/threat-named field', () => {
  const schemaSource = readFileSync(new URL('../../src/artifact/schema.mjs', import.meta.url), 'utf8')
  const validateSource = readFileSync(
    new URL('../../src/artifact/validate.mjs', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(schemaSource, /\b(risk|score|threat)[A-Za-z]*\s*[:=]/i)
  assert.doesNotMatch(validateSource, /\b(risk|score|threat)[A-Za-z]*\s*[:=]/i)
})
