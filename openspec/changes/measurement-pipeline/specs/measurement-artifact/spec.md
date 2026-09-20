# Measurement Artifact Specification

## Purpose

The frozen JSON contract emitted by the measurement pipeline and consumed by the browser UI (change 2). Schema-only: no scan or signal logic lives here, only shape, invariants, and validation.

## Requirements

### Requirement: Versioned Schema

The system MUST emit an artifact carrying a top-level `schemaVersion` (positive integer, starting at `1`) identifying the contract version.

#### Scenario: Version field present

- GIVEN a pipeline run over any contiguous block window
- WHEN the artifact is emitted
- THEN `typeof artifact.schemaVersion === 'number' && artifact.schemaVersion >= 1`, asserted in `test/artifact/schema.test.mjs`

### Requirement: Two Authority-Count Fields Are Named Unambiguously

The artifact MUST carry exactly two authority-count fields, named so that using the wrong one as the headline is self-evidently wrong at the call site:

- `distinctGlobalAuthorityCount` (integer) — unique recovered authority addresses across the whole window, deduplicated globally. This MUST be the field the UI surfaces as the headline wallet count.
- `perContractAuthoritySumWithOverlap` (integer) — sum of each contract's own distinct-authority count. The name MUST make clear this sum double-counts authorities delegating to more than one contract; it MUST NOT be presented as a headline distinct-wallet figure.

`validateArtifact` MUST reject any candidate where `perContractAuthoritySumWithOverlap < distinctGlobalAuthorityCount`.

#### Scenario: Sum is never below global distinct

- GIVEN a window containing an authority that delegated to two distinct contracts
- WHEN the artifact is computed
- THEN `artifact.perContractAuthoritySumWithOverlap > artifact.distinctGlobalAuthorityCount`, asserted in `test/artifact/schema.test.mjs`

#### Scenario: Field-swap invariant is caught

- GIVEN a candidate with the two count values swapped
- WHEN `validateArtifact(candidate)` runs
- THEN it returns `{ valid: false }` with an error string containing `perContractAuthoritySumWithOverlap`

### Requirement: Nullable Funded Field Models Unmeasured Balance Data

Each per-contract signal record MUST carry `funded: number | null` and `sampled: number`. `funded` MUST be `null` exactly when `sampled === 0` (contract outside the `TOP_N` balance-sampled group). It MUST NOT default to `0` for unmeasured contracts.

#### Scenario: Unmeasured contract reports null

- GIVEN a contract ranked below `TOP_N` by authorization volume
- WHEN its signal record is built
- THEN `record.funded === null && record.sampled === 0`, asserted in `test/artifact/schema.test.mjs`

#### Scenario: Sampled contract with zero funded wallets reports 0, not null

- GIVEN a `TOP_N` contract where no sampled authority holds a balance
- WHEN its signal record is built
- THEN `record.funded === 0 && record.sampled > 0`

### Requirement: validateArtifact Rejects Malformed Input

`validateArtifact(candidate)` MUST return `{ valid: boolean, errors: string[] }` and MUST NOT throw for any input, including `null`, `undefined`, or a partial object.

#### Scenario: Missing required field

- GIVEN `candidate = { schemaVersion: 1 }`
- WHEN `validateArtifact(candidate)` runs
- THEN it returns `{ valid: false }` with an error naming `distinctGlobalAuthorityCount`

#### Scenario: Well-formed artifact passes

- GIVEN a fully populated artifact matching the schema
- WHEN `validateArtifact(artifact)` runs
- THEN it returns `{ valid: true, errors: [] }`

### Requirement: Pipeline Emits a Schema-Conforming Artifact

Running the production entry point over a contiguous block window MUST produce an object that passes `validateArtifact()`.

#### Scenario: End-to-end emission

- GIVEN the golden fixture range (see `authorization-scan` — Golden Fixture Range Is Pinned and Reproducible)
- WHEN the pipeline runs against the injected fixture RPC adapter
- THEN `validateArtifact(result).valid === true`, asserted in `test/artifact/pipeline-emission.test.mjs`
