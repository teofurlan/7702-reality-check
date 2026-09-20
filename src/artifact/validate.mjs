import { LABELS } from '../signals/labels.mjs'

const FORBIDDEN_FIELD_NAME = /^(risk|score|threat)/i

/**
 * @typedef {{ delegate: string, authorizations: number, distinctAuthorities: number,
 *             relayerDiversity: number, redelegationRatio: number, medianNonce: number,
 *             funded: number | null, sampled: number, totalEth: number,
 *             fundedRatio: number | null, label: string }} ArtifactContract
 * @typedef {{ schemaVersion: number, fromBlock: number, toBlock: number, balanceBlock: number,
 *             type4TxCount: number, authorizationCount: number, distinctDelegates: number,
 *             distinctGlobalAuthorityCount: number, perContractAuthoritySumWithOverlap: number,
 *             globalRedelegationRatio: number, recoveryFailures: number,
 *             contracts: ArtifactContract[] }} Artifact
 */

// Every one of these MUST be present and typed `number` on the top-level
// artifact. Listed in the exact names the spec and design.md freeze.
//
// `balanceBlock` is listed here deliberately separate from `fromBlock`/
// `toBlock`: those two bound the historical delegation scan window, while
// `balanceBlock` is the near-head height the balance snapshot was pinned to.
// Conflating them would misreport WHEN the money was observed — balances can
// only be read within ~64 blocks of chain head, while the scan window can be
// (and usually is) thousands of blocks in the past by the time it finishes.
const REQUIRED_NUMBER_FIELDS = [
  'schemaVersion',
  'fromBlock',
  'toBlock',
  'balanceBlock',
  'type4TxCount',
  'authorizationCount',
  'distinctDelegates',
  'distinctGlobalAuthorityCount',
  'perContractAuthoritySumWithOverlap',
  'globalRedelegationRatio',
  'recoveryFailures',
  // A consumer reading a funded-ratio figure must be able to tell how much
  // of the classifiable set was actually measured — otherwise a heavily
  // rate-limited run (some contracts silently left `funded: null` after
  // exhausting their balance-sampling retries) looks identical to a clean
  // one with a genuinely low funded ratio.
  'unsampledContracts',
]

function forbiddenFieldErrors(record, prefix) {
  const errors = []
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_FIELD_NAME.test(key)) {
      errors.push(`${prefix}.${key} is a forbidden risk/score/threat-named field — labels describe behavior only`)
    }
  }
  return errors
}

function validateContract(contract, index) {
  const errors = []
  const prefix = `contracts[${index}]`

  if (contract === null || typeof contract !== 'object' || Array.isArray(contract)) {
    return [`${prefix} must be a non-null object`]
  }

  if (typeof contract.delegate !== 'string') {
    errors.push(`${prefix}.delegate must be a string`)
  }
  for (const field of ['authorizations', 'distinctAuthorities', 'relayerDiversity', 'redelegationRatio', 'medianNonce', 'sampled', 'totalEth']) {
    if (typeof contract[field] !== 'number') {
      errors.push(`${prefix}.${field} must be a number`)
    }
  }

  // `fundedRatio` follows the exact same nullable discipline as `funded`:
  // it describes a fraction of a denominator (`sampled`) that may itself be
  // zero, so `null` — never a computed `0` or `NaN` — is the only honest
  // value for a contract that was never balance-sampled.
  if (contract.fundedRatio !== null && typeof contract.fundedRatio !== 'number') {
    errors.push(`${prefix}.fundedRatio must be null or a number`)
  }

  // `funded` is the one nullable field on the whole schema: it is `null`
  // exactly when `sampled === 0` (unmeasured), never a default `0`. A
  // measured zero (`funded === 0`, `sampled > 0`) means something different
  // and must stay a number, never null.
  if (typeof contract.sampled === 'number') {
    if (contract.sampled === 0 && contract.funded !== null) {
      errors.push(`${prefix}.funded must be null when sampled === 0 (unmeasured), not a default 0`)
    }
    if (contract.sampled > 0 && typeof contract.funded !== 'number') {
      errors.push(`${prefix}.funded must be a number when sampled > 0 (measured)`)
    }
  } else if (contract.funded !== null && typeof contract.funded !== 'number') {
    errors.push(`${prefix}.funded must be a number or null`)
  }

  if (typeof contract.label !== 'string') {
    errors.push(`${prefix}.label must be a string`)
  } else if (!LABELS.includes(contract.label)) {
    errors.push(`${prefix}.label "${contract.label}" is outside the closed LABELS vocabulary`)
  }

  errors.push(...forbiddenFieldErrors(contract, prefix))

  return errors
}

/**
 * Validates a candidate measurement artifact against the frozen schema.
 * Never throws, for any input — including `null`, `undefined`, a string, a
 * number, or a partial object. Always returns `{ valid, errors }`.
 *
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateArtifact(candidate) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { valid: false, errors: ['artifact must be a non-null object'] }
  }

  const errors = []

  for (const field of REQUIRED_NUMBER_FIELDS) {
    if (typeof candidate[field] !== 'number') {
      errors.push(`missing or non-numeric required field: ${field}`)
    }
  }

  if (typeof candidate.schemaVersion === 'number' && candidate.schemaVersion < 1) {
    errors.push('schemaVersion must be >= 1')
  }

  if (!Array.isArray(candidate.contracts)) {
    errors.push('missing required field: contracts (array)')
  } else {
    candidate.contracts.forEach((contract, index) => {
      errors.push(...validateContract(contract, index))
    })
  }

  // The invariant at the heart of this schema: the per-contract sum may
  // double-count an authority that delegated to more than one contract, so
  // it must never be SMALLER than the global union. Equality is valid — it
  // means no cross-contract overlap was observed in this window. Only a
  // strict `<` is a defect.
  if (
    typeof candidate.perContractAuthoritySumWithOverlap === 'number' &&
    typeof candidate.distinctGlobalAuthorityCount === 'number' &&
    candidate.perContractAuthoritySumWithOverlap < candidate.distinctGlobalAuthorityCount
  ) {
    errors.push(
      `perContractAuthoritySumWithOverlap (${candidate.perContractAuthoritySumWithOverlap}) must be >= ` +
        `distinctGlobalAuthorityCount (${candidate.distinctGlobalAuthorityCount})`,
    )
  }

  errors.push(...forbiddenFieldErrors(candidate, 'artifact'))

  return { valid: errors.length === 0, errors }
}
