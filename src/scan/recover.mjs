import { recoverAuthorizationAddress } from 'viem/utils'

/**
 * Thrown by `recoverAuthorities` only when `maxTuples` is explicitly set and
 * the input array exceeds it. There is no default limit: an unset `maxTuples`
 * never throws, no matter how large the input is.
 */
export class RecoveryLimitExceededError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'RecoveryLimitExceededError'
  }
}

function toNumber(value) {
  return typeof value === 'string' ? parseInt(value, 16) : value
}

/**
 * Recovers the authority address for every authorization tuple, sequentially
 * and with no truncation of the input list. A per-tuple recovery failure
 * (throw or rejection) increments `failures` — it is never discarded via a
 * bare `catch {}` that drops the count. There is no `slice(0, N)` anywhere in
 * this function: the only way to bound the input is the explicit `maxTuples`
 * option, which throws `RecoveryLimitExceededError` instead of silently
 * dropping tuples.
 *
 * @param {import('./filter.mjs').AuthorizationTuple[]} tuples
 * @param {{ maxTuples?: number }} [options]
 * @returns {Promise<{ authorities: Set<string>, nonces: number[], failures: number }>}
 */
export async function recoverAuthorities(tuples, { maxTuples } = {}) {
  if (maxTuples !== undefined && tuples.length > maxTuples) {
    throw new RecoveryLimitExceededError(
      `recovery limit exceeded: ${tuples.length} tuples > maxTuples ${maxTuples}`,
    )
  }

  const authorities = new Set()
  const nonces = []
  let failures = 0

  for (const tuple of tuples) {
    try {
      const authority = await recoverAuthorizationAddress({
        authorization: {
          address: tuple.address,
          chainId: toNumber(tuple.chainId),
          nonce: toNumber(tuple.nonce),
          r: tuple.r,
          s: tuple.s,
          yParity: toNumber(tuple.yParity),
        },
      })
      authorities.add(authority.toLowerCase())
      nonces.push(toNumber(tuple.nonce))
    } catch {
      failures++
    }
  }

  nonces.sort((a, b) => a - b)

  return { authorities, nonces, failures }
}
