/**
 * Below roughly 20 authorizations the signals are noise: a 3-authorization,
 * 3-address contract has a 1.00x re-delegation ratio for lack of data, not
 * because it is organic. The classification threshold is fixed at 100
 * authorizations — the cut behind the classified-contract counts and volume
 * coverage README.md reports for any given run.
 */
export const MIN_AUTHORIZATIONS = 100

/**
 * A contract is classifiable only at or above `MIN_AUTHORIZATIONS`. Below
 * the threshold, the caller MUST report `label === 'insufficient-volume'`
 * instead of a behavioral label — never silently drop the contract.
 *
 * @param {{ authorizations: number }} record
 * @returns {boolean}
 */
export function isClassifiable(record) {
  return record.authorizations >= MIN_AUTHORIZATIONS
}
