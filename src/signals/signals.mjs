/**
 * @typedef {{ authorizations: number, distinctAuthorities: number, relayers: Set<string>,
 *             nonces: number[], funded?: number | null, sampled?: number }} SignalRecord
 * @typedef {{ relayerDiversity: number, redelegationRatio: number, medianNonce: number,
 *             fundedRatio: number | null }} Signals
 */

/**
 * Authorizations divided by distinct recovered authorities. Never divides by
 * zero: a contract with authorizations but zero recovered authorities (never
 * expected in practice) falls back to a denominator of 1 rather than NaN.
 *
 * @param {number} authorizations
 * @param {number} distinctAuthorities
 * @returns {number}
 */
export function redelegationRatio(authorizations, distinctAuthorities) {
  return authorizations / Math.max(distinctAuthorities, 1)
}

/**
 * Share of sampled authorities holding a balance. `null` — never `0` — when
 * the contract was outside the balance-sampled group (`sampled === 0`). A
 * measured zero (`funded === 0` with `sampled > 0`) means something different
 * from an unmeasured contract, and this function preserves that distinction.
 *
 * @param {number | null} funded
 * @param {number} sampled
 * @returns {number | null}
 */
export function fundedRatio(funded, sampled) {
  return sampled > 0 ? funded / sampled : null
}

/**
 * Median of a list of nonces. Callers pass `recoverAuthorities`'s already
 * ascending-sorted `nonces` array; this function does not mutate its input.
 *
 * @param {number[]} sortedNonces
 * @returns {number}
 */
function medianOf(sortedNonces) {
  if (sortedNonces.length === 0) return 0
  const mid = Math.floor(sortedNonces.length / 2)
  return sortedNonces.length % 2 === 0
    ? (sortedNonces[mid - 1] + sortedNonces[mid]) / 2
    : sortedNonces[mid]
}

/**
 * Computes the four behavioral signals documented in README.md, purely from scan
 * output — no RPC calls, no I/O. `funded`/`sampled` default to the unmeasured
 * state (`null`/`0`) so a record built before balance sampling still yields a
 * correct `fundedRatio === null`, never a false `0`.
 *
 * @param {SignalRecord} record
 * @returns {Signals}
 */
export function computeSignals(record) {
  const { authorizations, distinctAuthorities, relayers, nonces, funded = null, sampled = 0 } = record

  return {
    relayerDiversity: relayers.size,
    redelegationRatio: redelegationRatio(authorizations, distinctAuthorities),
    medianNonce: medianOf(nonces),
    fundedRatio: fundedRatio(funded, sampled),
  }
}
