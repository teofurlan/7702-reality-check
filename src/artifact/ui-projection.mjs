/**
 * Single seam between the measurement artifact's field names and the shape
 * the React components already consume. This is the ONLY place that decides
 * which artifact field feeds which UI prop — every component change this
 * project's UI will ever need should be a change here, not a change
 * scattered across `.tsx` files.
 *
 * This lives in plain ESM (not `.tsx`) specifically so the existing
 * `node --test` harness can cover it directly, with no build step and no
 * DOM in the loop.
 *
 * @param {object} artifact - parsed `data/artifact.json` (see
 *   `src/artifact/schema.mjs` for the authoritative shape).
 * @returns the shape `App.tsx` hands to `MetricsBar`, `BimodalChart`,
 *   `ArchetypeGrid`, and `ContractsTable` (left untyped here on purpose —
 *   an explicit `{object}` JSDoc return type would erase the literal shape
 *   TypeScript would otherwise infer from the `return` below, and every
 *   `.tsx` consumer relies on that inferred shape for its own prop types).
 */
export function projectArtifactForUi(artifact) {
  return {
    fromBlock: artifact.fromBlock,
    toBlock: artifact.toBlock,
    balanceBlock: artifact.balanceBlock,
    totalType4Tx: artifact.type4TxCount,
    totalAuths: artifact.authorizationCount,

    /**
     * THE HEADLINE WALLET COUNT. This MUST come from
     * `artifact.distinctGlobalAuthorityCount` (a true union of recovered
     * authorities across every delegate contract) and MUST NEVER be fed
     * from `artifact.perContractAuthoritySumWithOverlap`.
     *
     * The sum double-counts any authority that delegated to more than one
     * contract — that is the exact bug this project exists to debunk. The
     * old UI imported `data/confirm-output.json`, whose `globalUnique` field
     * WAS that sum, and labelled it "Distinct Wallets": on the real dataset
     * the sum was 24,305 against a true distinct count of 18,105, a 34.24%
     * inflation. Do not reintroduce this by wiring `globalUnique` to
     * `perContractSumWithOverlap` below, however tempting the field
     * ordering looks.
     */
    globalUnique: artifact.distinctGlobalAuthorityCount,

    /**
     * The inflated sum, kept only for honest contrast (e.g. "reported
     * figure vs. real figure" displays). Never feed this into a headline —
     * see `globalUnique` above.
     */
    perContractSumWithOverlap: artifact.perContractAuthoritySumWithOverlap,

    uniqueContracts: artifact.distinctDelegates,
    globalRedelegation: artifact.globalRedelegationRatio,
    recoveryFailures: artifact.recoveryFailures,
    unsampledContracts: artifact.unsampledContracts,
    contracts: artifact.contracts.map((contract) => ({
      addr: contract.delegate,
      auths: contract.authorizations,
      unique: contract.distinctAuthorities,
      relayers: contract.relayerDiversity,
      redelegation: contract.redelegationRatio,
      medNonce: contract.medianNonce,
      // `funded`/`fundedRatio` are `null` for an unsampled contract — that
      // is a distinct, meaningful state ("we don't know") from `0`
      // ("we sampled and found none"). Never coerce null to 0 here.
      funded: contract.funded,
      sampled: contract.sampled,
      totalEth: contract.totalEth,
      fundedRatio: contract.fundedRatio,
      label: contract.label,
    })),
  }
}
