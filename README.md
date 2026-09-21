# 7702 Reality Check

Measures whether EIP-7702 delegation volume on Ethereum mainnet comes from real
accounts or from automated address pools — and shows the evidence behind every
label it assigns.

**The claim:** the EIP-7702 "delegation epidemic" that gets reported is mostly
automation, not victims.

---

## The problem

Published EIP-7702 figures — tens of millions of "delegated wallets", hundreds
of thousands "compromised" — are built on two counting errors that compound.

**The sender is not the signer.** A type-4 transaction carries an
`authorizationList`. Each tuple holds `chainId`, `address` (the delegate),
`nonce`, `yParity`, `r`, `s`. It does **not** hold the address that signed it.
That address — the *authority* — exists nowhere in the transaction. It has to
be recovered cryptographically, with ECDSA public-key recovery over
`keccak256(0x05 || rlp([chainId, address, nonce]))`. `tx.from` is whoever paid
the gas, which in practice is very often a relayer or bundler. Counting
distinct `tx.from` counts sponsors, not accounts.

**One account can delegate many times.** The same authority re-signs
repeatedly, so counting authorization tuples instead of distinct recovered
authorities inflates the total.

Nobody measured this properly because the measurement is not a query — it is
signature recovery over every authorization tuple in a contiguous block range.

## The solution, and what is unique about it

This project performs that recovery at scale and classifies delegate contracts
by the **behaviour of the accounts delegating to them**, using only data the
pipeline computes itself. No external reputation feed, no third-party risk API,
no API key, no backend, no deployed contract, no wallet connection.

Three things make it non-trivial:

1. **It recovers the authority.** `viem`'s `recoverAuthorizationAddress` over
  every tuple, uncapped, with failures counted rather than swallowed.
2. **It deduplicates globally, not per contract.** The distinct-wallet figure is
  a true union across every delegate contract. A naive per-contract sum
   double-counts any authority that delegated to more than one contract — on
   this dataset that error inflates the wallet count by **34.24%** (24,305 vs
   18,105). That inflation is itself a measured finding, not an assumption.
3. **It is reproducible without credentials.** Anyone can regenerate every
  number in this README with `npm run measure` and no account anywhere.



## What the data shows

Contiguous scan of Ethereum mainnet blocks **26,018,045 – 26,021,045** (3,000
blocks), balances sampled at block 26,021,076.


| Measure                            | Value      |
| ---------------------------------- | ---------- |
| Type-4 transactions                | 19,757     |
| Authorization tuples               | 33,771     |
| **Distinct recovered authorities** | **18,105** |
| Distinct delegate contracts        | 125        |
| Global re-delegation ratio         | **1.87x**  |
| Recovery failures                  | 0          |


Classifying the 37 contracts that clear the volume threshold (96.13% of all
authorizations):


| Group                             | Contracts | Authorizations | Share of volume | Funded wallets           | ETH held  |
| --------------------------------- | --------- | -------------- | --------------- | ------------------------ | --------- |
| **Single-operator** (≤5 relayers) | 24        | 28,137         | **83.32%**      | **20 / 1,997 — 1.00%**   | 10.46     |
| *Mixed* (6–14 relayers)           | 1         | 155            | 0.46%           | 4 / 100 — 4.00%          | 0.04      |
| **Organic** (≥15 relayers)        | 12        | 4,172          | 12.35%          | **344 / 1,188 — 28.96%** | **55.20** |


Two things follow:

1. **Relayer diversity predicts real money.** A **28.9x** separation in
  funded-wallet ratio between the two ends.
2. **84.02% of the sampled ETH sits on the organic side**, which is 12.35% of
  the volume.

The volume everyone reports and the money that actually exists are on opposite
sides of the same dataset.

The classified set clusters hard at the extremes — 24 contracts at ≤5 relayers,
12 at ≥15 — but the gap is not empty: one contract sits at 14 relayers, holding
0.46% of volume. Earlier snapshots of this project claimed a perfectly empty
6–14 band; the current measurement does not support that, and the claim has
been withdrawn rather than restated.

## The four signals


| Signal                  | What it captures                                    |
| ----------------------- | --------------------------------------------------- |
| **Relayer diversity**   | distinct `tx.from` sponsoring the authorizations    |
| **Re-delegation ratio** | authorizations ÷ distinct recovered authorities     |
| **Median nonce**        | fresh addresses (0) vs. history vs. industrial bots |
| **Funded ratio**        | share of sampled authorities holding a balance      |


All four are displayed beneath every label, so any classification can be
audited and disputed against the numbers that produced it.

### What we assert, and what we do not

**We label behaviour, never intent.** The signals measure automation. They do
not measure malice. A contract with one relayer and no funded wallets is
*operated by a single actor* — that is all the evidence supports. It may be a
criminal address farm, or a legitimate service with one gas sponsor. We do not
know, so we do not say.

This is not caution for its own sake. The thesis of this project is that people
conflate *volume* with *victimhood*. Conflating *automation* with *malice*
would repeat that exact error in the other direction. There is deliberately no
0–100 risk score: a 0–100 number reads as risk however it is labelled.

**Never "$0 at risk."** Funded wallets exist. They are concentrated in the
organic group, and that concentration is the finding.

## Behavioural archetypes in the measured window

Each is a distinct signature drawn from the data in `data/artifact.json`.

**Industrial bot** — `0x2e086ac01cb8e6538d393944f02be58d52439ae8`
1,379 authorizations → **1 distinct authority (1379x)** · 1 relayer · median
nonce **486,964** · 0 / 1 funded. One address, signing 1,379 times inside 3,000
blocks, having already signed roughly 487,000 times.

**Single-operator pool** — `0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed`
4,197 authorizations → 1,211 authorities (3.47x) · **1 relayer** · median nonce
3 · 1 / 100 funded · 9.11 ETH. This contract's source was published and
attributed by Wintermute; any "is it verified?" heuristic clears it, and the
behavioural signals flag it anyway.

**Fresh-address farm** — `0xc43b6c6a43e5760a756a67756b2155c7fa735310`
1,782 authorizations → 1,771 authorities (1.01x) · 3 relayers · **median nonce
0** · **0 / 100 funded**. Nonce 0 across the board: addresses that have never
transacted, generated and delegated in the same motion.

**Organic** — `0x7702cb554e6bfb442cb743a7df23154544a7176c`
281 authorizations → 281 authorities (**1.00x**) · **281 relayers** · median
nonce 8 · **72 / 100 funded** · 5.43 ETH. One relayer per authorization, no
re-delegation, most accounts hold a balance. Real users.

## Technology stack


| Layer              | Choice                                                          |
| ------------------ | --------------------------------------------------------------- |
| Chain / network    | Ethereum mainnet                                                |
| Data source        | public JSON-RPC (`https://ethereum.publicnode.com`), no API key |
| Signature recovery | `viem` — `recoverAuthorizationAddress` (ECDSA secp256k1)        |
| Pipeline           | Node.js 22, ESM, zero runtime dependencies beyond `viem`        |
| Frontend           | React 19 + Vite 8 + Tailwind 4                                  |
| Live feed          | Web Worker (keeps secp256k1 recovery off the main thread)       |
| Tests              | `node:test` + `node:assert/strict`, offline and fixture-driven  |
| Smart contracts    | none — all data is read-only from public RPC                    |




## Reproducing the measurement

```bash
npm install
npm test            # offline, fixture-driven; never touches the network
npm run measure     # re-scans mainnet and regenerates data/artifact.json
```

`npm run measure` needs **no API key**. Point it at a different JSON-RPC
endpoint with `RPC_URL`:

```bash
RPC_URL=https://your-endpoint.example npm run measure
```

A full run takes roughly **7 minutes**: most of that is the contiguous block
scan (paced to avoid rate-limiting a free public RPC), followed by a shorter
balance-sampling pass for every contract that clears the classification
threshold. Balance sampling retries with backoff when the public endpoint
throttles; a contract that still cannot be sampled is recorded as *unmeasured*
(`funded: null`) rather than silently zeroed, and counted in
`unsampledContracts`.

## The artifact

`npm run measure` writes `data/artifact.json`. Top-level fields:


| Field                                | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                      | Artifact schema version (see `src/artifact/schema.mjs`).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `fromBlock` / `toBlock`              | The scanned contiguous block window.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `balanceBlock`                       | The height balances were sampled at — see the caveat below; independent of `fromBlock`/`toBlock`.                                                                                                                                                                                                                                                                                                                                                                                       |
| `type4TxCount`                       | Total EIP-7702 (type-4) transactions in the window.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `authorizationCount`                 | Total authorization tuples across those transactions (the reported vanity metric).                                                                                                                                                                                                                                                                                                                                                                                                      |
| `distinctDelegates`                  | Number of distinct delegate contracts observed.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `distinctGlobalAuthorityCount`       | **The headline wallet count.** A true union of recovered authorities across every delegate contract.                                                                                                                                                                                                                                                                                                                                                                                    |
| `perContractAuthoritySumWithOverlap` | The **inflated** figure: a naive sum of each contract's distinct-authority count. Kept only for contrast, because it double-counts any authority that delegated to more than one contract — the exact error this project exists to debunk (measured inflation here: 34.24%). **Never treat this as the wallet count.**                                                                                                                                                                  |
| `globalRedelegationRatio`            | `authorizationCount / distinctGlobalAuthorityCount`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `recoveryFailures`                   | Authorization tuples whose signature failed ECDSA recovery. Should be 0; a nonzero value means those tuples were excluded, never coerced into a fake result.                                                                                                                                                                                                                                                                                                                            |
| `unsampledContracts`                 | Classifiable contracts that could not be balance-sampled in this run.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `contracts[]`                        | Per-contract signals: `delegate`, `authorizations`, `distinctAuthorities`, `relayerDiversity`, `redelegationRatio`, `medianNonce`, `funded`, `sampled`, `totalEth`, `fundedRatio`, `label`. `funded`/`fundedRatio` are `null` (not `0`) for a contract that was never balance-sampled. `label` is one of `single-operator`, `mixed-relayers`, `organic`, `insufficient-volume` — the single source of truth for classification (`src/signals/threshold.mjs`, `src/signals/labels.mjs`). |


The UI never reads this file directly: `src/artifact/ui-projection.mjs` is the
one place that maps these field names onto what the React components render,
specifically so `distinctGlobalAuthorityCount` can never be swapped for
`perContractAuthoritySumWithOverlap` by accident.

`data/confirm-output.json` is the output of a superseded exploratory script,
kept only as frozen provenance. It carries the counting defects described
above and is not read by anything.

### The `balanceBlock` caveat

A public `eth_getBalance` on `ethereum.publicnode.com` only serves state for
roughly the last 64 blocks behind head — anything older returns an archive-node
error. A multi-thousand-block scan takes many minutes, so balances cannot be
pinned to `toBlock`: by the time the scan finishes, `toBlock` is long outside
that live-state window.

`balanceBlock` is therefore resolved fresh, right before balance sampling
starts, from a height near the *current* chain head — deliberately
**independent** of `fromBlock`/`toBlock`. Balances are a present-day snapshot of
addresses discovered in a past window, not a balance-at-time-of-delegation
figure. Reproducing a historical balance snapshot for an old window is not
possible without an archive node.

### Verifying the golden fixture is real capture

The offline suite runs against a committed fixture (`test/fixtures/golden/`).
To confirm it is a genuine chain capture and not hand-edited, re-fetch the same
range live and diff it byte-for-byte:

```bash
node scripts/verify-golden-capture.mjs
```

This needs live network, which is why it is **deliberately excluded from**
`npm test` — it is a reproducibility check, not part of the offline loop.

## Design decisions worth defending

Recorded so they are not re-litigated.


| Decision                                         | Why                                                                                                                                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contiguous block windows, never strided sampling | The re-delegation ratio only exists *within* an observed window. Sampling every Nth block almost never catches the same address twice, so every ratio collapses to 1.00x and industrial bots read as organic.    |
| Recovery is uncapped                             | An earlier capped implementation truncated tuple lists at 3,000, which silently turned the cap value into a "measurement". Two published figures turned out to be that ceiling, not data.                        |
| Global union, never a per-contract sum           | See `perContractAuthoritySumWithOverlap` above.                                                                                                                                                                  |
| No 0–100 risk score                              | A 0–100 number reads as risk however it is labelled, smuggling intent back in after we decided not to assert it.                                                                                                 |
| Public RPC, not an indexer                       | Blockscout's `advanced-filters` enum has no type-4 value; Etherscan v2 exposes no `authorizationList`; Dune pre-recovers `authority`, which gives away the one piece of engineering that makes this non-trivial. |




## Honest limits

- A single contiguous block window at one point in time. Every figure above
describes that window, not the whole history of EIP-7702.
- Balance sampling is capped at 100 authorities per contract.
- Only contracts above the volume threshold are classified; the rest are
reported as `insufficient-volume`, with their share of volume stated rather
than hidden.
- **Behaviour is not intent.** See *What we assert, and what we do not*.
- A single-operator contract is not evidence of crime, and this tool never says
it is.

## License

MIT — see [LICENSE](LICENSE). Reproducibility is this project's defence, so the
scripts, the fixtures and the measured dataset are all free to run, copy and
check.

