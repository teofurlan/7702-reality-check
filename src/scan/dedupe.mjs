/**
 * @typedef {{ delegate: string, authorizations: number, distinctAuthorities: number,
 *             relayers: Set<string>, nonces: number[], authorities: Set<string> }} ContractRecord
 */

/**
 * Global union of every contract's recovered-authority set, accumulated
 * directly across all contracts. Never derive this by summing each
 * contract's own `distinctAuthorities` count — an authority that delegated
 * to more than one contract would be double-counted (Trap C, exercised
 * end-to-end against `scanRange` in PR 3).
 *
 * @param {ContractRecord[]} records
 * @returns {Set<string>}
 */
export function unionAuthorities(records) {
  const union = new Set()
  for (const record of records) {
    for (const authority of record.authorities) {
      union.add(authority)
    }
  }
  return union
}
