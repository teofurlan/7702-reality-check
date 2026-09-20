import { chunk } from './blocks.mjs'

const BALANCE_CHUNK_SIZE = 50
const DEFAULT_SAMPLE_SIZE = 100

/**
 * Samples on-chain balances for at most `sampleSize` addresses (default 100,
 * the cap README.md declares under "Honest limits"), batching
 * `eth_getBalance` calls at 50 per round trip. The block
 * tag is always the pinned hex value the caller passes in — never the
 * unpinned head-tracking string — so a re-run of the same window is
 * reproducible and the recorded value is honest rather than a snapshot of an
 * unnamed moment (design.md decision 6).
 *
 * A `null`/`undefined`/non-hex `eth_getBalance` result (a real thing a public
 * RPC returns, e.g. for an address it cannot serve at the pinned height) is
 * treated as UNRESOLVED rather than thrown: `BigInt(null)` throws a
 * TypeError, and letting that escape here would kill an entire production
 * run near its end, after 20+ minutes of scanning. An unresolved address is
 * simply left out of the returned map — never recorded as a fabricated zero
 * balance — and counted so the caller can size its denominator correctly.
 *
 * `delayMs` (default `0`) waits between `eth_getBalance` batches, mirroring
 * `scanRange`'s own `delayMs` (same shape, same rationale). The default is
 * `0` — no pacing — so every existing test and the offline fixture path stay
 * instant; a real production run passes a positive value (see
 * `scripts/measure.mjs`) because this phase fires its 50-address batches
 * back to back for every classifiable contract, against a free public RPC
 * quota the scan itself has already largely spent pacing its own requests.
 *
 * @param {{ rpc: import('./rpc.mjs').RpcAdapter, addresses: string[],
 *           blockTag: string, sampleSize?: number, delayMs?: number }} params
 * @returns {Promise<{ balances: Map<string, bigint>, unresolved: number }>}
 */
export async function sampleBalances({ rpc, addresses, blockTag, sampleSize = DEFAULT_SAMPLE_SIZE, delayMs = 0 }) {
  const sampled = addresses.slice(0, sampleSize)
  const balances = new Map()
  let unresolved = 0

  let isFirstBatch = true
  for (const batch of chunk(sampled, BALANCE_CHUNK_SIZE)) {
    if (!isFirstBatch && delayMs > 0) {
      await sleep(delayMs)
    }
    isFirstBatch = false

    const calls = batch.map((address) => ({
      method: 'eth_getBalance',
      params: [address, blockTag],
    }))
    const results = await rpc(calls)
    batch.forEach((address, index) => {
      const result = results[index]
      if (typeof result !== 'string' || !result.startsWith('0x')) {
        unresolved += 1
        return
      }
      balances.set(address, BigInt(result))
    })
  }

  return { balances, unresolved }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
