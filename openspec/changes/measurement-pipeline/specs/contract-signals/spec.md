# Contract Signals Specification

## Purpose

Computes the four behavioral signals per delegate contract from scan output, applies the ≥100-authorization classification threshold, and assigns behavior-only labels. Pure functions over recorded data — no RPC calls, no I/O.

## Requirements

### Requirement: Four Signals Computed as Pure Functions

The system MUST compute, per contract, purely from scan output: `relayerDiversity` (distinct `tx.from` count), `redelegationRatio` (`auths / max(distinctAuthorities, 1)`), `medianNonce` (median of recovered nonces), and `fundedRatio` (`funded / sampled` when `sampled > 0`, else `null`).

#### Scenario: Redelegation ratio matches a worked example

- GIVEN `auths = 9743`, `distinctAuthorities = 1127` (Poisoner archetype figures)
- WHEN `redelegationRatio(9743, 1127)` is called
- THEN it returns `8.64` (±0.01), asserted in `test/signals/redelegation-ratio.test.mjs` against this independently-known literal

#### Scenario: Funded ratio is null when unmeasured

- GIVEN `funded = null`, `sampled = 0`
- WHEN `fundedRatio(null, 0)` is called
- THEN it returns `null`, not `0`, asserted in `test/signals/funded-ratio.test.mjs`

### Requirement: Classification Threshold at 100 Authorizations

A contract MUST receive a behavioral label only when `auths >= 100`. Contracts below the threshold MUST receive `label === 'insufficient-volume'` and MUST still report their `auths` share of the total.

#### Scenario: Below-threshold contract is not classified

- GIVEN a contract with `auths = 43`
- WHEN labels are assigned
- THEN `label === 'insufficient-volume'`, asserted in `test/signals/threshold.test.mjs`

#### Scenario: At-threshold contract is classified

- GIVEN a contract with `auths = 100`
- WHEN labels are assigned
- THEN `label !== 'insufficient-volume'`, asserted in `test/signals/threshold.test.mjs`

### Requirement: Labels Describe Behavior, Never Intent

The label vocabulary MUST be a fixed, closed set of behavior-only labels (e.g. `single-operator`, `organic`, `insufficient-volume`). A signal record MUST NOT include a numeric risk score, a malice/fraud designation, or any field named `risk`, `score`, or `threat`.

#### Scenario: Schema rejects a risk field

- GIVEN a candidate signal record containing a `riskScore` field
- WHEN the record is checked against the closed label/field set
- THEN validation fails, asserted in `test/signals/no-risk-score.test.mjs`
