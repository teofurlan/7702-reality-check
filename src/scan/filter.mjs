/**
 * @typedef {{ address: string, chainId: unknown, nonce: unknown, r: string, s: string, yParity: unknown }} AuthorizationTuple
 * @typedef {{ type: string, from?: string, authorizationList?: AuthorizationTuple[] }} Transaction
 * @typedef {{ transactions?: Transaction[] }} Block
 */

/**
 * Returns only the type-4 (EIP-7702) transactions in a block. Never reads
 * or returns `tx.from` — `tx.from` is the relayer that broadcast the
 * transaction, never the delegating authority.
 *
 * @param {Block} block
 * @returns {Transaction[]}
 */
export function type4Transactions(block) {
  return (block.transactions ?? []).filter((tx) => tx.type === '0x4')
}

/**
 * Returns a type-4 transaction's authorization tuples unchanged.
 *
 * @param {Transaction} tx
 * @returns {AuthorizationTuple[]}
 */
export function authorizationsOf(tx) {
  return tx.authorizationList ?? []
}
