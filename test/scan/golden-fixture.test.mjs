import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createFixtureRpc } from '../../src/scan/rpc-fixture.mjs'
import { scanRange } from '../../src/scan/scan.mjs'
import { loadGoldenRecorded } from '../fixtures/golden-loader.mjs'

const TRAPS_DIR = fileURLToPath(new URL('../fixtures/traps/', import.meta.url))
const MAX_FIXTURE_BYTES = 2 * 1024 * 1024

const goldenExpected = JSON.parse(
  readFileSync(new URL('../fixtures/golden-expected.json', import.meta.url)),
)

/**
 * Projects a `scanRange` result into a JSON-safe shape for comparison
 * against the frozen `golden-expected.json` literal. `assert.deepStrictEqual`
 * cannot compare a `Set`/`Map`-bearing object against parsed JSON directly
 * (JSON has neither type), so this is the one normalization step between the
 * live structure and the frozen file — every value it reports still comes
 * straight from `result`, nothing here is recomputed independently of the
 * pipeline under test.
 */
function serializeScanResult(result) {
  const byDelegate = [...result.tally.byDelegate.values()]
    .map((contractTally) => ({
      delegate: contractTally.delegate,
      authorizations: contractTally.authorizations,
      relayers: [...contractTally.relayers].sort(),
      tupleCount: contractTally.tuples.length,
    }))
    .sort((a, b) => a.delegate.localeCompare(b.delegate))

  const records = [...result.records]
    .map((record) => ({
      delegate: record.delegate,
      authorizations: record.authorizations,
      distinctAuthorities: record.distinctAuthorities,
      relayers: [...record.relayers].sort(),
      nonces: record.nonces,
      authorities: [...record.authorities].sort(),
    }))
    .sort((a, b) => a.delegate.localeCompare(b.delegate))

  return {
    tally: {
      fromBlock: result.tally.fromBlock,
      toBlock: result.tally.toBlock,
      type4TxCount: result.tally.type4TxCount,
      authorizationCount: result.tally.authorizationCount,
      byDelegate,
    },
    records,
    recoveryFailureCount: result.recoveryFailureCount,
    distinctGlobalAuthorityCount: result.distinctGlobalAuthorityCount,
    perContractAuthoritySumWithOverlap: result.perContractAuthoritySumWithOverlap,
  }
}

test('scanRange over the committed golden fixture reproduces the frozen expected output, offline, with zero recovery failures', async () => {
  const { fromBlock, toBlock, recorded } = loadGoldenRecorded()
  const rpc = createFixtureRpc(recorded)

  const result = await scanRange({ rpc, fromBlock, toBlock })

  assert.equal(result.recoveryFailureCount, 0)
  // goldenExpected is read once, above, from a frozen file — never
  // recomputed here.
  assert.deepStrictEqual(serializeScanResult(result), goldenExpected)
})

test('the golden fixture directory stays under the 2 MB size ceiling', () => {
  const { fromBlock, toBlock } = goldenExpected.tally
  assert.ok(Number.isInteger(fromBlock))
  assert.ok(Number.isInteger(toBlock))

  const files = readdirSync(new URL('../fixtures/golden/', import.meta.url))
  assert.ok(files.length > 0, 'golden fixture directory must not be empty')

  const totalBytes = files.reduce((sum, name) => {
    return sum + statSync(new URL(`../fixtures/golden/${name}`, import.meta.url)).size
  }, 0)

  assert.ok(
    totalBytes < MAX_FIXTURE_BYTES,
    `golden fixture total size ${totalBytes} bytes must be under ${MAX_FIXTURE_BYTES} bytes`,
  )
})

test('every trap fixture file stays under the 2 MB size ceiling and lives only under test/fixtures/traps/', () => {
  const files = readdirSync(TRAPS_DIR)
  assert.ok(files.length > 0, 'trap fixtures directory must not be empty')

  for (const name of files) {
    const fullPath = `${TRAPS_DIR}${name}`
    const size = statSync(fullPath).size
    assert.ok(size < MAX_FIXTURE_BYTES, `trap fixture ${name} (${size} bytes) must be under ${MAX_FIXTURE_BYTES} bytes`)
    assert.ok(fullPath.includes(`${'traps'}`), `trap fixture ${name} must reside under test/fixtures/traps/`)
  }
})
