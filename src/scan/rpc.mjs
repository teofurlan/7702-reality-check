/**
 * @typedef {{ method: string, params: unknown[] }} RpcCall
 * @typedef {(calls: RpcCall[]) => Promise<unknown[]>} RpcAdapter
 */

/**
 * Deterministic per-call fixture key. Two calls with the same method and
 * params (by JSON structural equality) always produce the same key,
 * independent of which batch they were sent in.
 *
 * @param {RpcCall} call
 * @returns {string}
 */
export function rpcKey(call) {
  return `${call.method}|${JSON.stringify(call.params)}`
}

/**
 * Thrown by every RpcAdapter on transport exhaustion, on any per-call
 * JSON-RPC `error` member, or (fixture adapter) on an unrecorded key.
 * An adapter never returns `[]` or `undefined` to signal failure.
 */
export class RpcBatchError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'RpcBatchError'
  }
}
