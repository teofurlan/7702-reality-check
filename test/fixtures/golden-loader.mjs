// Shared test helper — loads the committed golden fixture files into the
// `recorded` map shape `createFixtureRpc` expects. Not a test file itself
// (excluded from `npm test`'s `test/**/*.test.mjs` glob by its name), reused
// by both `test/scan/golden-fixture.test.mjs` and
// `test/artifact/pipeline-emission.test.mjs` so the two tests can never load
// the fixture two different, potentially divergent, ways.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rpcKey } from '../../src/scan/rpc.mjs'
import { blockNumbersInRange } from '../../src/scan/blocks.mjs'

const GOLDEN_DIR = fileURLToPath(new URL('./golden/', import.meta.url))
const GOLDEN_RANGE_FILE = fileURLToPath(new URL('./golden-range.json', import.meta.url))

/** @returns {{ fromBlock: number, toBlock: number }} */
export function loadGoldenRange() {
  return JSON.parse(readFileSync(GOLDEN_RANGE_FILE, 'utf8'))
}

/**
 * Reads every committed `test/fixtures/golden/` file for the pinned range and
 * builds the `Record<rpcKey, unknown>` map `createFixtureRpc` consumes. Each
 * file is the real, unedited (mechanically pruned only) JSON-RPC response
 * captured by `scripts/capture-fixture.mjs` — this loader only unwraps
 * `.result`, exactly as the live adapter (`rpc-live.mjs`) does at runtime.
 *
 * @returns {{ fromBlock: number, toBlock: number, recorded: Record<string, unknown> }}
 */
export function loadGoldenRecorded() {
  const { fromBlock, toBlock } = loadGoldenRange()
  const recorded = {}

  for (const blockNumber of blockNumbersInRange(fromBlock, toBlock)) {
    const hexBlock = `0x${blockNumber.toString(16)}`
    const call = { method: 'eth_getBlockByNumber', params: [hexBlock, true] }
    const fileName = `eth_getBlockByNumber-${hexBlock}.json`
    const raw = JSON.parse(readFileSync(`${GOLDEN_DIR}${fileName}`, 'utf8'))
    recorded[rpcKey(call)] = raw.result
  }

  return { fromBlock, toBlock, recorded }
}

export function goldenDir() {
  return GOLDEN_DIR
}
