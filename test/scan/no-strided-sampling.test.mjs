import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blockNumbersInRange } from '../../src/scan/blocks.mjs'
import { tallyBlocks } from '../../src/scan/tally.mjs'
import { redelegationRatio } from '../../src/signals/signals.mjs'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/traps/strided-sampling.json', import.meta.url)),
)

// This trap fixture is synthetic and carries a fixture-only proxy identity
// (`authorityHint`) instead of real signed authorization tuples, purely to
// exercise the block-sampling seam under test: `blockNumbersInRange` and
// `tallyBlocks`. No real signature recovery is involved here, and none is
// needed to prove the sampling defect. The ratio itself, however, is now the
// real production `redelegationRatio` from Phase 4 — this was a local
// one-line duplicate of that formula until `src/signals/signals.mjs` existed;
// a duplicated formula could drift silently and let this trap pass while
// production is wrong, which is exactly the failure class this trap guards
// against.
function redelegationRatioOf(tuples) {
  const distinct = new Set(tuples.map((tuple) => tuple.authorityHint))
  return redelegationRatio(tuples.length, distinct.size)
}

function blocksAt(blockNumbers) {
  const wanted = new Set(blockNumbers)
  return fixture.blocks.filter((block) => wanted.has(parseInt(block.number, 16)))
}

test('redelegationRatio over the full contiguous range exceeds the every-10th-block strided subset', () => {
  const fullRange = blockNumbersInRange(fixture.fromBlock, fixture.toBlock)
  const stridedSubset = fullRange.filter((blockNumber) => blockNumber % 10 === 0)

  const fullTally = tallyBlocks(blocksAt(fullRange))
  const stridedTally = tallyBlocks(blocksAt(stridedSubset))

  const fullRatio = redelegationRatioOf(fullTally.byDelegate.get(fixture.delegate).tuples)
  const stridedRatio = redelegationRatioOf(stridedTally.byDelegate.get(fixture.delegate).tuples)

  assert.ok(
    fullRatio > stridedRatio,
    `expected contiguous ratio (${fullRatio}) > strided ratio (${stridedRatio})`,
  )
})

test('the strided subset observes strictly fewer occurrences of the repeated authority than the full range', () => {
  const fullRange = blockNumbersInRange(fixture.fromBlock, fixture.toBlock)
  const stridedSubset = fullRange.filter((blockNumber) => blockNumber % 10 === 0)

  const fullTally = tallyBlocks(blocksAt(fullRange))
  const stridedTally = tallyBlocks(blocksAt(stridedSubset))

  assert.equal(fullTally.byDelegate.get(fixture.delegate).authorizations, 10)
  assert.equal(stridedTally.byDelegate.get(fixture.delegate).authorizations, 1)
})

test('blockNumbersInRange exposes no stride/step parameter that could be used to reproduce this trap directly', () => {
  assert.equal(blockNumbersInRange.length, 2)
})
