/**
 * Closed, behavior-only label vocabulary. Every entry describes what the
 * numbers show (relayer concentration), never who is behind it — see
 * README.md's "We label behaviour, never intent." A single-relayer,
 * zero-funded contract is *operated by a single actor*; that is all the
 * evidence supports. Malice is asserted only where independent published
 * evidence exists.
 *
 * `insufficient-volume` is assigned by the caller directly from
 * `isClassifiable` (threshold.mjs), never by `labelFor` — it is listed here
 * only so the closed set used for validation covers every label value the
 * pipeline can ever emit.
 */
export const LABELS = Object.freeze([
  'single-operator',
  'mixed-relayers',
  'organic',
  'insufficient-volume',
])

// The measured distribution clusters hard at these boundaries, but the gap
// between them is NOT empty and must not be described as such: the run
// recorded in `data/artifact.json` has 24 contracts at <=5 relayers, 12 at
// >=15, and one contract at 14 relayers holding 0.46% of volume. An earlier
// snapshot of this project claimed a perfectly empty 6-14 band and treated
// that emptiness as evidence the threshold was "in the data, not chosen by
// us"; re-measurement did not support it, so the claim was withdrawn.
// `mixed-relayers` is the label for that band — a real bucket contracts do
// land in, not a placeholder for one nothing was ever expected to occupy.
const SINGLE_OPERATOR_MAX_RELAYERS = 5
const ORGANIC_MIN_RELAYERS = 15

/**
 * Assigns a behavior-only label purely from relayer diversity. Never
 * receives or reports a numeric risk/malice figure — the label is the entire
 * output, and it is drawn only from the closed `LABELS` vocabulary above.
 *
 * @param {{ relayerDiversity: number }} signals
 * @returns {string}
 */
export function labelFor(signals) {
  const { relayerDiversity } = signals

  if (relayerDiversity <= SINGLE_OPERATOR_MAX_RELAYERS) return 'single-operator'
  if (relayerDiversity >= ORGANIC_MIN_RELAYERS) return 'organic'
  return 'mixed-relayers'
}

const FORBIDDEN_FIELD_NAME = /^(risk|score|threat)/i

/**
 * Structural closed-field-set check: a candidate signal record must never
 * carry a field whose name starts with `risk`, `score`, or `threat` — no
 * 0-100 risk score, ever. As README.md's design-decisions table puts it: a
 * 0-100 number reads as risk however it is labelled, which would smuggle
 * intent back in after we decided not to assert it.
 *
 * @param {Record<string, unknown>} record
 * @returns {boolean}
 */
export function containsForbiddenField(record) {
  return Object.keys(record).some((key) => FORBIDDEN_FIELD_NAME.test(key))
}
