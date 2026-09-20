import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createFixtureRpc } from '../../src/scan/rpc-fixture.mjs'
import { scanRange } from '../../src/scan/scan.mjs'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/traps/sum-as-global.json', import.meta.url)),
)

test('distinctGlobalAuthorityCount comes from a union, never a sum of per-contract sets (Trap C)', async () => {
  const rpc = createFixtureRpc(fixture.recorded)

  const result = await scanRange({ rpc, fromBlock: fixture.fromBlock, toBlock: fixture.toBlock })

  assert.equal(result.recoveryFailureCount, 0)
  assert.equal(result.records.length, 2)
  assert.equal(
    result.perContractAuthoritySumWithOverlap - result.distinctGlobalAuthorityCount,
    1,
  )
})
