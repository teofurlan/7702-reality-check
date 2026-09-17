# 7702 Reality Check

**Hackathon:** [3rd-Web-Hack](https://3rd-web-hack.devpost.com/) — deadline 27 Sep 2026, 12:30pm IST
**Status:** Design locked. Implementation not started.
**Judging criteria:** Innovation · Technical Feasibility · Uniqueness · Design

---

## The claim

> **The EIP-7702 "delegation epidemic" that gets reported is mostly automation, not victims.**

Published figures — tens of millions of delegated wallets, hundreds of thousands
"compromised" — count *authorizations* and treat the transaction sender as the
wallet that delegated. Both are wrong, and the error compounds.

Nobody measured this because the address that actually delegated is **not present
in the transaction**. It has to be recovered cryptographically from the
authorization signature. This project does that, at scale, and reports what the
data actually shows.

---

## Why the reported numbers break

### The sender is not the signer

An EIP-7702 type-4 transaction carries an `authorizationList`. Each tuple holds
`chainId`, `address` (the delegate), `nonce`, `yParity`, `r`, `s`.

It does **not** hold the address that signed it. That address — the *authority* —
must be recovered with ECDSA public key recovery over
`keccak256(0x05 || rlp([chainId, address, nonce]))`.

`tx.from` is whoever paid the gas and broadcast the transaction. In practice that
is very often a relayer or bundler, not the delegating wallet. Counting distinct
`tx.from` values therefore counts sponsors, not accounts.

### One account can delegate many times

The same authority re-signs repeatedly. Counting authorizations instead of
distinct recovered authorities inflates the total. Across the whole measured
sample the inflation factor is **1.93x**; for individual contracts it reaches
**8.65x** and **179x**.

---

## What we measured

**Method.** Contiguous block scan over Ethereum mainnet via public JSON-RPC
(`ethereum.publicnode.com`), no API key. Every transaction with `type === "0x4"`
is collected, every authorization tuple is recovered to its authority with
viem's `recoverAuthorizationAddress`, results are deduplicated per delegate
contract, and a balance sample is taken per contract with batched `eth_getBalance`.

**Sample.** Blocks **25,991,731 – 25,994,731** (3,000 contiguous blocks),
measured 2026-09-17.

| Measure | Value |
|---|---|
| Type-4 transactions | 10,533 |
| Authorization tuples | 33,074 |
| **Distinct recovered authorities** | **17,114** |
| Distinct delegate contracts | 146 |
| Global re-delegation ratio | **1.93x** |

### The result

Classifying the 23 contracts with at least 100 authorizations (94.95% of all volume):

| Group | Contracts | Authorizations | Share of volume | Funded wallets | ETH held |
|---|---|---|---|---|---|
| **Single-operator** (≤5 relayers) | 13 | 28,030 | **89.26%** | **10 / 1,178 — 0.85%** | 0.46 |
| *(6–14 relayers)* | **0** | 0 | 0% | — | — |
| **Organic** (≥15 relayers) | 10 | 3,373 | 10.74% | **349 / 1,000 — 34.90%** | **33.08** |

Three things follow:

1. **Relayer diversity predicts real money.** A 41x separation in funded-wallet
   ratio between the two groups.
2. **The distribution is completely bimodal.** Not one classified contract falls
   between 6 and 14 relayers. The threshold is in the data, not chosen by us.
3. **98.63% of the ETH sits on the organic side**, which is 10.74% of the volume.

The volume everyone reports and the money that actually exists are on opposite
sides of the same dataset.

---

## What the tool does

A web application that classifies EIP-7702 delegate contracts by the **behaviour**
of the accounts delegating to them, and shows the evidence behind every label.

### The four signals

All four are derived from data the pipeline already computes. No external
reputation feed, no third-party risk API.

| Signal | What it captures |
|---|---|
| **Relayer diversity** | distinct `tx.from` sponsoring the authorizations |
| **Re-delegation ratio** | authorizations ÷ distinct recovered authorities |
| **Median nonce** | fresh addresses (0) vs. history vs. industrial bots |
| **Funded ratio** | share of recovered authorities holding a balance |

### What we assert, and what we do not

**We label behaviour, never intent.**

The signals measure automation. They do not measure malice. A contract with one
relayer and no funded wallets is *operated by a single actor* — that is all the
evidence supports. It may be a criminal address farm, or a legitimate service with
one gas sponsor. We do not know, so we do not say.

Malice is asserted **only** where independent, published evidence exists. Today
that is exactly one contract: `Poisoner`, whose source was published and attributed
by Wintermute.

This is not caution for its own sake. The entire thesis of this project is that
people conflate *volume* with *victimhood*. Conflating *automation* with *malice*
would repeat that exact error in the other direction.

### Output

A categorical label, with the four raw signals always displayed beneath it, so any
label can be audited and disputed against the numbers that produced it.

### Coverage threshold, stated in the UI

Below roughly 20 authorizations the signals are noise: a contract with 3
authorizations from 3 addresses has a 1.00x ratio for lack of data, not because it
is organic.

We classify contracts with **at least 100 authorizations — 23 of 146, covering
94.95% of volume**. The remaining 123 are reported as *insufficient volume to
classify*, with their share of volume declared. Where our evidence ends is shown,
not hidden.

---

## The four archetypes

Each is a distinct behavioural signature drawn from the measured sample.

### Single-operator farm in cycle — `Poisoner`

`0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed` · deployed 2026-02-23 (block 24,522,278)

9,743 authorizations → **1,127 distinct authorities (8.65x)** · **1 relayer** ·
median nonce 2 · **0 of 100 funded**

Source verified and published by Wintermute; the constructor sets
`thief = tx.origin` and `executeBatch` is gated on it. One operator re-delegating
its own address pool in a loop.

**This is the strongest case in the demo:** a contract with verified, published
source that any "is it verified?" heuristic would clear as safe, and that the
behavioural signals flag anyway.

### Fresh-address farm

`0xc43b6c6a43e5760a756a67756b2155c7fa735310` · unverified bytecode (790 bytes)

4,491 authorizations → 3,000 authorities (1.50x) · 3 relayers · **median nonce 0**
· 0 of 100 funded

Nonce 0 across the board: addresses that have never transacted. Generated and
delegated in the same motion.

### Industrial bot

`0x89383882fce7b34fdd0fceb30dcbfc0dd7c6ec54`

895 authorizations → **5 distinct authorities (179x)** · 2 relayers ·
**median nonce 474,629**

A handful of accounts, each having signed hundreds of thousands of times.

### Organic

`0x7702cb554e6bfb442cb743a7df23154544a7176c`

343 authorizations → 343 authorities (**1.00x**) · **343 relayers** ·
median nonce 11 · **74 of 100 funded** · 16.30 ETH

One relayer per authorization, no re-delegation, three quarters of the accounts
hold a balance. Real users. Compare `CaliburEntry` (Uniswap, 83 relayers, 78/100
funded) and `SemiModularAccount7702` (Alchemy, 18 relayers, 54/100 funded).

---

## Headline metrics

| Role | Metric |
|---|---|
| **Claim** | ~89% of EIP-7702 delegation volume comes from single-operator contracts |
| **Primary figure on screen** | 33,074 authorizations = **17,114 wallets** (1.93x; up to 179x per contract) |
| **Supporting figure** | 0.85% vs 34.90% funded wallets — a 41x separation |

The claim goes on top because it is what makes the project memorable. The figure
displayed largest is the one nobody can argue with: it is arithmetic over data we
publish, not a judgement call. When asked "how do you know it is automated?", the
answer is the re-delegation ratio and the relayer count — measurements, not opinions.

**Never claim "$0 at risk."** It is false. Funded wallets exist; they are
concentrated in the organic group. That concentration is the finding.

---

## Pipeline

Public RPC only. No API key, no backend, no wallet connection, no deployed contract.

```
contiguous block windows
  -> filter type-4 transactions
  -> recover authority per authorization tuple  (viem recoverAuthorizationAddress)
  -> deduplicate by authority, per delegate contract
  -> eth_getCode      -> current delegation pointer (0xef0100 || delegate)
  -> eth_getBalance   -> batched balance sample
  -> aggregate the four signals
  -> small pre-aggregated JSON artifact
```

### Sampling: contiguous windows, never strided

10–15 windows of 2,000–3,000 blocks spread from the Pectra activation
(block 22,431,084) to head. ~35,000 blocks, roughly 80 minutes of machine time.
This yields a time series: whether the automated share has grown or shrunk over
16 months, answered before a judge asks it.

> **Strided sampling (every Nth block) is not an option.** The re-delegation ratio
> is authorizations ÷ distinct authorities *within the observed window*. Sampling
> isolated blocks almost never catches the same address twice, so the ratio
> collapses to 1.00x for everything and `Poisoner` reads as organic. The signal
> only exists inside contiguous ranges.

### Browser payload

The offline script does all heavy work — recovery, dedup, balance sampling, daily
aggregation — and emits a **small** JSON: per-day counts, totals, per-contract
signals, and a top-N detail list. The browser never receives tens of thousands of
raw addresses.

### Reproducibility is the argument

For a claim that contradicts published figures, reproducibility *is* the defence. A
judge can run the script; a judge cannot run a Dune query without an account.

The repository ships the scripts **and** the raw dataset, with a README giving the
exact command that regenerates every number in this document.

Dune is used only as an optional independent cross-check in the write-up, never as
a source.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | fast to scaffold |
| Signature recovery | viem `recoverAuthorizationAddress` | validated: 931/931 recovered, zero failures |
| Live feed | Web Worker | secp256k1 recovery off the main thread |
| Data | public JSON-RPC (`ethereum.publicnode.com`) | free, no key, 0 rate-limit errors observed |
| Graph | aggregated nodes (~50), not per-wallet | see below |
| Hosting | Vercel | zero-config |
| Solidity | none | all data is read-only from public RPC |

The graph never renders individual wallets. It renders ~50 aggregate nodes — by
day of delegation, by state, by balance band — each labelled with its count, with
a drill-down table behind each. This scales regardless of victim count, and it
communicates better: 30,000 indistinguishable dots say nothing, while one day's bar
standing eight times taller than the rest tells the story at a glance.

---

## Ten-day plan

| Days | Work | Cut order |
|---|---|---|
| 1–2 | Pipeline → aggregated JSON | — |
| 3 | Thresholds against real data, fix the four archetypes | — |
| 4–5 | **Four comparison cards + headline figures** | **irreducible core** |
| 6–7 | Aggregated graph + time slider | cut second |
| 8 | Live feed in Web Worker | **cut first** |
| 9 | Deck, video, reproducible README | — |
| 10 | Buffer | — |

The four cards with their four signals *are* the thesis. Without them there is no
project, only a viewer. The graph is the visual payoff, and since the aggregation
is by day it is in practice a well-made bar chart — most of the impact is available
from standard visualisation, with Cytoscape as a day-6 upgrade rather than a day-1
risk.

## Deliverables

- Recorded demo video, with a deployed URL as backup. Live demos depend on public
  RPCs responding during judging; Blockscout returned HTTP 500 on a supposedly
  validated endpoint during this project's own research.
- Public repository: scripts, raw dataset, and a README with the exact regeneration
  command.
- Pitch deck.

---

## Honest limits

- The sample is 3,000 contiguous blocks at a single point in time. The temporal
  windows (days 1–2) are what extend this to a defensible claim about the era; until
  they are run, every figure here describes 2026-09-17.
- Balance sampling is capped at 100 authorities per contract.
- The classification covers 94.95% of volume, not all of it.
- Behaviour is not intent. See *What we assert, and what we do not*.
- A single-operator contract is not evidence of crime, and this tool never says it is.

---

## Rejected approaches, and why

Recorded so they are not re-attempted.

| Approach | Why rejected |
|---|---|
| Blockscout `advanced-filters` | Structurally incapable: the documented `transaction_types` enum has no type-4/EIP-7702 value. `?tx_types=eip7702` returns HTTP 422; `?transaction_types=eip7702` returns HTTP 200 **silently ignoring the filter**; the endpoint broadly returns HTTP 500. One mainnet instance, no fallback. |
| Etherscan API v2 | No type-4 filter, no `authorizationList` field. |
| `cryo` | No authorization-list dataset; still needs its own RPC, so it inherits the same bottleneck. |
| Sim (by Dune) | Being sunset; new signups disabled. |
| Dune as primary source | Reintroduces an API-key dependency, and it pre-recovers `authority` — giving away the one piece of engineering that makes this project non-trivial. Kept as optional cross-check only. |
| Full historical backfill | ~1.47M blocks, about 56 hours. Needed only for a propagation timeline of two contracts. The debunk thesis needs breadth, not depth. |
| Strided block sampling | Destroys the re-delegation signal. See *Sampling*. |
| 0–100 risk score | A 0–100 number reads as risk however it is labelled, which would smuggle intent back in after we decided not to assert it. |
| "$0 at risk" as a headline | False. Funded wallets exist and are concentrated in the organic group. |
| Counting `tx.from` as the delegator | Counts relayers. This was the original error. |

---

## Sources

- [EIP-7702 specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Pectra activation — block 22,431,084](https://etherscan.io/block/22431084)
- `Poisoner` verified source — published by Wintermute, on-chain at
  `0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed`
- [Blockaid — address poisoning deep dive](https://www.blockaid.io/blog/a-deep-dive-into-address-poisoning)
- [BundleBear](https://bundlebear.com/eip7702/all) — [open source](https://github.com/Jam516/BundleBear)

Third-party aggregate figures are cited for context only, never as evidence for
this project's claims. Every number in this document is reproducible from the
scripts in this repository.
