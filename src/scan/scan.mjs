import { blockNumbersInRange, chunk } from './blocks.mjs'
import { createTally, addBlocksToTally } from './tally.mjs'
import { recoverAuthorities } from './recover.mjs'
import { unionAuthorities } from './dedupe.mjs'

const BLOCK_CHUNK_SIZE = 10

/**
 * @typedef {import('./dedupe.mjs').ContractRecord} ContractRecord
 */

/**
 * Orchestrates a full contiguous-window scan: fetches every block in
 * `fromBlock..toBlock` through the injected `rpc` adapter, tallies type-4
 * transactions and their raw authorization tuples per delegate contract
 * (before any recovery), recovers each contract's authorities with no
 * truncation, and computes the global distinct-authority count as a direct
 * union across all contracts — never as a sum of per-contract counts.
 *
 * Each fetched chunk is folded into the running tally with `addBlocksToTally`
 * immediately and then released — there is no array that accumulates raw
 * block objects across chunks. A mainnet block is roughly 590 KB of JSON, so
 * retaining every block for a multi-thousand-block window would exhaust
 * Node's default heap; folding per chunk instead bounds peak memory to one
 * chunk's worth of blocks, regardless of range size. Only the small
 * authorization tuples the tally keeps survive past their chunk.
 *
 * `perContractAuthoritySumWithOverlap` and `distinctGlobalAuthorityCount` are
 * kept as two distinct fields on purpose: their difference measures
 * cross-contract delegation overlap. Equality is a valid outcome (no
 * authority in the window delegated to more than one contract); only a
 * strict `<` proves overlap was observed.
 *
 * `delayMs` (default `0`) waits between block chunks, never within one. The
 * default is `0` — no pacing — so every existing test and the offline
 * fixture path stay instant; a real production run against a free public
 * RPC passes a positive value (see `scripts/measure.mjs`) to avoid tripping
 * that provider's rate limiting across ~300 batched requests.
 *
 * @param {{ rpc: import('./rpc.mjs').RpcAdapter, fromBlock: number, toBlock: number,
 *           delayMs?: number }} params
 * @returns {Promise<{
 *   tally: import('./tally.mjs').ScanTally,
 *   records: ContractRecord[],
 *   recoveryFailureCount: number,
 *   distinctGlobalAuthorityCount: number,
 *   perContractAuthoritySumWithOverlap: number,
 * }>}
 */
export async function scanRange({ rpc, fromBlock, toBlock, delayMs = 0 }) {
  const blockNumbers = blockNumbersInRange(fromBlock, toBlock)
  const tally = createTally()

  let isFirstChunk = true
  for (const batch of chunk(blockNumbers, BLOCK_CHUNK_SIZE)) {
    if (!isFirstChunk && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    isFirstChunk = false

    const calls = batch.map((blockNumber) => ({
      method: 'eth_getBlockByNumber',
      params: [`0x${blockNumber.toString(16)}`, true],
    }))
    const results = await rpc(calls)
    addBlocksToTally(tally, results)
  }

  const records = []
  let recoveryFailureCount = 0
  let perContractAuthoritySumWithOverlap = 0

  for (const contractTally of tally.byDelegate.values()) {
    const { authorities, nonces, failures } = await recoverAuthorities(contractTally.tuples)
    recoveryFailureCount += failures
    perContractAuthoritySumWithOverlap += authorities.size

    records.push({
      delegate: contractTally.delegate,
      authorizations: contractTally.authorizations,
      distinctAuthorities: authorities.size,
      relayers: contractTally.relayers,
      nonces,
      authorities,
    })
  }

  const distinctGlobalAuthorityCount = unionAuthorities(records).size

  return {
    tally,
    records,
    recoveryFailureCount,
    distinctGlobalAuthorityCount,
    perContractAuthoritySumWithOverlap,
  }
}
