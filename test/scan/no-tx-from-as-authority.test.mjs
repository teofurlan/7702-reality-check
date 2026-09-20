import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tallyBlocks } from '../../src/scan/tally.mjs'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/traps/tx-from-not-authority.json', import.meta.url)),
)

test('tallyBlocks keeps tx.from in relayers, never inside a contract\'s raw authorization tuples', () => {
  const tally = tallyBlocks(fixture.blocks)
  const contractTally = tally.byDelegate.get(fixture.delegate)

  assert.ok(contractTally.relayers.has(fixture.relayer))

  const tupleValues = contractTally.tuples.flatMap((tuple) => Object.values(tuple))
  assert.ok(!tupleValues.includes(fixture.relayer))
})

test('ContractTally exposes no authority-like field that tx.from could be miscounted into', () => {
  const tally = tallyBlocks(fixture.blocks)
  const contractTally = tally.byDelegate.get(fixture.delegate)

  assert.deepEqual(
    Object.keys(contractTally).sort(),
    ['authorizations', 'delegate', 'firstBlock', 'relayers', 'tuples'],
  )
})
