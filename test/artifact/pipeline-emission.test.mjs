import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFixtureRpc } from '../../src/scan/rpc-fixture.mjs'
import { scanRange } from '../../src/scan/scan.mjs'
import { computeSignals } from '../../src/signals/signals.mjs'
import { isClassifiable } from '../../src/signals/threshold.mjs'
import { labelFor } from '../../src/signals/labels.mjs'
import { buildArtifact } from '../../src/artifact/schema.mjs'
import { validateArtifact } from '../../src/artifact/validate.mjs'
import { loadGoldenRecorded } from '../fixtures/golden-loader.mjs'

// The historical defect this project measures a corrected pipeline against:
// `confirm.mjs` sliced recovery at 3,000 tuples, so a fully-recovered
// contract's unique-authority count would suspiciously equal exactly 3,000
// (or one short, 2,999, from an off-by-one in the slice boundary). The
// golden window is far too small to ever hit that ceiling for real, but this
// guard makes the absence of the defect an explicit, checked assertion
// rather than an implicit one.
const HISTORICAL_CAP_VALUES = [3000, 2999]

test('running the full pipeline over the golden fixture range yields a valid artifact with zero recovery failures', async () => {
  const { fromBlock, toBlock, recorded } = loadGoldenRecorded()
  const rpc = createFixtureRpc(recorded)

  const scan = await scanRange({ rpc, fromBlock, toBlock })

  assert.equal(scan.recoveryFailureCount, 0)

  const signalsByDelegate = new Map()
  for (const record of scan.records) {
    const classifiable = isClassifiable(record)
    const signals = computeSignals(record)
    signalsByDelegate.set(record.delegate, {
      ...signals,
      funded: null,
      sampled: 0,
      label: classifiable ? labelFor(signals) : 'insufficient-volume',
    })
  }

  const artifact = buildArtifact(
    {
      fromBlock,
      toBlock,
      // Simulates the pinned near-head snapshot height `measure.mjs`
      // resolves after the scan completes — deliberately independent of
      // `fromBlock`/`toBlock`, which bound the historical scan window.
      balanceBlock: toBlock,
      type4TxCount: scan.tally.type4TxCount,
      authorizationCount: scan.tally.authorizationCount,
      recoveryFailureCount: scan.recoveryFailureCount,
      // No live balance sampling happens in this fixture-driven pipeline
      // test, so nothing was throttled into an unmeasured state.
      unsampledContracts: 0,
      distinctGlobalAuthorityCount: scan.distinctGlobalAuthorityCount,
      perContractAuthoritySumWithOverlap: scan.perContractAuthoritySumWithOverlap,
    },
    scan.records,
    signalsByDelegate,
  )

  const { valid, errors } = validateArtifact(artifact)
  assert.deepStrictEqual(errors, [])
  assert.equal(valid, true)
  assert.equal(artifact.recoveryFailures, 0)

  for (const contract of artifact.contracts) {
    assert.ok(
      !HISTORICAL_CAP_VALUES.includes(contract.distinctAuthorities),
      `contract ${contract.delegate} distinctAuthorities (${contract.distinctAuthorities}) must not equal a historical hardcoded cap value`,
    )
  }
})
