import { redelegationRatio, fundedRatio as computeFundedRatio } from '../signals/signals.mjs'

/**
 * @typedef {import('../scan/dedupe.mjs').ContractRecord} ContractRecord
 * @typedef {{ relayerDiversity: number, redelegationRatio: number, medianNonce: number,
 *             fundedRatio: number | null, funded: number | null, sampled: number,
 *             totalEth: number, label: string }} ContractSignals
 * @typedef {{ fromBlock: number, toBlock: number, balanceBlock: number, type4TxCount: number,
 *             authorizationCount: number, recoveryFailureCount: number,
 *             distinctGlobalAuthorityCount: number,
 *             perContractAuthoritySumWithOverlap: number,
 *             unsampledContracts: number }} ScanSummary
 */

/**
 * Frozen artifact schema version. Bump only when the shape or invariants of
 * the artifact change in a way consumers must react to.
 */
export const ARTIFACT_VERSION = 1

function buildContractEntry(record, signalsByDelegate) {
  const signals = signalsByDelegate.get(record.delegate) ?? {}

  // `funded`/`sampled` are carried through verbatim, never defaulted to 0
  // for an unmeasured contract — `null` and `0` mean opposite things here.
  const funded = signals.funded ?? null
  const sampled = signals.sampled ?? 0

  return {
    delegate: record.delegate,
    authorizations: record.authorizations,
    distinctAuthorities: record.distinctAuthorities,
    relayerDiversity: signals.relayerDiversity,
    redelegationRatio: signals.redelegationRatio,
    medianNonce: signals.medianNonce,
    funded,
    sampled,
    // Sum of ALL sampled balances (not only funded ones), defaulting to 0
    // for a contract that was never balance-sampled — same discipline as
    // `sampled` itself.
    totalEth: signals.totalEth ?? 0,
    // Recomputed here from the FINAL `funded`/`sampled` above via the shared
    // helper, rather than trusted from `signals.fundedRatio` verbatim: a
    // caller may compute `signals` before it knows the resolved funded/
    // sampled counts (see `computeSignals`'s own defaults), and re-deriving
    // it here keeps this field always consistent with the `funded`/`sampled`
    // that ship right next to it on the same contract entry.
    fundedRatio: computeFundedRatio(funded, sampled),
    label: signals.label,
  }
}

/**
 * Assembles the frozen measurement artifact from a scan summary, its
 * per-contract records, and their precomputed signals (relayer diversity,
 * redelegation ratio, median nonce, funded/sampled, label — already produced
 * upstream by `computeSignals`/`isClassifiable`/`labelFor`). This function is
 * a pure assembly step: it never recomputes `distinctGlobalAuthorityCount`
 * or `perContractAuthoritySumWithOverlap` — those come from `scan`, exactly
 * as `scanRange` (or, for the overlap trap, a hand-constructed
 * `unionAuthorities`/sum computation over literal `ContractRecord[]`)
 * produced them.
 *
 * @param {ScanSummary} scan
 * @param {ContractRecord[]} records
 * @param {Map<string, ContractSignals>} signalsByDelegate
 * @returns {object} the frozen artifact
 */
export function buildArtifact(scan, records, signalsByDelegate) {
  const {
    fromBlock,
    toBlock,
    balanceBlock,
    type4TxCount,
    authorizationCount,
    recoveryFailureCount,
    distinctGlobalAuthorityCount,
    perContractAuthoritySumWithOverlap,
    unsampledContracts,
  } = scan

  return {
    schemaVersion: ARTIFACT_VERSION,
    fromBlock,
    toBlock,
    // Deliberately independent of `fromBlock`/`toBlock`: delegations are
    // measured over a historical window (often thousands of blocks in the
    // past by the time a scan finishes), while balances can only be read
    // within ~64 blocks of chain head. Taken verbatim from `scan` — this
    // function never recomputes or guesses it — so conflating the two never
    // happens here and a consumer can always tell WHEN the money was
    // observed relative to WHEN the delegations were observed.
    balanceBlock,
    type4TxCount,
    authorizationCount,
    distinctDelegates: records.length,
    // Headline distinct-wallet figure. The UI MUST surface this one.
    distinctGlobalAuthorityCount,
    // Sum of each contract's own distinct-authority count. Double-counts any
    // authority that delegated to more than one contract — MUST NOT be
    // presented as a headline distinct-wallet figure.
    perContractAuthoritySumWithOverlap,
    globalRedelegationRatio: redelegationRatio(authorizationCount, distinctGlobalAuthorityCount),
    recoveryFailures: recoveryFailureCount,
    // Taken verbatim from `scan`, exactly like the other scalars above —
    // never recomputed here. This function has no visibility into how many
    // balance-sampling retries a contract exhausted; that count is produced
    // upstream (`scripts/measure.mjs`) and just carried through so a
    // consumer can tell a heavily-throttled run apart from a clean one.
    unsampledContracts,
    contracts: records.map((record) => buildContractEntry(record, signalsByDelegate)),
  }
}
