import { projectArtifactForUi } from './ui-projection.mjs'
import {
  contractsByLabel,
  fundedRatioPct,
  separationRatio,
} from './ui-aggregates.mjs'

/**
 * Single seam for the social-card copy, so the Open Graph tags and the card
 * image can never disagree with each other or with the page.
 *
 * The meta description and image alt both quote measured figures. Typed into
 * `index.html` by hand they would be one `npm run measure` away from
 * advertising a stale number — the exact error class this project exists to
 * correct, reintroduced on the surface most people see before they ever open
 * the page. `vite.config.ts` substitutes these at build time and
 * `scripts/render-og.mjs` reads the same figures, so a re-measurement
 * propagates to both with no manual edit.
 *
 * Everything here goes through `projectArtifactForUi` and the `ui-aggregates`
 * helpers rather than reading artifact fields directly, which is what keeps
 * `distinctGlobalAuthorityCount` from ever being swapped for the inflated
 * `perContractAuthoritySumWithOverlap`.
 *
 * @param {object} artifact parsed `data/artifact.json`
 * @returns {{ description: string, imageAlt: string }}
 */
export function buildSocialCopy(artifact) {
  const data = projectArtifactForUi(artifact)

  const singleOperator = contractsByLabel(data.contracts, 'single-operator')
  const organic = contractsByLabel(data.contracts, 'organic')
  const separation = separationRatio(
    fundedRatioPct(organic),
    fundedRatioPct(singleOperator),
  )

  const auths = fmtInt(data.totalAuths)
  const wallets = fmtInt(data.globalUnique)
  const ratio = data.globalRedelegation.toFixed(2)

  // `separationRatio` returns null whenever either side is unmeasured or the
  // denominator is zero, so there is no Infinity or NaN to guard against here
  // beyond honouring that null.
  const separationText = separation === null ? null : `${separation.toFixed(0)}×`

  const description =
    `The EIP-7702 delegation epidemic is mostly automation, not victims. ` +
    `${auths} authorizations resolve to ${wallets} distinct wallets ` +
    `(${ratio}× re-delegation) — every signing authority recovered by ECDSA ` +
    `from the authorization tuples, with no API key.`

  const altFigures = [
    `${auths} authorizations`,
    `${wallets} distinct wallets`,
    `${ratio}× re-delegation gap`,
    separationText === null
      ? 'funded separation unmeasured'
      : `${separationText} funded separation`,
  ].join(', ')

  const imageAlt = `7702 Reality Check: ${altFigures}.`

  return { description, imageAlt }
}

function fmtInt(value) {
  return value.toLocaleString('en-US')
}
