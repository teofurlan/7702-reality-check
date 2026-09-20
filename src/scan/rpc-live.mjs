import { RpcBatchError } from './rpc.mjs'

/**
 * Builds a live JSON-RPC RpcAdapter. The only I/O module in `src/`.
 *
 * Sends one JSON-RPC batch per call, unwraps `.result` values, and re-orders
 * them to match the input `calls` order by `id` (never assumes the transport
 * preserves batch order). Retries transport failures up to `retries` times
 * with `retryDelayMs` between attempts; any per-call JSON-RPC `error` member
 * throws immediately (it is a valid response, not a transport failure, so
 * retrying it would not change the outcome). Exhausted retries throw
 * `RpcBatchError` — this adapter never resolves to `[]` or `undefined`.
 *
 * @param {{ url: string, fetchImpl?: typeof fetch, retries?: number, retryDelayMs?: number }} options
 * @returns {import('./rpc.mjs').RpcAdapter}
 */
export function createLiveRpc({ url, fetchImpl = fetch, retries = 3, retryDelayMs = 1000 }) {
  return async function liveRpc(calls) {
    const request = calls.map((call, index) => ({
      jsonrpc: '2.0',
      id: index,
      method: call.method,
      params: call.params,
    }))

    let lastError
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const body = await response.json()
        return unwrapResponses(request, body)
      } catch (error) {
        if (error instanceof RpcBatchError) {
          throw error
        }
        lastError = error
        if (attempt < retries) {
          await sleep(retryDelayMs)
        }
      }
    }

    throw new RpcBatchError(
      `RPC batch failed after ${retries} attempts: ${lastError?.message ?? lastError}`,
      { cause: lastError }
    )
  }
}

function unwrapResponses(request, body) {
  const responses = Array.isArray(body) ? body : [body]

  for (const item of responses) {
    if (item && item.error) {
      throw new RpcBatchError(
        `JSON-RPC error for id ${item.id}: ${item.error.message ?? JSON.stringify(item.error)}`
      )
    }
  }

  const byId = new Map(responses.map((item) => [item.id, item]))

  return request.map((req) => {
    const item = byId.get(req.id)
    if (!item) {
      throw new RpcBatchError(`Missing response for request id ${req.id}`)
    }
    return item.result
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
