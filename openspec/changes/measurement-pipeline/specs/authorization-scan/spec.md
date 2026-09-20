# Authorization Scan Specification

## Purpose

Scans contiguous block windows through an injected RPC adapter, filters type-4 transactions, recovers the authority per authorization tuple with no cap, counts recovery failures, and deduplicates authorities per contract and globally. Tested entirely offline against a fixture adapter; `fetch` is only the production adapter. Fixture provenance is a first-class rule, not an implementation detail: trap fixtures and the golden fixture serve opposite purposes and MUST NOT share a provenance policy.

## Requirements

### Requirement: Injected RPC Adapter Seam

The scan MUST accept an RPC adapter as a parameter instead of constructing its own network client. The same scan function MUST run identically against a fixture adapter (test) and a `fetch`-based adapter (production).

#### Scenario: Offline execution

- GIVEN a fixture adapter returning recorded JSON-RPC responses
- WHEN the scan function runs
- THEN it completes with zero network calls; `npm test` passes with network access disabled

### Requirement: Trap Fixtures Are Synthetic; the Golden Fixture Is Never Synthetic

Fixture provenance MUST follow one of exactly two policies, by class, and the two MUST NOT be interchanged:

- **Trap fixtures** (strided sampling, `tx.from`-as-authority, sum-as-global-distinct, recovery truncation): hand-crafted/synthetic JSON-RPC responses are REQUIRED. Each trap condition MUST be induced deterministically and minimally by construction; waiting for it to occur incidentally in captured chain data is FORBIDDEN for these tests, because incidental occurrence is neither guaranteed nor minimal.
- **Golden reproducibility fixture**: MUST be real, unedited JSON-RPC responses captured from Ethereum mainnet over the recorded range (see Golden Fixture Range requirement below). Synthetic, edited, hand-adjusted, or partially fabricated responses are FORBIDDEN for this fixture, because it exists to prove the pipeline reproduces against real chain data, not against data shaped to pass.

#### Scenario: Trap fixture lives under test/fixtures/traps/

- GIVEN any of the four trap tests (Trap A–D)
- WHEN its fixture file is located
- THEN it resides under `test/fixtures/traps/` as hand-authored JSON, never under `test/fixtures/golden/`, asserted by each trap test importing only from `test/fixtures/traps/`

#### Scenario: Golden fixture lives under test/fixtures/golden/ and is never hand-edited

- GIVEN the golden reproducibility fixture
- WHEN its files are located
- THEN they reside under `test/fixtures/golden/` and are byte-identical to an unedited RPC capture (verified per the Golden Fixture Range requirement's re-capture scenario)

### Requirement: Contiguous Window Scan Only

The system MUST scan one or more contiguous ranges (`fromBlock..toBlock`, step 1) and MUST NOT accept a stride greater than 1.

#### Scenario: Strided sampling is rejected (Trap A)

- GIVEN a fixture engineered so the same authority repeats within a contiguous 1,000-block range but rarely at any fixed 10-block stride
- WHEN `redelegationRatio` is computed over the contiguous range vs. an every-10th-block subset of the same range
- THEN the contiguous-range ratio is strictly greater than the strided-subset ratio, asserted in `test/scan/no-strided-sampling.test.mjs`

### Requirement: Type-4 Filter

The scan MUST collect only transactions where `tx.type === '0x4'`.

#### Scenario: Non-type-4 transactions excluded

- GIVEN a fixture block with 3 type-4 and 2 type-2 transactions
- WHEN the scan runs
- THEN exactly 3 transactions reach recovery, asserted in `test/scan/type4-filter.test.mjs`

### Requirement: Authority Is Recovered Per Tuple, Never From tx.from

The authority for each tuple MUST come from `recoverAuthorizationAddress` over `(chainId, address, nonce, r, s, yParity)`. `tx.from` MUST NOT be used, stored, or counted as an authority anywhere in the scan.

#### Scenario: tx.from is rejected as authority (Trap B)

- GIVEN a fixture transaction where `tx.from` differs from every tuple's recovered authority
- WHEN the scan computes distinct authorities
- THEN the resulting set equals the recovered-address set and excludes `tx.from`, asserted in `test/scan/no-tx-from-as-authority.test.mjs`

### Requirement: Recovery Is Uncapped and Failures Are Counted, Never Swallowed

The scan MUST attempt recovery for every tuple with no truncation of the input list, and MUST accumulate `recoveryFailureCount`, incremented whenever recovery throws or rejects. A failure MUST NOT be discarded via a bare `catch {}`.

#### Scenario: Truncation is rejected (Trap D)

- GIVEN a contract with 4,000 recoverable authorization tuples
- WHEN the scan computes that contract's unique-authority count
- THEN the count reflects all 4,000 tuples with no fixed ceiling applied, asserted in `test/scan/no-recovery-cap.test.mjs`

#### Scenario: Recovery failures are counted, not discarded

- GIVEN a fixture where 2 of 10 tuples fail recovery
- WHEN the scan runs
- THEN `result.recoveryFailureCount === 2` and the 8 successes are still included, asserted in `test/scan/recovery-failure-counter.test.mjs`

#### Scenario: Production run asserts zero failures

- GIVEN the golden fixture range
- WHEN the full pipeline runs
- THEN `result.recoveryFailureCount === 0`, asserted in `test/scan/recovery-failure-counter.test.mjs`

### Requirement: Global Distinct Authority Set Is Computed Directly, Never By Summing Per-Contract Sets

`distinctGlobalAuthorityCount` MUST come from one global `Set` of recovered authorities accumulated across all contracts. It MUST NOT be derived by summing each contract's own distinct-authority count.

#### Scenario: Sum-as-global is rejected (Trap C)

- GIVEN a hand-crafted `test/fixtures/traps/sum-as-global.json` where authority `A` appears in tuples addressed to exactly 2 distinct contracts, and no other authority overlaps across contracts
- WHEN the scan computes `distinctGlobalAuthorityCount` and `perContractAuthoritySumWithOverlap`
- THEN `perContractAuthoritySumWithOverlap - distinctGlobalAuthorityCount === 1` exactly (one double-counted overlap from `A`), asserted in `test/scan/no-sum-as-global.test.mjs`

### Requirement: Per-Contract Dedup

For each delegate contract the scan MUST deduplicate recovered authorities into a per-contract `Set`. `perContractAuthoritySumWithOverlap` MUST equal the sum of each contract set's `size`.

#### Scenario: Per-contract dedup

- GIVEN a contract receiving 5 tuples from 3 distinct authorities (one delegating 3 times)
- WHEN the scan runs
- THEN that contract's unique-authority count is 3, asserted in `test/scan/per-contract-dedup.test.mjs`

### Requirement: Golden Fixture Range Is Pinned, Captured From Mainnet, and Reproducible

The harness MUST run against one fixed, narrow, contiguous block range whose raw JSON-RPC responses are real, unedited captures from Ethereum mainnet, checked into `test/fixtures/golden/`. Before any expected value is frozen, the chosen range MUST satisfy, and record in a committed `test/fixtures/golden-range.json`:

| Criterion | Bound |
|---|---|
| Contiguity | `toBlock - fromBlock` consecutive blocks, step 1, no gaps |
| Fixture size | total serialized fixture payload ≤ 2 MB |
| Recovery cleanliness | `recoveryFailureCount === 0` over the range |
| Provenance | every file under `test/fixtures/golden/` is an unmodified capture of a live RPC response for `fromBlock..toBlock`; no field is added, removed, or edited by hand |

Once recorded, re-running the pipeline over this committed fixture MUST reproduce `test/fixtures/golden-expected.json` exactly, and re-capturing the same `fromBlock`/`toBlock` from the live endpoint MUST reproduce the committed fixture bytes — this second check is what makes the reproducibility claim checkable rather than declarative.

#### Scenario: Range is recorded before values are frozen

- GIVEN a chosen `fromBlock`/`toBlock` satisfying contiguity, fixture-size, and recovery-cleanliness
- WHEN the range is committed
- THEN `golden-range.json` contains `fromBlock` and `toBlock`, and `test/fixtures/golden/` contains one file per captured RPC call for that range

#### Scenario: Byte-for-byte reproducibility from the committed fixture (offline)

- GIVEN the committed fixture responses and `golden-range.json`
- WHEN the pipeline runs against them via the fixture adapter
- THEN `assert.deepStrictEqual(result, goldenExpected)` passes in `test/scan/golden-fixture.test.mjs`, with zero network access

#### Scenario: Re-capture from the live endpoint matches the committed fixture (network, not part of `npm test`)

- GIVEN `golden-range.json`'s recorded `fromBlock`/`toBlock`
- WHEN a named script `scripts/verify-golden-capture.mjs` re-fetches the same range from a live RPC endpoint (normalizing only the JSON-RPC `id` field before comparison)
- THEN the re-captured payload is byte-identical to the committed files under `test/fixtures/golden/`, proving the fixture was captured, not fabricated
