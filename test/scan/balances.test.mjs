import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sampleBalances } from '../../src/scan/balances.mjs'

function createRecordingRpc(balanceOf) {
  const batches = []
  async function rpc(calls) {
    batches.push(calls)
    return calls.map((call) => balanceOf(call.params[0]))
  }
  rpc.batches = batches
  return rpc
}

test('sampleBalances calls eth_getBalance in batches of at most 50', async () => {
  const addresses = Array.from({ length: 120 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`)
  const rpc = createRecordingRpc(() => '0x0')

  const { balances } = await sampleBalances({ rpc, addresses, blockTag: '0x100', sampleSize: 100 })

  assert.equal(balances.size, 100)
  assert.ok(rpc.batches.length >= 2, 'expected more than one batch for 100 addresses')
  for (const batch of rpc.batches) {
    assert.ok(batch.length <= 50, `batch of ${batch.length} exceeds the 50-call chunk size`)
    for (const call of batch) {
      assert.equal(call.method, 'eth_getBalance')
    }
  }
})

test('sampleBalances caps the sampled addresses at sampleSize, never at the full input length', async () => {
  const addresses = Array.from({ length: 10 }, (_, i) => `0xaddr${i}`)
  const rpc = createRecordingRpc(() => '0x64')

  const { balances } = await sampleBalances({ rpc, addresses, blockTag: '0x100', sampleSize: 2 })

  assert.equal(balances.size, 2)
})

test('sampleBalances defaults sampleSize to 100 when unset', async () => {
  const addresses = Array.from({ length: 150 }, (_, i) => `0xaddr${i}`)
  const rpc = createRecordingRpc(() => '0x0')

  const { balances } = await sampleBalances({ rpc, addresses, blockTag: '0x100' })

  assert.equal(balances.size, 100)
})

test('sampleBalances returns a Map<address, bigint> built from real eth_getBalance responses', async () => {
  const addresses = ['0xaaa', '0xbbb']
  const rpc = createRecordingRpc((address) => (address === '0xaaa' ? '0x1a' : '0x0'))

  const { balances, unresolved } = await sampleBalances({ rpc, addresses, blockTag: '0x100', sampleSize: 5 })

  assert.equal(balances.get('0xaaa'), 26n)
  assert.equal(balances.get('0xbbb'), 0n)
  assert.equal(unresolved, 0)
})

test('sampleBalances always uses the pinned blockTag, never "latest"', async () => {
  const addresses = ['0xaaa', '0xbbb']
  const usedTags = new Set()
  async function rpc(calls) {
    for (const call of calls) usedTags.add(call.params[1])
    return calls.map(() => '0x0')
  }

  await sampleBalances({ rpc, addresses, blockTag: '0xdeadbeef', sampleSize: 10 })

  assert.deepEqual([...usedTags], ['0xdeadbeef'])
  assert.ok(!usedTags.has('latest'))
})

test('sampleBalances treats a null eth_getBalance result as unresolved instead of throwing', async () => {
  const addresses = ['0xaaa', '0xbbb']
  const rpc = createRecordingRpc((address) => (address === '0xaaa' ? null : '0x0'))

  const { balances, unresolved } = await sampleBalances({ rpc, addresses, blockTag: '0x100', sampleSize: 5 })

  assert.equal(unresolved, 1)
  assert.equal(balances.has('0xaaa'), false)
  assert.equal(balances.get('0xbbb'), 0n)
  assert.equal(balances.size, 1)
})

test('sampleBalances does not wait between batches when delayMs is unset (default path stays instant and offline)', async () => {
  const addresses = Array.from({ length: 120 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`)
  const rpc = createRecordingRpc(() => '0x0')

  const start = Date.now()
  await sampleBalances({ rpc, addresses, blockTag: '0x100', sampleSize: 100 })
  const elapsedMs = Date.now() - start

  // No pacing was requested, so this must not silently wait between
  // batches — a regression here would slow down every test in the suite.
  assert.ok(elapsedMs < 500, `expected the default (no-delay) path to be fast, took ${elapsedMs}ms`)
})

test('sampleBalances awaits delayMs between eth_getBalance batches when a positive delay is requested', async () => {
  const addresses = Array.from({ length: 120 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`)
  const rpc = createRecordingRpc(() => '0x0')
  const delayMs = 50

  const start = Date.now()
  await sampleBalances({ rpc, addresses, blockTag: '0x100', sampleSize: 100, delayMs })
  const elapsedMs = Date.now() - start

  // 100 addresses at 50/batch = 2 batches = exactly one inter-batch gap.
  assert.ok(
    elapsedMs >= delayMs,
    `expected at least ${delayMs}ms elapsed with an inter-batch delay, took ${elapsedMs}ms`,
  )
})
