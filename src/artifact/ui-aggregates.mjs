/**
 * Pure aggregation helpers over the UI-projected `contracts` array (the
 * shape `ui-projection.mjs` produces, not the raw artifact). These exist so
 * every component that needs a group figure (share of volume, funded ratio,
 * total ETH, worst-case re-delegation) derives it from the same math instead
 * of each hand-rolling its own grouping.
 *
 * Before this module existed, `MetricsBar.tsx` and `BimodalChart.tsx`
 * shipped hardcoded literals for exactly these numbers ("89.26%", "0.85% vs
 * 34.90%", "41×", "98.63%", "Up to 179× per contract") computed once against
 * a since-replaced dataset. Route every such figure through here so it can
 * never go stale silently again.
 *
 * Grouping uses `label`, the single source of truth from
 * `src/signals/labels.mjs` and `src/signals/threshold.mjs` — never a
 * re-derived relayer/authorization threshold.
 */

/**
 * @param {Array<{label: string}>} contracts
 * @param {string} label
 * @returns {Array} the subset carrying exactly this label
 */
export function contractsByLabel(contracts, label) {
  return contracts.filter((contract) => contract.label === label)
}

/**
 * @param {Array<{label: string}>} contracts
 * @returns {Array} every contract with a real behavioural label, i.e.
 *   everything except `insufficient-volume`
 */
export function classifiedContracts(contracts) {
  return contracts.filter((contract) => contract.label !== 'insufficient-volume')
}

function sumAuths(contracts) {
  return contracts.reduce((sum, contract) => sum + contract.auths, 0)
}

/**
 * @param {Array<{auths: number}>} group
 * @param {number} totalAuths - the artifact-wide authorization count
 * @returns {number|null} the group's share of total volume as a percentage,
 *   or `null` when it cannot be derived (zero total) rather than dividing by
 *   zero
 */
export function volumeSharePct(group, totalAuths) {
  if (!totalAuths || totalAuths <= 0) return null
  return (sumAuths(group) / totalAuths) * 100
}

/**
 * @param {Array<{funded: number|null, sampled: number}>} group
 * @returns {number|null} percentage of sampled authorities holding a
 *   balance, or `null` when nothing in the group was sampled. `funded: null`
 *   entries (unsampled) contribute 0 to the funded count, exactly like their
 *   `sampled: 0` — they never manufacture a fake zero-funded measurement.
 */
export function fundedRatioPct(group) {
  const sampled = group.reduce((sum, contract) => sum + contract.sampled, 0)
  if (sampled <= 0) return null
  const funded = group.reduce((sum, contract) => sum + (contract.funded ?? 0), 0)
  return (funded / sampled) * 100
}

/**
 * @param {Array<{totalEth: number}>} group
 * @returns {number} sum of sampled ETH across the group
 */
export function sumTotalEth(group) {
  return group.reduce((sum, contract) => sum + contract.totalEth, 0)
}

/**
 * @param {Array<{redelegation: number}>} group
 * @returns {number|null} the worst-case (highest) re-delegation ratio in the
 *   group, or `null` for an empty group
 */
export function maxRedelegation(group) {
  if (group.length === 0) return null
  return Math.max(...group.map((contract) => contract.redelegation))
}

/**
 * @param {number|null} numeratorPct
 * @param {number|null} denominatorPct
 * @returns {number|null} `numeratorPct / denominatorPct`, or `null` instead
 *   of `Infinity`/`NaN` when either side cannot be derived or the
 *   denominator is zero
 */
export function separationRatio(numeratorPct, denominatorPct) {
  if (numeratorPct === null || denominatorPct === null || denominatorPct === 0) return null
  return numeratorPct / denominatorPct
}
