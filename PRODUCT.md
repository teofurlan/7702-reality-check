# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: hackathon judges.** They arrive with minutes, not hours, and they are
comparing this against a field of other submissions. They need two things fast:
what the finding is, and why producing it was non-trivial. They are technically
literate but not necessarily EIP-7702 specialists, and they will not run the
pipeline before forming a judgement.

**Secondary, and the audience this outlives judging for: technical evaluators
reading it as portfolio work.** Their job is to assess the engineering, so the
rigor behind the number matters as much as the number — the signature recovery,
the global deduplication, the measurement discipline, the withdrawn claim.

Both audiences reward the same thing: the finding legible on first read, with
the engineering visible rather than summarized away.

## Product Purpose

Measures whether EIP-7702 delegation volume on Ethereum mainnet comes from real
accounts or from automated address pools, and shows the evidence behind every
label it assigns.

Published EIP-7702 figures are built on compounding counting errors. The sender
of a type-4 transaction is not the signer: the authorization tuple carries
`chainId`, `address`, `nonce`, `yParity`, `r`, `s` and **not** the address that
signed it, so `tx.from` counts gas sponsors rather than delegating accounts. On
top of that, one account re-signs repeatedly, and summing per-contract distinct
authorities double-counts any account that delegated to more than one contract.

Success is a skeptical reader accepting the correction — either because the
evidence on the page is sufficient, or because they regenerated it themselves.

## Positioning

The measurement is not a query. It is ECDSA public-key recovery over every
authorization tuple in a contiguous block range, which is precisely the step
the available tooling either cannot do or does for you:

- Blockscout's `advanced-filters` enum has no type-4 value.
- Etherscan v2 exposes no `authorizationList`.
- Dune pre-computes `authority`, which gives away the one piece of engineering
  that makes this non-trivial.

Contracts are classified by the *behaviour of the accounts delegating to them*,
using only data the pipeline computes itself — no external reputation feed, no
third-party risk API.

## Operating Context

A judge opens a URL, reads for a few minutes, and never installs anything. A
technical evaluator may clone the repo and run `npm test` (offline, fixture
driven) or `npm run measure` (~7 minutes, live public RPC). The page must stand
on its own for the first path while remaining honest enough to survive the
second.

## Capabilities and Constraints

- Contiguous block windows only, never strided sampling: the re-delegation
  ratio exists only *within* an observed window, so sampling every Nth block
  collapses every ratio to 1.00x and industrial bots read as organic.
- Authority recovery is uncapped. An earlier capped implementation truncated
  tuple lists at 3,000 and turned the cap value into a published "measurement".
- The distinct-wallet figure is a global union across all delegate contracts,
  never a per-contract sum. The inflated sum is retained in the artifact as
  `perContractAuthoritySumWithOverlap` purely for contrast.
- Balance sampling is a present-day snapshot, capped at 100 authorities per
  contract. A public `eth_getBalance` serves roughly the last 64 blocks, so
  balances cannot be pinned to the scanned window; `balanceBlock` is resolved
  independently and the page must not imply balance-at-time-of-delegation.
- Unmeasured is not zero: a contract that could not be balance-sampled carries
  `funded: null`, never `0`.
- Only contracts at or above 100 authorizations are classified; the rest are
  reported as `insufficient-volume` with their share of volume stated.
- Classification vocabulary is closed and owned by the pipeline:
  `single-operator`, `mixed-relayers`, `organic`, `insufficient-volume`.
- `src/signals/labels.mjs` labels behaviour and refuses to assert intent, and
  `containsForbiddenField` structurally rejects any field named `risk*`,
  `score*` or `threat*` so a 0–100 risk number cannot reappear. **Recorded as
  repository evidence, not as a user-declared commitment** — the user did not
  elevate it to non-negotiable when asked.
- The 6–14 relayer band is a real bucket contracts land in. An earlier snapshot
  claimed it was perfectly empty and used that emptiness as evidence the
  threshold came from the data; re-measurement did not support it and the claim
  was withdrawn rather than restated.

## Brand Commitments

- Name: **7702 Reality Check**.
- **Reproducibility without credentials is non-negotiable** (user-confirmed):
  no API key, no backend, no deployed contract, no wallet connection. Every
  figure regenerates with `npm run measure` from a public JSON-RPC endpoint.
  Nothing in any surface may imply an account is needed.
- MIT licensed, because reproducibility is the project's defence.

## Evidence on Hand

- `data/artifact.json` — the measured dataset. Blocks 26,018,045–26,021,045;
  19,757 type-4 transactions; 33,771 authorization tuples; 18,105 distinct
  recovered authorities; 125 delegate contracts; 1.87x global re-delegation;
  0 recovery failures. Read by the UI only through
  `src/artifact/ui-projection.mjs`.
- `test/fixtures/golden/` — committed real chain capture, verifiable byte-for-byte
  against a live re-fetch via `scripts/verify-golden-capture.mjs`.
- Four behavioural archetypes drawn from the measured window, each with a real
  contract address, including one whose source is published and attributed to
  Wintermute — the case where behavioural signals flag a contract that any
  "is it verified?" heuristic clears.
- `data/confirm-output.json` — output of a superseded exploratory script, kept
  as frozen provenance. Carries the counting defects described above and is
  read by nothing.
- **No** testimonials, customers, press, benchmarks, pricing or deployment
  claims exist. Future work must not fabricate them.

## Product Principles

1. **Show the evidence under the label.** Every classification displays the
   four signals that produced it, so it can be audited and disputed.
2. **Make the engineering visible, not just the result.** Both audiences are
   judging the method; hiding it costs more than the space it takes.
3. **Distinguish unmeasured from zero, everywhere** — in the data, in the copy,
   and in the interface.
4. **Keep the inflated number on the page.** The error is the argument; deleting
   it would leave the correction unmotivated.
5. **Never require an account to verify a claim.**

## Open Decisions

- **Visual world is not locked.** When asked what future work must preserve, the
  user confirmed only reproducibility — not the dark canvas, the lavender
  octahedron, or the mono-for-data typography. Treat the incumbent world as the
  documented starting point (see DESIGN.md), not as a binding constraint.
