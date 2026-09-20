// Captures the golden reproducibility fixture: real, unedited JSON-RPC
// responses from Ethereum mainnet for a fixed `--from`/`--to` block range.
//
// This is a deliberately SEPARATE script from `scripts/measure.mjs` (design
// decision 5): a `--record` flag on the production run would be one typo
// away from overwriting a golden fixture. Two distinct script names cannot
// be confused with each other.
//
// One raw JSON-RPC response file is written per captured call under
// `test/fixtures/golden/`, pruned to the fields the pipeline actually reads
// (block `number` + `transactions`; type-4 transactions keep only `type`,
// `from`, and `authorizationList`; every other transaction is reduced to a
// `{ hash, type }` stub so the type-4 filter is still exercised at realistic
// proportions). Pruning is mechanical field removal, never hand-editing —
// the response content itself is untouched.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { blockNumbersInRange, chunk } from '../src/scan/blocks.mjs'

const RPC_URL = process.env.RPC_URL ?? 'https://ethereum.publicnode.com'
const CHUNK_SIZE = 10
const SLEEP_MS = 60
const RETRIES = 3
const RETRY_DELAY_MS = 1000

const GOLDEN_DIR = fileURLToPath(new URL('../test/fixtures/golden/', import.meta.url))
const GOLDEN_RANGE_FILE = fileURLToPath(new URL('../test/fixtures/golden-range.json', import.meta.url))

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') args.from = Number(argv[++i])
    if (argv[i] === '--to') args.to = Number(argv[++i])
  }
  if (!Number.isInteger(args.from) || !Number.isInteger(args.to)) {
    throw new Error('Usage: node scripts/capture-fixture.mjs --from <blockNumber> --to <blockNumber>')
  }
  if (args.to < args.from) {
    throw new Error(`--to (${args.to}) must be >= --from (${args.from})`)
  }
  return args
}

function toHexBlock(blockNumber) {
  return `0x${blockNumber.toString(16)}`
}

function pruneTuple(tuple) {
  return {
    address: tuple.address,
    chainId: tuple.chainId,
    nonce: tuple.nonce,
    r: tuple.r,
    s: tuple.s,
    yParity: tuple.yParity,
  }
}

function pruneTransaction(tx) {
  if (tx.type === '0x4') {
    return {
      type: tx.type,
      from: tx.from,
      authorizationList: (tx.authorizationList ?? []).map(pruneTuple),
    }
  }
  // Non-type-4 transactions are reduced to a stub. This keeps the type-4
  // filter exercised at realistic proportions (a real block is mostly
  // non-type-4 traffic) without paying for fields the pipeline never reads.
  return { hash: tx.hash, type: tx.type }
}

function pruneBlock(block) {
  return {
    number: block.number,
    transactions: (block.transactions ?? []).map(pruneTransaction),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sends one raw JSON-RPC batch and returns the RAW response envelope per
 * call (`{ jsonrpc, id, result }`), re-ordered to match `calls`. Unlike
 * `src/scan/rpc-live.mjs`, this does NOT unwrap `.result` — the golden
 * fixture files must capture the real, unedited JSON-RPC response shape.
 */
async function fetchRawBatch(calls) {
  const request = calls.map((call, index) => ({
    jsonrpc: '2.0',
    id: index,
    method: call.method,
    params: call.params,
  }))

  let lastError
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const body = await response.json()
      const responses = Array.isArray(body) ? body : [body]

      for (const item of responses) {
        if (item && item.error) {
          throw new Error(`JSON-RPC error for id ${item.id}: ${item.error.message ?? JSON.stringify(item.error)}`)
        }
      }

      const byId = new Map(responses.map((item) => [item.id, item]))
      return request.map((req) => {
        const item = byId.get(req.id)
        if (!item) {
          throw new Error(`Missing response for request id ${req.id}`)
        }
        return item
      })
    } catch (error) {
      lastError = error
      if (attempt < RETRIES) {
        await sleep(RETRY_DELAY_MS)
      }
    }
  }
  throw new Error(`RPC batch failed after ${RETRIES} attempts: ${lastError?.message ?? lastError}`)
}

async function main() {
  const { from, to } = parseArgs(process.argv.slice(2))

  mkdirSync(GOLDEN_DIR, { recursive: true })

  const blockNumbers = blockNumbersInRange(from, to)
  let written = 0

  for (const batch of chunk(blockNumbers, CHUNK_SIZE)) {
    const calls = batch.map((blockNumber) => ({
      method: 'eth_getBlockByNumber',
      params: [toHexBlock(blockNumber), true],
    }))

    const rawResponses = await fetchRawBatch(calls)

    rawResponses.forEach((rawResponse, index) => {
      const blockNumber = batch[index]
      const prunedResponse = { ...rawResponse, result: pruneBlock(rawResponse.result) }
      const fileName = `eth_getBlockByNumber-${toHexBlock(blockNumber)}.json`
      writeFileSync(`${GOLDEN_DIR}${fileName}`, `${JSON.stringify(prunedResponse, null, 2)}\n`)
      written++
    })

    console.error(`captured ${written}/${blockNumbers.length}`)
    await sleep(SLEEP_MS)
  }

  writeFileSync(GOLDEN_RANGE_FILE, `${JSON.stringify({ fromBlock: from, toBlock: to }, null, 2)}\n`)
  console.error(`wrote ${written} fixture files under test/fixtures/golden/ + golden-range.json (${from}..${to})`)
}

await main()
