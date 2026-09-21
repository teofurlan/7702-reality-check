import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildSocialCopy } from '../../src/artifact/social-copy.mjs'

/**
 * Minimal artifact shaped like `data/artifact.json`. Two single-operator
 * contracts and one organic one, with funded ratios far enough apart that the
 * separation figure is unambiguous.
 */
function artifact(overrides = {}) {
  return {
    fromBlock: 1000,
    toBlock: 4000,
    balanceBlock: 4100,
    type4TxCount: 500,
    authorizationCount: 900,
    distinctDelegates: 3,
    distinctGlobalAuthorityCount: 600,
    perContractAuthoritySumWithOverlap: 750,
    globalRedelegationRatio: 1.5,
    recoveryFailures: 0,
    unsampledContracts: 0,
    contracts: [
      {
        delegate: '0xa',
        authorizations: 400,
        distinctAuthorities: 100,
        relayerDiversity: 1,
        redelegationRatio: 4,
        medianNonce: 0,
        funded: 1,
        sampled: 100,
        totalEth: 0.5,
        fundedRatio: 0.01,
        label: 'single-operator',
      },
      {
        delegate: '0xb',
        authorizations: 300,
        distinctAuthorities: 300,
        relayerDiversity: 40,
        redelegationRatio: 1,
        medianNonce: 9,
        funded: 30,
        sampled: 100,
        totalEth: 12,
        fundedRatio: 0.3,
        label: 'organic',
      },
    ],
    ...overrides,
  }
}

test('description carries the measured figures, not literals', () => {
  const { description } = buildSocialCopy(artifact())

  // 900 authorizations resolving to 600 distinct wallets.
  assert.match(description, /900 authorizations/)
  assert.match(description, /600 distinct wallets/)
  // Global re-delegation ratio, two decimals.
  assert.match(description, /1\.50/)
})

test('figures are thousands-separated so the card reads as a ledger', () => {
  const { description } = buildSocialCopy(
    artifact({ authorizationCount: 33771, distinctGlobalAuthorityCount: 18105 }),
  )

  assert.match(description, /33,771/)
  assert.match(description, /18,105/)
})

test('image alt restates the four headline figures', () => {
  const { imageAlt } = buildSocialCopy(artifact())

  assert.match(imageAlt, /900/)
  assert.match(imageAlt, /600/)
  assert.match(imageAlt, /1\.50/)
  // organic 30% vs single-operator 1% is a 30x separation.
  assert.match(imageAlt, /30×|30x/)
})

test('an unmeasurable separation degrades instead of printing NaN', () => {
  // No organic contracts at all: the separation ratio has no numerator.
  const onlyAutomation = artifact({
    contracts: [
      {
        delegate: '0xa',
        authorizations: 400,
        distinctAuthorities: 100,
        relayerDiversity: 1,
        redelegationRatio: 4,
        medianNonce: 0,
        funded: 1,
        sampled: 100,
        totalEth: 0.5,
        fundedRatio: 0.01,
        label: 'single-operator',
      },
    ],
  })

  const { description, imageAlt } = buildSocialCopy(onlyAutomation)

  assert.doesNotMatch(description, /NaN|undefined|null/)
  assert.doesNotMatch(imageAlt, /NaN|undefined|null/)
})

test('a zero single-operator funded ratio does not produce an Infinity separation', () => {
  const zeroDenominator = artifact({
    contracts: [
      {
        delegate: '0xa',
        authorizations: 400,
        distinctAuthorities: 100,
        relayerDiversity: 1,
        redelegationRatio: 4,
        medianNonce: 0,
        funded: 0,
        sampled: 100,
        totalEth: 0,
        fundedRatio: 0,
        label: 'single-operator',
      },
      {
        delegate: '0xb',
        authorizations: 300,
        distinctAuthorities: 300,
        relayerDiversity: 40,
        redelegationRatio: 1,
        medianNonce: 9,
        funded: 30,
        sampled: 100,
        totalEth: 12,
        fundedRatio: 0.3,
        label: 'organic',
      },
    ],
  })

  const { description, imageAlt } = buildSocialCopy(zeroDenominator)

  assert.doesNotMatch(description, /Infinity/)
  assert.doesNotMatch(imageAlt, /Infinity/)
})

test('copy never asserts intent, only measured behaviour', () => {
  const { description, imageAlt } = buildSocialCopy(artifact())

  // The palette and the label vocabulary both refuse to impute malice; the
  // social copy is a surface where that discipline is easiest to lose.
  for (const text of [description, imageAlt]) {
    assert.doesNotMatch(text, /scam|fraud|malicious|thief|attacker|victim of|risk score/i)
  }
})
