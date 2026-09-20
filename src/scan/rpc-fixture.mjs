import { rpcKey, RpcBatchError } from './rpc.mjs'

/**
 * Builds a fixture RpcAdapter over a fixed map of pre-recorded responses,
 * keyed per call (`method|params`), never per batch. A batch size change
 * (e.g. chunk 10 -> 8) never invalidates a fixture recorded this way.
 *
 * @param {Record<string, unknown>} recorded
 * @returns {import('./rpc.mjs').RpcAdapter}
 */
export function createFixtureRpc(recorded) {
  return async function fixtureRpc(calls) {
    return calls.map((call) => {
      const key = rpcKey(call)
      if (!(key in recorded)) {
        throw new RpcBatchError(`No fixture recorded for call: ${key}`)
      }
      return recorded[key]
    })
  }
}
