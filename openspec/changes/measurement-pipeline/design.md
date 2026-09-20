# Design: Measurement Pipeline

## Technical Approach

Re-implement `confirm.mjs`'s algorithm as single-purpose ESM modules under `src/`, one exported
function per file, no classes and no config-object threading. Two seams carry every variation: an
**injected RPC adapter** and **pure functions over plain records**. `src/` contains exactly one
module that performs I/O (`rpc-live.mjs`); everything else is pure or CPU-only. `scripts/` owns
`fetch`, `fs`, `argv`, and the clock. Heavy work stays offline per PROJECT.md; the browser receives
only the artifact. A change to dedup requires reading `dedupe.mjs` and nothing else.

## Architecture Decisions

| # | Choice | Rejected alternative | Rationale |
|---|---|---|---|
| 1 | `RpcAdapter = (calls) => Promise<results>`: one batch in, unwrapped results out, re-ordered by `id` | A client object with `getBlock`/`getBalance`/`getCode` methods | One function is interchangeable with a fixture with zero branching. Per-method clients force the fixture to impersonate three methods. Unwrapping inside the adapter deletes the `b?.result ?? '0x0'` silent-zero trap from every call site; re-ordering by `id` removes the unstated assumption that JSON-RPC preserves batch order. |
| 2 | Exhausted retries and per-call JSON-RPC `error` members **throw** `RpcBatchError` | Reference behaviour: return `[]` after 3 attempts | A silently empty batch is indistinguishable from "no type-4 transactions in those blocks". Missing data becomes an unfalsifiable low number, and reproducibility is this project's entire defence. Retry policy (3 attempts, 1s) stays, only the terminal branch changes. |
| 3 | Fixture keyed per **call** (`method|params`), not per batch | Hash the whole batch | Chunk size becomes a free variable: changing 10→8 does not invalidate the fixture. A missing key throws; it never returns `undefined`. |
| 4 | Chunking lives in the caller (`chunk()`, pure); the adapter never splits | Adapter-owned chunk policy | Keeps the only impure module trivial and keeps batching testable without a fixture. |
| 5 | Capture is a **separate script** (`capture-fixture.mjs`), not a `--record` flag on the production run | One script, two modes | A flag is one typo from overwriting a golden fixture during a production run. Two names cannot be confused, and `npm run capture` vs `npm run measure` is self-documenting. |
| 6 | Balance/code calls use a pinned hex block tag (`toBlock`), never `'latest'` | Reference `'latest'` | Makes re-running the same window reproducible and makes the recorded fixture value honest rather than a snapshot of an unnamed moment. |
| 7 | Recovery is a **sequential loop, uncapped, no worker threads** | Worker pool; `Promise.all`; reinstated slice | ~33k tuples × ~2 ms ≈ 60 s per 3,000-block window, against ~5 min of RPC round-trips for the same window — ~20% on a network-bound offline job. `Promise.all` cannot parallelise CPU work on one thread and spikes memory; workers add a serialization boundary and a second failure mode, violating the one-module-in-your-head constraint. PROJECT.md's Web Worker is for the browser live feed (change 2), not this script. |
| 8 | Any future limit is an explicit `maxTuples` option that **throws** `RecoveryLimitExceededError`; unset by default | Silent `slice(0, N)` | `src/scan/recover.mjs` contains no slice. The dataset shows the cap firing (`unique: 3000`, `unique: 2999`); truncation must be impossible to reintroduce accidentally. |
| 9 | Global distinct authorities is `unionAuthorities(records) -> Set`; artifact carries `distinctGlobalAuthorityCount` **and** `perContractAuthoritySumWithOverlap` as distinct fields (names taken verbatim from the spec) | Summing per-contract sizes; neutral field names | Their difference measures cross-contract delegation overlap — a finding, not noise. `perContractAuthoritySumWithOverlap` encodes the defect risk in the identifier, so a model that only skims still reads the warning at every call site. A union of two overlapping literal sets is the RED test for the defect. |
| 10 | Recovery returns `failures` as a counted field; the pipeline asserts zero | Bare `catch {}` | Swallowed failures silently deflate every distinct-authority count. |

## Data Flow

```
scripts/measure.mjs            scripts/capture-fixture.mjs
   |  createLiveRpc()                |  createLiveRpc() + pruneBlock()
   v                                 v
 RpcAdapter  <-------- seam 1 -------- createFixtureRpc(recorded)  [tests]
   |
   v
 scanRange()  -- async, the only orchestrating module in src/
   |  blockNumbersInRange -> chunk(10) -> rpc -> type4Transactions -> tallyBlocks
   v
 ScanTally { type4TxCount, authorizationCount, byDelegate: Map<addr, ContractTally> }
   |                                    ^ counted BEFORE recovery (defect-independent)
   v
 recoverAuthorities(tuples)  -- CPU only, no network, no fixture
   v
 ContractRecord[] -----> unionAuthorities() ---> distinctGlobalAuthorityCount
   |
   +--> sampleBalances({rpc, addresses, blockTag})   [impure, chunk(50), cap 100 - explicit]
   |
   v
 computeSignals / isClassifiable / labelFor  <---- seam 2: pure, object literals only
   v
 buildArtifact() -> validateArtifact() -> data/artifact.json
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/artifact/schema.mjs` | Create | `ARTIFACT_VERSION`, `buildArtifact(scan, records, signals)` |
| `src/artifact/validate.mjs` | Create | `validateArtifact(a) -> { valid, errors }` |
| `src/scan/rpc.mjs` | Create | `rpcKey(call)`, `RpcBatchError` — shared by recorder and fixture |
| `src/scan/rpc-live.mjs` | Create | `createLiveRpc(opts) -> RpcAdapter` (only I/O module in `src/`) |
| `src/scan/rpc-fixture.mjs` | Create | `createFixtureRpc(recorded) -> RpcAdapter` |
| `src/scan/blocks.mjs` | Create | `blockNumbersInRange(from, to)`, `chunk(items, size)` |
| `src/scan/filter.mjs` | Create | `type4Transactions(block)`, `authorizationsOf(tx)` |
| `src/scan/tally.mjs` | Create | `tallyBlocks(blocks) -> ScanTally` |
| `src/scan/recover.mjs` | Create | `recoverAuthorities(tuples, opts)` — no slice, counts failures |
| `src/scan/dedupe.mjs` | Create | `unionAuthorities(records) -> Set` |
| `src/scan/balances.mjs` | Create | `sampleBalances({rpc, addresses, blockTag, sampleSize})` |
| `src/scan/scan.mjs` | Create | `scanRange({rpc, fromBlock, toBlock})` |
| `src/signals/signals.mjs` | Create | `computeSignals(record)` |
| `src/signals/threshold.mjs` | Create | `MIN_AUTHORIZATIONS = 100`, `isClassifiable(record)` |
| `src/signals/labels.mjs` | Create | `labelFor(signals)` — behaviour labels only |
| `scripts/measure.mjs` | Create | Production run; live adapter; writes `data/artifact.json` |
| `scripts/capture-fixture.mjs` | Create | Fixture capture; prunes blocks; writes `test/fixtures/` |
| `test/fixtures/blocks-<from>-<to>.json` | Create | Pruned **captured** responses, pinned range, < 2 MB |
| `test/fixtures/overlap-synthetic.mjs` | Create | Hand-written literals for the cross-contract overlap trap. Never captured data, never used by the golden test |
| `package.json` | Modify | `"measure"` and `"capture"` scripts |
| `scripts/{recover,compare,confirm}.mjs` | Frozen | Provenance only; never imported by `src/` |

## Interfaces / Contracts

```js
/** @typedef {{ method: string, params: unknown[] }} RpcCall */
/** @typedef {(calls: RpcCall[]) => Promise<unknown[]>} RpcAdapter
 *  Results are unwrapped `.result` values, index-aligned to `calls` (re-ordered by `id`).
 *  Throws RpcBatchError on transport exhaustion, on any per-call JSON-RPC `error`,
 *  and (fixture) on any unrecorded key. Never returns [] and never returns undefined. */

export function rpcKey(call)            // `${method}|${JSON.stringify(params)}`
export function createLiveRpc({ url, fetchImpl = fetch, retries = 3, retryDelayMs = 1000 })
export function createFixtureRpc(recorded /* Record<rpcKey, unknown> */)

/** @typedef {{ delegate, authorizations, relayers: Set<string>, tuples: Auth[], firstBlock }} ContractTally */
/** @typedef {{ fromBlock, toBlock, type4TxCount, authorizationCount,
 *              byDelegate: Map<string, ContractTally> }} ScanTally */
/** @typedef {{ delegate, authorizations, distinctAuthorities, relayers,
 *              nonces: number[], authorities: Set<string> }} ContractRecord */

export function tallyBlocks(blocks)                       // pure -> ScanTally
export async function recoverAuthorities(tuples, { maxTuples } = {})
  // -> { authorities: Set<string>, nonces: number[] /* sorted asc */, failures: number }
  // sequential; never truncates; throws RecoveryLimitExceededError if maxTuples is set and exceeded
export function unionAuthorities(records)                 // pure -> Set<string>
export function computeSignals(record)
  // -> { relayerDiversity, redelegationRatio, medianNonce, fundedRatio }
export function validateArtifact(artifact)                // -> { valid: boolean, errors: string[] }
```

Artifact fields (frozen, `version: 1`, names verbatim from the spec): `fromBlock`, `toBlock`,
`type4TxCount`, `authorizationCount`, `distinctDelegates`, **`distinctGlobalAuthorityCount`**,
**`perContractAuthoritySumWithOverlap`**, `globalRedelegationRatio`, `recoveryFailures` (must be 0),
`contracts[]` with `funded` **nullable**.

`validateArtifact` enforces the invariant `perContractAuthoritySumWithOverlap >=
distinctGlobalAuthorityCount`. Equality is **valid**: it means no authority in the window delegated
to more than one contract. Only a strict `<` proves overlap was observed, and no window can be
required to contain it.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit (pure) | `chunk`, `blockNumbersInRange`, `type4Transactions`, `tallyBlocks`, `unionAuthorities`, `computeSignals`, `isClassifiable`, `labelFor`, `validateArtifact` | Object literals, `node:assert/strict`. No network, no fixture. |
| Unit (CPU) | `recoverAuthorities` | Hand-written tuple literals + one recorded tuple with a known authority. Asserts `failures === 0` and that a >3,000-tuple input recovers all of them. |
| Adapter | `createFixtureRpc` throws on unrecorded key; `createLiveRpc` throws `RpcBatchError` after retries and on per-call `error` | Injected `fetchImpl` stub. |
| Integration (golden) | `scanRange` + full pipeline over `test/fixtures/` | Fixture adapter over **real captured mainnet responses**. Golden values are **frozen literals in the test file**, never recomputed at test time; cross-checked by an independent count over the fixture and by the invariant `perContractAuthoritySumWithOverlap >= distinctGlobalAuthorityCount`. The strict `>` is **not** asserted here — it holds only if the captured window happens to contain a cross-contract authority, which is chain content nobody controls. |
| Guard (traps) | Strided sampling; counting `tx.from` as delegator; summing per-contract sets; truncating recovery | One named failing test each, per proposal. Also asserts fixture file < 2 MB. |
| Guard (overlap) | Strict `perContractAuthoritySumWithOverlap > distinctGlobalAuthorityCount` | Dedicated trap test over a **hand-constructed** fixture (`test/fixtures/overlap-synthetic.mjs`, literals — never captured data) where one authority is deliberately given authorizations to two different delegates. Overlap is guaranteed by construction, so a sum-based implementation produces equality and fails loudly. |
| E2E | Production run against live RPC | Manual/offline only. Excluded from `npm test`; the suite passes with no network. |

## Threat Matrix

N/A — no routing, shell commands, subprocesses, VCS/PR automation, executable-file classification, or
process integration. The only external surface is outbound HTTP POST to a configured JSON-RPC URL,
injected at the seam and absent from the test suite.

## Migration / Rollout

No migration required. Additive under `src/`, `test/`, and two new `package.json` scripts.
`scripts/{recover,compare,confirm}.mjs`, `data/`, and existing npm scripts are untouched.
PROJECT.md's measured figures stay PROVISIONAL until the temporal windows run.

## Open Questions

- [ ] Fixture block range is specified as narrow and contiguous (20–40 blocks, < 2 MB after pruning);
      the exact range is picked at capture time and must contain at least one multi-relayer contract
      and one repeated authority **within a contract**, otherwise dedup is untested by the golden run.
      Both are satisfiable from any high-volume window. Cross-contract authority overlap is
      deliberately **not** a selection criterion: requiring it would push an implementer toward
      fabricating fixture data, and the golden fixture must be real captured responses. That case is
      covered by the hand-constructed overlap trap instead.
