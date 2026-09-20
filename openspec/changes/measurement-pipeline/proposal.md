# Proposal: Measurement Pipeline

## Intent

PROJECT.md's figures live only in throwaway spikes and one recorded JSON — and three of them are defective. Nothing enforces any of it. This change owns the judgment work (plan days 1–3) and must leave days 4–8 executable by weaker models from other vendors. Prose does not transfer across models; a frozen contract, a golden fixture, and a per-task acceptance command do. Every trap becomes a failing test, not a warning paragraph.

## Scope

### In Scope

- **Frozen artifact contract** — versioned schema + `validateArtifact()` for the pre-aggregated JSON the pipeline emits and the browser consumes. The seam to change 2. Carries both authority counts as distinct named fields (true global distinct, and per-contract sum); their difference measures cross-contract delegation overlap, which is a finding, not noise.
- **Re-measurement with corrected semantics** — true global distinct authority set, no per-contract tuple cap, explicit recovery-failure counter asserted at zero.
- **Golden fixture + harness** — checked-in JSON-RPC responses for one fixed narrow contiguous block range. The fixture freezes **its own** expected values, computed by the corrected pipeline; they are stable forever and independent of PROJECT.md's headline. Reproducibility becomes checkable, not declarative.
- **Production pipeline** — contiguous windows → type-4 filter → `recoverAuthorizationAddress` per tuple → dedupe by authority per delegate → `eth_getCode` → batched `eth_getBalance` sample → four signals → artifact.

### Out of Scope

- All UI (React/Vite, cards, graph, time slider, Web Worker) — change 2, consuming the frozen contract.
- Deck, video, README regeneration instructions.
- **Correcting PROJECT.md's published figures.** 17,114 / 1.93x / 1.50x are recorded PROVISIONAL pending re-measurement, corrected once when the 10–15 temporal windows (plan days 1–2) run. PROJECT.md stays locked for design decisions; only those measured numbers are provisional.

## Capabilities

### New Capabilities

- `measurement-artifact`: frozen JSON schema, version field, both authority-count fields, nullable `funded`, validation.
- `authorization-scan`: window scan, type-4 filter, uncapped authority recovery with failure counter, per-contract and global dedup. Tested through an injected RPC adapter.
- `contract-signals`: four signals, ≥100-authorization threshold, archetype labels, behaviour-only labelling.

### Modified Capabilities

None — `openspec/specs/` is empty.

## Approach

`scripts/*.mjs` are **superseded, not reused**: top-level await, hardcoded RPC, module-scope `writeFileSync` — no seam, untestable offline. They stay frozen as provenance; no production module imports them. The algorithm is re-implemented behind two seams: an injected RPC adapter (fixture in tests, `fetch` in production) and pure signal functions over recorded data. Strict TDD, vertical slices, `npm test` per slice.

**Decided, not open.** Three `confirm.mjs` defects are design inputs, verified against the script and the dataset: `globalUnique` (line 50) sums per-contract sets; recovery is capped at 3,000 tuples (line 28); bare `catch{}` (line 30) discards failures uncounted. Resolution: compute a true global distinct set, remove the cap, count failures. `TOP_N=25` is **not** a defect — sorting is by authorizations descending, so all 23 classified contracts fall inside it — but `funded` stays nullable in the schema.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/artifact/` | New | Schema + validator |
| `src/scan/` | New | RPC adapter, type-4 filter, recovery, dedup |
| `src/signals/` | New | Four signals, threshold, labels |
| `test/fixtures/` | New | Cached RPC responses |
| `scripts/*.mjs` | Superseded | Frozen; no new work |
| `package.json` | Modified | Pipeline entry script |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Raw RPC fixture too large to check in | High | One narrow contiguous sub-range only |
| Uncapped recovery is slower per window | Med | Cap removal is correctness-critical; batch and measure, never reinstate a silent cap |
| Weak model reinvents strided sampling, counts `tx.from`, re-sums per-contract sets, or re-truncates recovery | High | One named failing test per trap |
| Public RPC unavailable | Med | Tests never touch network; `npm test` passes offline |
| Days 1–3 overrun the ten-day plan | Med | Contract frozen before UI starts; UI work deferred to change 2 |

## Rollback Plan

Additive under new paths. Revert = delete `src/`, `test/`, and the new `package.json` entry. `scripts/`, `data/`, `PROJECT.md`, and existing npm scripts are untouched.

## Dependencies

- `viem ^2.56.6` (present), Node ≥22 `node:test`. No new runtime dependencies.

## Success Criteria

- [ ] `npm test` passes with no network access.
- [ ] Global distinct authority count is strictly less than the per-contract sum.
- [ ] Recovery-failure counter is zero, and no contract's unique count equals a configured cap.
- [ ] Named failing tests exist for: strided sampling, counting `tx.from`, summing per-contract sets as global distinct, truncating recovery input.
- [ ] Retained recorded-truth assertions — 33,074 authorizations and the bimodal 13/0/10 split come from scan-loop counters read before recovery; Poisoner's 8.65x rests on 1,127 authorities, far below the cap, and is per-contract so the sum defect cannot reach it. Defect-independent. Do not delete.
- [ ] `validateArtifact()` rejects a malformed artifact; schema carries a version field.
- [ ] Pipeline emits a schema-conforming artifact from a contiguous window.
