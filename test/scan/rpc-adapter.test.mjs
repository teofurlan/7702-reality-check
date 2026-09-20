import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rpcKey, RpcBatchError } from '../../src/scan/rpc.mjs'
import { createFixtureRpc } from '../../src/scan/rpc-fixture.mjs'
import { createLiveRpc } from '../../src/scan/rpc-live.mjs'

test('rpcKey joins method and JSON-stringified params with a pipe', () => {
  assert.equal(
    rpcKey({ method: 'eth_getBlockByNumber', params: ['0x1', true] }),
    'eth_getBlockByNumber|["0x1",true]'
  )
})

test('RpcBatchError is a real Error subclass', () => {
  const error = new RpcBatchError('boom')
  assert.ok(error instanceof Error)
  assert.equal(error.name, 'RpcBatchError')
  assert.equal(error.message, 'boom')
})

test('createFixtureRpc resolves recorded calls keyed by method|params', async () => {
  const recorded = {
    'eth_getBlockByNumber|["0x1",true]': { number: '0x1', transactions: [] },
  }
  const rpc = createFixtureRpc(recorded)

  const results = await rpc([{ method: 'eth_getBlockByNumber', params: ['0x1', true] }])

  assert.deepEqual(results, [{ number: '0x1', transactions: [] }])
})

test('createFixtureRpc throws on an unrecorded key instead of returning undefined', async () => {
  const rpc = createFixtureRpc({
    'eth_getBlockByNumber|["0x1",true]': { number: '0x1', transactions: [] },
  })

  await assert.rejects(
    () => rpc([{ method: 'eth_getBlockByNumber', params: ['0x2', true] }]),
    RpcBatchError
  )
})

test('createLiveRpc unwraps .result and re-orders by id', async () => {
  const fetchImpl = async () => ({
    json: async () => [
      { jsonrpc: '2.0', id: 1, result: { number: '0x2' } },
      { jsonrpc: '2.0', id: 0, result: { number: '0x1' } },
    ],
  })
  const rpc = createLiveRpc({ url: 'https://example.invalid', fetchImpl })

  const results = await rpc([
    { method: 'eth_getBlockByNumber', params: ['0x1', true] },
    { method: 'eth_getBlockByNumber', params: ['0x2', true] },
  ])

  assert.deepEqual(results, [{ number: '0x1' }, { number: '0x2' }])
})

test('createLiveRpc retries transport failures and succeeds within the retry budget', async () => {
  let attempts = 0
  const fetchImpl = async () => {
    attempts++
    if (attempts < 2) throw new Error('network blip')
    return { json: async () => [{ jsonrpc: '2.0', id: 0, result: '0x1' }] }
  }
  const rpc = createLiveRpc({ url: 'https://example.invalid', fetchImpl, retries: 3, retryDelayMs: 0 })

  const results = await rpc([{ method: 'eth_blockNumber', params: [] }])

  assert.deepEqual(results, ['0x1'])
  assert.equal(attempts, 2)
})

test('createLiveRpc throws RpcBatchError after exhausting retries, never an empty array', async () => {
  const fetchImpl = async () => {
    throw new Error('always down')
  }
  const rpc = createLiveRpc({ url: 'https://example.invalid', fetchImpl, retries: 3, retryDelayMs: 0 })

  await assert.rejects(
    () => rpc([{ method: 'eth_blockNumber', params: [] }]),
    RpcBatchError
  )
})

test('createLiveRpc throws RpcBatchError on any per-call JSON-RPC error member', async () => {
  const fetchImpl = async () => ({
    json: async () => [
      { jsonrpc: '2.0', id: 0, error: { code: -32000, message: 'execution reverted' } },
    ],
  })
  const rpc = createLiveRpc({ url: 'https://example.invalid', fetchImpl, retries: 3, retryDelayMs: 0 })

  await assert.rejects(
    () => rpc([{ method: 'eth_call', params: [{}] }]),
    RpcBatchError
  )
})
