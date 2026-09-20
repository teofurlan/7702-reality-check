// Production entry point: scans a contiguous mainnet window via the live RPC
// adapter, computes behavioral signals, samples balances for classifiable
// contracts, assembles the frozen artifact, validates it, and writes
// `data/artifact.json`.
//
// Deliberately has NO `--record` flag: fixture capture is the separate
// `scripts/capture-fixture.mjs` script (design decision 5). A flag here
// would be one typo away from overwriting the golden fixture during a
// production run.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createLiveRpc } from '../src/scan/rpc-live.mjs'
import { scanRange } from '../src/scan/scan.mjs'
import { sampleBalances } from '../src/scan/balances.mjs'
import { computeSignals } from '../src/signals/signals.mjs'
import { isClassifiable } from '../src/signals/threshold.mjs'
import { labelFor } from '../src/signals/labels.mjs'
import { buildArtifact } from '../src/artifact/schema.mjs'
import { validateArtifact } from '../src/artifact/validate.mjs'

const RPC_URL = process.env.RPC_URL ?? 'https://ethereum.publicnode.com'
const DEFAULT_WINDOW_BLOCKS = 3000
const BALANCE_SAMPLE_SIZE = 100

// A public `eth_getBalance` serves state for only ~64 blocks behind head —
// anything older answers "Archive requests require a personal token" (a live
// fact measured against https://ethereum.publicnode.com, not a guess). A
// multi-thousand-block scan takes 10-20+ minutes of wall clock, so pinning
// the balance sample to `toBlock` (the scan window's end) is never safe: by
// the time the scan finishes, `toBlock` is long outside the state window.
// This margin instead pins the sample to a height resolved fresh right
// before the balance-sampling loop starts, backed off from the CURRENT head
// so the pinned height stays inside the ~64-block window for the whole
// batched loop that follows — not just for the first call.
const BALANCE_BLOCK_SAFETY_MARGIN = 8

// A dust-sized balance is not evidence of a real user: this dataset sits
// adjacent to address-poisoning activity, where tiny amounts are deliberately
// sent to addresses to plant them in wallet histories. This is the same
// threshold the superseded exploratory script used (`> 0.0001 ETH`), adopted
// here explicitly so funded-ratio figures stay comparable across runs rather
// than shifting silently with a changed definition of "funded".
const FUNDED_MIN_WEI = 100000000000000n // 0.0001 ETH

// Pacing between scan chunks (see `scanRange`'s `delayMs`). A production run
// fires ~300 batched requests; unpaced, the free public endpoint throttles.
// 60ms is enough for the scan phase specifically — an observed full run
// completed 3,000 blocks at this pace without a single rate-limit error,
// while the balance phase that follows needs the more generous
// `BALANCE_CHUNK_DELAY_MS` because it spends what is left of the quota.
const SCAN_CHUNK_DELAY_MS = 60

// Pacing between balance-sampling batches (see `sampleBalances`'s
// `delayMs`), deliberately more generous than `SCAN_CHUNK_DELAY_MS`: this
// phase runs AFTER the scan, on a rate-limit quota the scan has already
// largely spent over its own ~300 paced batches. A real production run
// observed the balance phase firing its 50-address batches back to back
// with zero pacing, for every classifiable contract, and getting throttled
// (`RpcBatchError: Rate limit exceeded`) minutes into an otherwise-complete
// scan — this constant is the fix for that specific failure.
const BALANCE_CHUNK_DELAY_MS = 250

// Bounded retry budget for a throttled balance-sampling batch, with
// exponential backoff (2s, 4s, 8s between the 4 attempts below). Balance
// sampling is idempotent — a pure read at a pinned block height — so
// retrying it can only ever reproduce the same result a little later, never
// an inconsistent one, which is what makes retrying safe here.
const BALANCE_RETRY_ATTEMPTS = 4
const BALANCE_RETRY_BASE_MS = 2000

const ARTIFACT_FILE = fileURLToPath(new URL('../data/artifact.json', import.meta.url))

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') args.from = Number(argv[++i])
    if (argv[i] === '--to') args.to = Number(argv[++i])
  }
  return args
}

function toHexBlock(blockNumber) {
  return `0x${blockNumber.toString(16)}`
}

/**
 * Converts a wei balance to ETH as a `Number`. Kept as one small, documented
 * helper — rather than inlined at each call site — so the lossy
 * bigint-to-float conversion (unavoidable for a JSON-serializable artifact
 * field) happens in exactly one place.
 *
 * @param {bigint} wei
 * @returns {number}
 */
function weiToEth(wei) {
  return Number(wei) / 1e18
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs `sampleBalances` for one contract with bounded retry and exponential
 * backoff (2s, 4s, 8s between `BALANCE_RETRY_ATTEMPTS` attempts), so a
 * throttled free RPC endpoint degrades one contract's measurement instead of
 * crashing a scan that already took many minutes of successful work to
 * produce. Retrying is safe here because balance sampling is idempotent — a
 * pure read at a pinned block height always answers the same way.
 *
 * Never throws: on final exhaustion it logs a warning naming the delegate
 * and returns `null` so the caller can leave that contract `funded: null`,
 * `sampled: 0`, `totalEth: 0` (the schema's existing nullable discipline for
 * "unmeasured") rather than fabricating a zero balance.
 *
 * @param {Parameters<typeof sampleBalances>[0]} params
 * @param {string} delegate contract address, used only for the warning log
 * @returns {Promise<{ balances: Map<string, bigint>, unresolved: number } | null>}
 */
async function sampleBalancesWithRetry(params, delegate) {
  for (let attempt = 1; attempt <= BALANCE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await sampleBalances(params)
    } catch (error) {
      if (attempt === BALANCE_RETRY_ATTEMPTS) {
        console.error(
          `warning: balance sampling for ${delegate} failed after ${BALANCE_RETRY_ATTEMPTS} attempts ` +
            `(${error.message ?? error}); leaving this contract unmeasured`,
        )
        return null
      }
      const backoffMs = BALANCE_RETRY_BASE_MS * 2 ** (attempt - 1) // 2s, 4s, 8s
      console.error(
        `warning: balance sampling attempt ${attempt}/${BALANCE_RETRY_ATTEMPTS} failed for ${delegate} ` +
          `(${error.message ?? error}); retrying in ${backoffMs}ms`,
      )
      await sleep(backoffMs)
    }
  }
  return null // unreachable: the loop above always returns
}

async function resolveRange(rpc, args) {
  if (Number.isInteger(args.from) && Number.isInteger(args.to)) {
    return { fromBlock: args.from, toBlock: args.to }
  }
  const [latestHex] = await rpc([{ method: 'eth_blockNumber', params: [] }])
  const latest = parseInt(latestHex, 16)
  return { fromBlock: latest - DEFAULT_WINDOW_BLOCKS, toBlock: latest }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rpc = createLiveRpc({ url: RPC_URL })

  const { fromBlock, toBlock } = await resolveRange(rpc, args)
  console.error(`measuring ${fromBlock}..${toBlock}`)

  const scan = await scanRange({ rpc, fromBlock, toBlock, delayMs: SCAN_CHUNK_DELAY_MS })
  console.error(
    `scan done: ${scan.tally.type4TxCount} type4 tx, ${scan.tally.authorizationCount} auths, ` +
      `${scan.records.length} contracts, ${scan.recoveryFailureCount} recovery failures`,
  )

  // Resolved fresh HERE, immediately before balance sampling starts — never
  // pinned to `toBlock` (see `BALANCE_BLOCK_SAFETY_MARGIN` above). The
  // balance sample has always been a present-day snapshot rather than a
  // snapshot at the delegation moment; this makes that explicit and
  // auditable instead of silently impossible.
  const [headHex] = await rpc([{ method: 'eth_blockNumber', params: [] }])
  const head = parseInt(headHex, 16)
  const balanceBlock = head - BALANCE_BLOCK_SAFETY_MARGIN
  console.error(`balance sample pinned to block ${balanceBlock} (head ${head})`)

  const blockTag = toHexBlock(balanceBlock)
  const signalsByDelegate = new Map()

  // Tracked across the loop so a heavily-throttled run is visible in the
  // artifact (`unsampledContracts`, Change 3) and in this run's own log
  // output, instead of looking identical to a clean run that happened to
  // have a low funded ratio.
  let classifiableCount = 0
  let unsampledContracts = 0

  for (const record of scan.records) {
    const classifiable = isClassifiable(record)
    const signals = computeSignals(record)

    let funded = null
    let sampled = 0
    let totalEth = 0
    if (classifiable) {
      classifiableCount += 1
      const addresses = [...record.authorities]
      const result = await sampleBalancesWithRetry(
        { rpc, addresses, blockTag, sampleSize: BALANCE_SAMPLE_SIZE, delayMs: BALANCE_CHUNK_DELAY_MS },
        record.delegate,
      )
      if (result === null) {
        // Every retry was exhausted: this contract stays unmeasured
        // (`funded: null`, `sampled: 0`, `totalEth: 0`, its already-declared
        // defaults above) rather than crashing the whole run or fabricating
        // a zero balance.
        unsampledContracts += 1
      } else {
        const { balances, unresolved } = result
        if (unresolved > 0) {
          console.error(`warning: ${unresolved} unresolved balance(s) for ${record.delegate}`)
        }
        // `sampled` MUST be the number of ACTUALLY resolved balances, not
        // the number requested — otherwise a partially-resolved contract
        // would report a funded ratio over a denominator it did not
        // measure.
        sampled = balances.size
        funded = [...balances.values()].filter((wei) => wei >= FUNDED_MIN_WEI).length
        totalEth = [...balances.values()].reduce((sum, wei) => sum + weiToEth(wei), 0)
      }
    }

    signalsByDelegate.set(record.delegate, {
      ...signals,
      funded,
      sampled,
      totalEth,
      label: classifiable ? labelFor(signals) : 'insufficient-volume',
    })
  }

  console.error(`balance sampling: ${unsampledContracts} of ${classifiableCount} classifiable contracts unmeasured`)

  const artifact = buildArtifact(
    {
      fromBlock,
      toBlock,
      balanceBlock,
      type4TxCount: scan.tally.type4TxCount,
      authorizationCount: scan.tally.authorizationCount,
      recoveryFailureCount: scan.recoveryFailureCount,
      distinctGlobalAuthorityCount: scan.distinctGlobalAuthorityCount,
      perContractAuthoritySumWithOverlap: scan.perContractAuthoritySumWithOverlap,
      unsampledContracts,
    },
    scan.records,
    signalsByDelegate,
  )

  const { valid, errors } = validateArtifact(artifact)
  if (!valid) {
    console.error('artifact failed validation:', errors)
    process.exitCode = 1
    return
  }

  mkdirSync(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true })
  writeFileSync(ARTIFACT_FILE, `${JSON.stringify(artifact, null, 2)}\n`)
  console.error(`wrote ${ARTIFACT_FILE}`)
}

await main()
