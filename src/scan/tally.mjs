import { type4Transactions, authorizationsOf } from './filter.mjs'

/**
 * @typedef {{ delegate: string, authorizations: number, relayers: Set<string>,
 *             tuples: import('./filter.mjs').AuthorizationTuple[], firstBlock: number }} ContractTally
 * @typedef {{ fromBlock: number, toBlock: number, type4TxCount: number,
 *             authorizationCount: number, byDelegate: Map<string, ContractTally> }} ScanTally
 */

/**
 * Builds a fresh, empty `ScanTally` accumulator. Callers fold one or more
 * batches of blocks into it via `addBlocksToTally`, which lets a scan tally
 * each chunk as it arrives instead of retaining every block in memory for
 * the whole range (see `scan.mjs`).
 *
 * @returns {ScanTally}
 */
export function createTally() {
  return {
    fromBlock: undefined,
    toBlock: undefined,
    type4TxCount: 0,
    authorizationCount: 0,
    byDelegate: new Map(),
  }
}

/**
 * Folds one batch of blocks into an existing `ScanTally`, in place. This is
 * the entire per-block tallying body: `tallyBlocks` below is just this
 * function applied once to a whole block list, and `scan.mjs` calls it once
 * per fetched chunk so raw block objects never need to be accumulated
 * across chunks. `tx.from` is tracked only as a relayer, in a separate
 * `relayers` set — it is never read as, stored as, or counted as an
 * authority anywhere in this function.
 *
 * @param {ScanTally} tally
 * @param {import('./filter.mjs').Block[]} blocks
 * @returns {void}
 */
export function addBlocksToTally(tally, blocks) {
  for (const block of blocks) {
    const blockNumber = parseInt(block.number, 16)
    tally.fromBlock = tally.fromBlock === undefined ? blockNumber : Math.min(tally.fromBlock, blockNumber)
    tally.toBlock = tally.toBlock === undefined ? blockNumber : Math.max(tally.toBlock, blockNumber)

    for (const tx of type4Transactions(block)) {
      tally.type4TxCount++
      const relayer = tx.from?.toLowerCase()

      for (const tuple of authorizationsOf(tx)) {
        tally.authorizationCount++
        const delegate = tuple.address?.toLowerCase()
        if (!delegate) continue

        let contractTally = tally.byDelegate.get(delegate)
        if (!contractTally) {
          contractTally = {
            delegate,
            authorizations: 0,
            relayers: new Set(),
            tuples: [],
            firstBlock: blockNumber,
          }
          tally.byDelegate.set(delegate, contractTally)
        }

        contractTally.authorizations++
        if (relayer) contractTally.relayers.add(relayer)
        contractTally.tuples.push(tuple)
      }
    }
  }
}

/**
 * Tallies type-4 transactions and their raw authorization tuples per
 * delegate contract, counted BEFORE any authority recovery, over a whole
 * block list at once. Kept as a thin wrapper over `createTally` +
 * `addBlocksToTally` so both entry points share one counting body and can
 * never drift apart.
 *
 * @param {import('./filter.mjs').Block[]} blocks
 * @returns {ScanTally}
 */
export function tallyBlocks(blocks) {
  const tally = createTally()
  addBlocksToTally(tally, blocks)
  return tally
}
