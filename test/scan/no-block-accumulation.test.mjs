import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scanRange } from '../../src/scan/scan.mjs'
import { createTally, addBlocksToTally, tallyBlocks } from '../../src/scan/tally.mjs'

const DELEGATE = `0x${'d'.repeat(40)}`
const RELAYER = `0x${'f'.repeat(40)}`

/**
 * Builds a single type-4 block carrying exactly one authorization tuple for
 * `DELEGATE`, relayed by `RELAYER`. The tuple's `r`/`s` values are borrowed
 * from the committed `tx-from-not-authority` trap fixture — they never need
 * to recover to a real signer here, since `recoverAuthorities` always
 * catches per-tuple recovery failures and this suite never inspects
 * `records`, only the pre-recovery tally counters.
 *
 * @param {number} blockNumber
 * @returns {import('../../src/scan/filter.mjs').Block & { number: string }}
 */
function buildType4Block(blockNumber) {
  return {
    number: `0x${blockNumber.toString(16)}`,
    transactions: [
      {
        type: '0x4',
        from: RELAYER,
        authorizationList: [
          {
            address: DELEGATE,
            chainId: '0x1',
            nonce: `0x${blockNumber.toString(16)}`,
            r: '0x1111111111111111111111111111111111111111111111111111111111111111',
            s: '0x2222222222222222222222222222222222222222222222222222222222222222',
            yParity: '0x0',
          },
        ],
      },
    ],
  }
}

/**
 * An `rpc` adapter that behaves like a well-formed one on each individual
 * call, but invalidates the previous batch of block objects it handed back
 * as soon as the next batch is produced (by truncating their `transactions`
 * arrays in place). This encodes the contract that a chunk of fetched blocks
 * MUST be folded into the running tally before the next chunk is fetched:
 * any caller that instead accumulates raw block references across chunks
 * (e.g. `blocks.push(...results)`) and tallies once at the end will observe
 * only the last chunk's transactions, because every earlier chunk's blocks
 * were mutated out from under it.
 *
 * @returns {import('../../src/scan/rpc.mjs').RpcAdapter}
 */
function createInvalidatingRpc() {
  let previousBatch = null

  return async function invalidatingRpc(calls) {
    const batch = calls.map((call) => {
      const blockNumber = parseInt(call.params[0], 16)
      return buildType4Block(blockNumber)
    })

    if (previousBatch) {
      for (const block of previousBatch) {
        block.transactions.length = 0
      }
    }
    previousBatch = batch

    return batch
  }
}

test('scanRange folds every chunk into the tally before the next chunk is fetched, across 3+ chunks', async () => {
  const fromBlock = 1
  const toBlock = 30 // 3 chunks of 10 at the current BLOCK_CHUNK_SIZE
  const rpc = createInvalidatingRpc()

  const result = await scanRange({ rpc, fromBlock, toBlock })

  // One type-4 tx with one authorization tuple per block, in every chunk.
  // Under the current accumulate-then-tally implementation, only the final
  // chunk's blocks still have live transactions by the time `tallyBlocks`
  // runs (every earlier chunk was invalidated by this adapter), so this
  // would observe far fewer than 30.
  assert.equal(result.tally.type4TxCount, 30)
  assert.equal(result.tally.authorizationCount, 30)
})

test('scanRange still works with delayMs unset (default path stays instant and offline)', async () => {
  const fromBlock = 1
  const toBlock = 20 // 2 chunks of 10 at the current BLOCK_CHUNK_SIZE
  const rpc = createInvalidatingRpc()

  const start = Date.now()
  const result = await scanRange({ rpc, fromBlock, toBlock })
  const elapsedMs = Date.now() - start

  assert.equal(result.tally.type4TxCount, 20)
  assert.equal(result.tally.authorizationCount, 20)
  // No pacing delay was requested, so this must not silently wait between
  // chunks — a regression here would slow down every test in the suite.
  assert.ok(elapsedMs < 500, `expected the default (no-delay) path to be fast, took ${elapsedMs}ms`)
})

test('scanRange awaits delayMs between block chunks when a positive delay is requested', async () => {
  const fromBlock = 1
  const toBlock = 20 // 2 chunks of 10 at the current BLOCK_CHUNK_SIZE
  const rpc = createInvalidatingRpc()
  const delayMs = 50

  const start = Date.now()
  await scanRange({ rpc, fromBlock, toBlock, delayMs })
  const elapsedMs = Date.now() - start

  // Only one inter-chunk gap for 2 chunks; allow slack for scheduler jitter.
  assert.ok(elapsedMs >= delayMs, `expected at least ${delayMs}ms elapsed with an inter-chunk delay, took ${elapsedMs}ms`)
})

test('scan.mjs never spread-accumulates chunk results into a growing array', () => {
  const source = readFileSync(new URL('../../src/scan/scan.mjs', import.meta.url), 'utf8')

  // Structural, not behavioural: this is the actual shape of the memory
  // leak (retaining every raw block object for the whole range), and no
  // fixed-size behavioural fixture could prove its absence at every range
  // size the way this source-level check does.
  assert.equal(/push\(\s*\.\.\./.test(source), false)
})

test('createTally + addBlocksToTally over two halves equals tallyBlocks over the whole list', () => {
  const blocks = Array.from({ length: 10 }, (_, index) => buildType4Block(index + 1))
  const half = 5

  const incremental = createTally()
  addBlocksToTally(incremental, blocks.slice(0, half))
  addBlocksToTally(incremental, blocks.slice(half))

  const whole = tallyBlocks(blocks)

  assert.equal(incremental.fromBlock, whole.fromBlock)
  assert.equal(incremental.toBlock, whole.toBlock)
  assert.equal(incremental.type4TxCount, whole.type4TxCount)
  assert.equal(incremental.authorizationCount, whole.authorizationCount)

  assert.deepEqual([...incremental.byDelegate.keys()].sort(), [...whole.byDelegate.keys()].sort())

  for (const delegate of whole.byDelegate.keys()) {
    const incrementalContract = incremental.byDelegate.get(delegate)
    const wholeContract = whole.byDelegate.get(delegate)

    assert.equal(incrementalContract.authorizations, wholeContract.authorizations)
    assert.deepEqual(
      [...incrementalContract.relayers].sort(),
      [...wholeContract.relayers].sort(),
    )
    assert.equal(incrementalContract.tuples.length, wholeContract.tuples.length)
  }
})
