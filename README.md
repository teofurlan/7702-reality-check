<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="7702 Reality Check — octahedron split into Automation Amber and Organic Emerald" />
</p>

<h1 align="center">7702 Reality Check</h1>

<p align="center">
  <strong>The EIP-7702 "delegation epidemic" is mostly automation, not victims.<br/>We measured it.</strong>
</p>

<p align="center">
  <a href="#reproducing-the-measurement"><img src="https://img.shields.io/badge/API_keys-none-10b981?style=flat-square" alt="No API keys required" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5e6ad2?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522-f5a623?style=flat-square" alt="Node ≥22" />
  <img src="https://img.shields.io/badge/React_19-Vite_8-828fff?style=flat-square" alt="React 19 + Vite 8" />
</p>

---

## What this is

A measurement of whether EIP-7702 delegation volume on Ethereum mainnet comes
from real accounts or from automated address pools — and a dashboard that shows
the evidence behind every label it assigns.

The published figures are wrong, and wrong in a way that is invisible unless you
do the cryptography: a delegation does not record who signed it. Recovering that
signer, for every authorization in a contiguous block range, is the whole job.

## The finding

Contiguous scan of Ethereum mainnet blocks **26,018,045 – 26,021,045** (3,000
blocks), balances sampled at block 26,021,076.

| Measure                            | Value      |
| ---------------------------------- | ---------- |
| Type-4 transactions                | 19,757     |
| Authorization tuples               | 33,771     |
| **Distinct recovered authorities** | **18,105** |
| Distinct delegate contracts        | 125        |
| Global re-delegation ratio         | **1.87×**  |
| Recovery failures                  | 0          |

Classifying the 37 contracts that clear the volume threshold (96.13 % of all
authorizations):

| Group                              | Contracts | Authorizations |  Share | Funded wallets            |  ETH held |
| ---------------------------------- | --------: | -------------: | -----: | ------------------------- | --------: |
| **Single-operator** (1–5 relayers) |        24 |         28,137 | 83.32% | 20 / 1,997 — **1.00%**    |     10.46 |
| *Mixed* (6–14 relayers)            |         1 |            155 |  0.46% | 4 / 100 — 4.00%           |      0.04 |
| **Organic** (15+ relayers)         |        12 |          4,172 | 12.35% | 344 / 1,188 — **28.96%**  | **55.20** |

**Two things follow:**

1. **Relayer diversity predicts real money.** A **28.9×** separation in
   funded-wallet ratio between the two ends.
2. **84.02 % of the sampled ETH sits on the organic side**, which is 12.35 %
   of the volume.

> The volume everyone reports and the money that actually exists are on opposite
> sides of the same dataset.

---

## Who this is for, and what it changes

The corrected count matters to anyone allocating attention on the basis of the
published one: a security vendor sizing an incident, a journalist repeating a
figure, a wallet team deciding whether to ship a warning, a researcher using
delegation volume as a proxy for adoption.

What the data supports is narrow and specific: **authorization volume is a bad
proxy for exposure.** Across the 37 classified contracts, 368 of 3,285 sampled
authorities hold any balance at all, and 84.02 % of the sampled ETH sits on the
organic side — the 12.35 % of volume coming from contracts with many independent
relayers. The 83.32 % of volume flowing through single-operator contracts is
where almost none of the money is.

So ranking delegate contracts by authorization count ranks them by how automated
they are, not by how much is at stake on them. That is the decision this
measurement changes, and it is the only one it claims to.

It does **not** say the single-operator contracts are harmless. Automation is not
intent, and 10.46 ETH is not zero. It says the two are not the same quantity, and
that the published figures have been reporting them as one.

---

## Why this is hard

Published EIP-7702 figures — tens of millions of "delegated wallets", hundreds
of thousands "compromised" — are built on two counting errors that compound.

### Error 1 — The sender is not the signer

A type-4 transaction carries an `authorizationList`. Each tuple holds
`chainId`, `address` (the delegate), `nonce`, `yParity`, `r`, `s`. It does
**not** hold the address that signed it. That address — the *authority* —
exists nowhere in the transaction. It must be recovered cryptographically, with
ECDSA public-key recovery over `keccak256(0x05 ‖ rlp([chainId, address,
nonce]))`. `tx.from` is whoever paid the gas, which in practice is very often
a relayer or bundler. Counting distinct `tx.from` counts sponsors, not
accounts.

### Error 2 — One account can delegate many times

The same authority re-signs repeatedly, so counting authorization tuples
instead of distinct recovered authorities inflates the total. On this dataset,
a naive per-contract sum double-counts any authority that delegated to more
than one contract — inflating the wallet count by **34.24 %** (24,305 vs
18,105).

Nobody measured this properly because the measurement is not a query — it is
signature recovery over every authorization tuple in a contiguous block range.

---

## What makes this unique

| Capability | Detail |
| --- | --- |
| 🔐 **Recovers the authority** | `viem`'s `recoverAuthorizationAddress` over every tuple, uncapped, with failures counted rather than swallowed |
| 🌐 **Deduplicates globally** | A true union across every delegate contract — not a per-contract sum that inflates by 34.24 % |
| 🔑 **Zero credentials** | Reproducible with `npm run measure` against a public RPC — no API key, no backend, no wallet connection |
| 🏷️ **Labels behaviour, never intent** | No 0–100 risk score; automation ≠ malice |

---

## The four signals

Every label sits on top of the evidence that produced it.

| Signal                  | What it captures                                    |
| ----------------------- | --------------------------------------------------- |
| **Relayer diversity**   | distinct `tx.from` sponsoring the authorizations    |
| **Re-delegation ratio** | authorizations ÷ distinct recovered authorities     |
| **Median nonce**        | fresh addresses (0) vs. history vs. industrial bots |
| **Funded ratio**        | share of sampled authorities holding a balance      |

### What we assert, and what we do not

**We label behaviour, never intent.** A contract with one relayer and no funded
wallets is *operated by a single actor* — that is all the evidence supports. It
may be a criminal address farm, or a legitimate service with one gas sponsor.
We do not know, so we do not say.

**Never "$ 0 at risk."** Funded wallets exist. They are concentrated in the
organic group, and that concentration is the finding.

---

## Behavioural archetypes

Each is a distinct pattern drawn from the measured data in `data/artifact.json`.

<table>
<tr>
<td width="50%">

**🤖 Industrial bot**
`0x2e08…9ae8`

1,379 auth → **1 authority (1,379×)**
1 relayer · median nonce **486,964** · 0/1 funded

_One address, signing 1,379 times in 3,000 blocks, having already signed ~487k times._

</td>
<td width="50%">

**🏭 Single-operator pool**
`0xe6b9…43ed`

4,197 auth → 1,211 authorities (3.47×)
**1 relayer** · median nonce 3 · 1/100 funded · 9.11 ETH

_Source published and attributed by Wintermute — behavioural signals flag it regardless._

</td>
</tr>
<tr>
<td width="50%">

**🏗️ Fresh-address farm**
`0xc43b…5310`

1,782 auth → 1,771 authorities (1.01×)
3 relayers · **median nonce 0** · **0/100 funded**

_Nonce 0 across the board: addresses generated and delegated in the same motion._

</td>
<td width="50%">

**👤 Organic**
`0x7702…176c`

281 auth → 281 authorities (**1.00×**)
**281 relayers** · median nonce 8 · **72/100 funded** · 5.43 ETH

_One relayer per authorization, no re-delegation, most accounts hold a balance. Real users._

</td>
</tr>
</table>

---

## Quick start

```bash
npm install
npm test              # offline, fixture-driven — never touches the network
npm run dev           # start the UI locally
```

### Reproducing the measurement

```bash
npm run measure       # re-scans mainnet → regenerates data/artifact.json
npm run og            # regenerates public/og.png from that artifact
```

- Takes ~**7 minutes** (paced to avoid rate-limiting a free public RPC).
- Needs **no API key**. Override the endpoint with:
  ```bash
  RPC_URL=https://your-endpoint.example npm run measure
  ```
- A contract that cannot be balance-sampled is recorded as *unmeasured*
  (`funded: null`), never silently zeroed.

### Verifying the golden fixture

```bash
node scripts/verify-golden-capture.mjs    # needs live network
```

Confirms the committed fixture (`test/fixtures/golden/`) is a genuine chain
capture, not hand-edited. Deliberately excluded from `npm test` — it is a
reproducibility check, not part of the offline loop.

---

## Architecture

```
├── app/                          # React 19 + Vite 8 + Tailwind 4
│   ├── components/
│   │   ├── AmbientBackground     # Atmospheric field bound to scroll + live data
│   │   ├── ArchetypeGrid         # The four behavioural archetype cards
│   │   ├── BimodalChart          # Volume vs. money distribution
│   │   ├── ContractsTable        # Sortable, filterable contract breakdown
│   │   ├── HeroSection           # Thesis and headline metrics
│   │   ├── LiveFeed              # Real-time delegation recovery (Web Worker)
│   │   ├── MetricsBar            # Summary statistics strip
│   │   └── Footer
│   ├── hooks/
│   └── workers/                  # secp256k1 recovery off the main thread
├── src/
│   ├── artifact/                 # Schema, UI projection, social copy
│   ├── scan/                     # Block scanning and authority recovery
│   └── signals/                  # Classification: thresholds + labels
├── scripts/
│   ├── measure.mjs               # Full pipeline: scan → classify → artifact
│   ├── render-og.mjs             # Social card, rendered from the artifact
│   ├── capture-fixture.mjs       # Capture golden test fixtures
│   └── verify-golden-capture.mjs # Byte-for-byte verification against live
├── data/
│   ├── artifact.json             # The measured dataset (source of truth)
│   └── confirm-output.json       # Superseded exploratory output (frozen provenance)
├── public/                       # Icons and the generated social card
├── test/                         # node:test + node:assert/strict, offline
├── PRODUCT.md                    # Durable product context
└── DESIGN.md                     # The design system, with its token frontmatter
```

Every figure that appears anywhere — the dashboard, the social card, the meta
tags — is read from `data/artifact.json` through
[`src/artifact/ui-projection.mjs`](src/artifact/ui-projection.mjs) and
[`src/artifact/social-copy.mjs`](src/artifact/social-copy.mjs). Nothing is
typed in by hand, so a re-measurement cannot leave one surface quoting a stale
number.

### Technology stack

| Layer              | Choice                                                          |
| ------------------ | --------------------------------------------------------------- |
| Chain / network    | Ethereum mainnet                                                |
| Data source        | Public JSON-RPC (`ethereum.publicnode.com`), no API key         |
| Signature recovery | `viem` — `recoverAuthorizationAddress` (ECDSA secp256k1)        |
| Pipeline           | Node.js 22, ESM — `viem` is its only dependency                 |
| Frontend           | React 19 + Vite 8 + Tailwind 4                                  |
| Live feed          | Web Worker (keeps secp256k1 recovery off the main thread)       |
| Tests              | `node:test` + `node:assert/strict`, offline and fixture-driven  |
| Smart contracts    | None — all data is read-only from public RPC                    |

---

## The artifact

`npm run measure` writes `data/artifact.json`. The UI never reads this file
directly: [`src/artifact/ui-projection.mjs`](src/artifact/ui-projection.mjs) is
the single mapping layer, specifically so `distinctGlobalAuthorityCount` can
never be swapped for `perContractAuthoritySumWithOverlap` by accident.

<details>
<summary><strong>Artifact field reference</strong></summary>

| Field                                | Meaning |
| ------------------------------------ | ------- |
| `schemaVersion`                      | Artifact schema version (see `src/artifact/schema.mjs`) |
| `fromBlock` / `toBlock`              | The scanned contiguous block window |
| `balanceBlock`                       | The height balances were sampled at (see caveat below) |
| `type4TxCount`                       | Total EIP-7702 (type-4) transactions in the window |
| `authorizationCount`                 | Total authorization tuples (the reported vanity metric) |
| `distinctDelegates`                  | Number of distinct delegate contracts observed |
| `distinctGlobalAuthorityCount`       | **The headline wallet count.** True union of recovered authorities |
| `perContractAuthoritySumWithOverlap` | The **inflated** figure — kept only for contrast (34.24 % inflation) |
| `globalRedelegationRatio`            | `authorizationCount / distinctGlobalAuthorityCount` |
| `recoveryFailures`                   | Tuples that failed ECDSA recovery. Should be 0 |
| `unsampledContracts`                 | Classifiable contracts that could not be balance-sampled |
| `contracts[]`                        | Per-contract signals: delegate, authorizations, distinctAuthorities, relayerDiversity, redelegationRatio, medianNonce, funded, sampled, totalEth, fundedRatio, label |

</details>

### The `balanceBlock` caveat

A public `eth_getBalance` on `ethereum.publicnode.com` only serves state for
roughly the last 64 blocks behind head. A multi-thousand-block scan takes many
minutes, so balances cannot be pinned to `toBlock`. `balanceBlock` is resolved
fresh, right before balance sampling starts — deliberately **independent** of
the scan window. Balances are a present-day snapshot of addresses discovered in
a past window.

---

## Design decisions worth defending

Recorded so they are not re-litigated.

| Decision | Why |
| --- | --- |
| Contiguous block windows, never strided sampling | The re-delegation ratio only exists *within* an observed window. Sampling every Nth block collapses every ratio to 1.00× |
| Recovery is uncapped | An earlier capped implementation turned the cap value into a published "measurement" |
| Global union, never a per-contract sum | See `perContractAuthoritySumWithOverlap` above |
| No 0–100 risk score | A 0–100 number reads as risk however it is labelled, smuggling intent back in |
| Public RPC, not an indexer | Blockscout has no type-4 filter; Etherscan v2 exposes no `authorizationList`; Dune pre-recovers `authority`, giving away the engineering |

---

## Honest limits

- A single contiguous block window at one point in time — not the whole
  history of EIP-7702.
- Balance sampling is capped at 100 authorities per contract.
- Only contracts above the volume threshold are classified; the rest are
  reported as `insufficient-volume`, with their share stated rather than hidden.
- **Behaviour is not intent.** A single-operator contract is not evidence of
  crime, and this tool never says it is.

---

## License

MIT — see [LICENSE](LICENSE).

Reproducibility is this project's defence, so the scripts, the fixtures and the
measured dataset are all free to run, copy and check.
