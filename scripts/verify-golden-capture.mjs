// Re-fetches the pinned golden range from a LIVE RPC endpoint and diffs it,
// byte-for-byte (normalizing only the JSON-RPC `id` field), against the
// committed files under `test/fixtures/golden/`. This is the check that
// makes the reproducibility claim verifiable rather than declarative: it
// proves the committed fixture was captured from real chain data, not
// fabricated or hand-edited.
//
// Deliberately NOT part of `npm test` — it requires live network access and
// is run manually (or in an optional CI job). Exits 0 and prints a match
// confirmation on success; exits non-zero with a diff summary on mismatch.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { blockNumbersInRange, chunk } from '../src/scan/blocks.mjs'

const RPC_URL = process.env.RPC_URL ?? 'https://ethereum.publicnode.com'
const CHUNK_SIZE = 10
const SLEEP_MS = 60
const RETRIES = 3
const RETRY_DELAY_MS = 1000

const GOLDEN_DIR = fileURLToPath(new URL('../test/fixtures/golden/', import.meta.url))
const GOLDEN_RANGE_FILE = fileURLToPath(new URL('../test/fixtures/golden-range.json', import.meta.url))

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

/**
 * Normalizes only the JSON-RPC `id` field on both sides before comparison.
 * The `id` is an artifact of request/response correlation, not chain
 * content: two independent captures of the same range may legitimately
 * assign different ids depending on batching, without that meaning the
 * captured chain data differs.
 */
function normalizeForComparison(envelope) {
  return JSON.stringify({ ...envelope, id: 0 }, null, 2)
}

async function main() {
  if (readdirSync(GOLDEN_DIR).length === 0) {
    console.error(`No committed fixture files found under ${GOLDEN_DIR}`)
    process.exitCode = 1
    return
  }

  const { fromBlock, toBlock } = JSON.parse(readFileSync(GOLDEN_RANGE_FILE, 'utf8'))
  const blockNumbers = blockNumbersInRange(fromBlock, toBlock)

  const mismatches = []
  let checked = 0

  for (const batch of chunk(blockNumbers, CHUNK_SIZE)) {
    const calls = batch.map((blockNumber) => ({
      method: 'eth_getBlockByNumber',
      params: [toHexBlock(blockNumber), true],
    }))

    const rawResponses = await fetchRawBatch(calls)

    rawResponses.forEach((rawResponse, index) => {
      const blockNumber = batch[index]
      const liveEnvelope = { ...rawResponse, result: pruneBlock(rawResponse.result) }
      const fileName = `eth_getBlockByNumber-${toHexBlock(blockNumber)}.json`

      let committedEnvelope
      try {
        committedEnvelope = JSON.parse(readFileSync(`${GOLDEN_DIR}${fileName}`, 'utf8'))
      } catch (error) {
        mismatches.push({ blockNumber, reason: `missing committed file: ${fileName} (${error.message})` })
        return
      }

      const liveBytes = normalizeForComparison(liveEnvelope)
      const committedBytes = normalizeForComparison(committedEnvelope)

      if (liveBytes !== committedBytes) {
        mismatches.push({ blockNumber, reason: 'byte mismatch after id normalization' })
      }
      checked++
    })

    await sleep(SLEEP_MS)
  }

  if (mismatches.length > 0) {
    console.error(`MISMATCH: ${mismatches.length}/${checked} captured files differ from the live re-fetch:`)
    for (const mismatch of mismatches) {
      console.error(`  block ${mismatch.blockNumber}: ${mismatch.reason}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`MATCH: ${checked} files byte-identical to a fresh live capture of ${fromBlock}..${toBlock}`)
}

await main()
