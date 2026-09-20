import { recoverAuthorizationAddress } from 'viem/utils';

export interface RecoveredDelegation {
  txHash: string;
  sender: string; // tx.from (relayer/sponsor)
  delegate: string; // contract delegated to
  authority: string; // recovered signing wallet
  nonce: number;
  chainId: number;
}

export interface LiveBlockEvent {
  type: 'NEW_DELEGATIONS' | 'BLOCK_SCANNED' | 'STATUS' | 'ERROR';
  blockNumber: number;
  timestamp: number;
  type4Count?: number;
  delegations?: RecoveredDelegation[];
  // Number of authorization tuples in this block whose signature failed to
  // recover to an authority. This is the live-feed counterpart of
  // `src/scan/recover.mjs`'s failure counter (design.md decision 10): a
  // recovery failure that is silently swallowed deflates every distinct
  // authority count downstream, which is exactly the class of error this
  // project exists to catch. Present only on `NEW_DELEGATIONS` events, since
  // that is the only event type that attempts recovery.
  recoveryFailures?: number;
  status?: string;
  error?: string;
}

/** A `0x`-prefixed hex string, as every address/signature field on the RPC wire format is. */
type Hex = `0x${string}`;

/** Raw EIP-7702 authorization tuple as returned by `eth_getBlockByNumber`. */
interface RpcAuthorizationTuple {
  address: Hex;
  chainId: string | number;
  nonce: string | number;
  yParity: string | number;
  r: Hex;
  s: Hex;
}

/** Raw transaction shape as returned by `eth_getBlockByNumber(..., true)`. */
interface RpcTransaction {
  type?: string | number;
  hash: string;
  from?: string;
  authorizationList?: RpcAuthorizationTuple[];
}

/** Raw block shape as returned by `eth_getBlockByNumber(..., true)`. */
interface RpcBlock {
  timestamp?: string;
  transactions?: RpcTransaction[];
}

let isPolling = false;
let lastBlock = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
const RPC_URL = 'https://ethereum.publicnode.com';

function toNumber(val: string | number): number {
  return typeof val === 'string' ? parseInt(val, 16) : val;
}

/**
 * @param method - JSON-RPC method name
 * @param params - JSON-RPC positional params
 * @returns the `result` field of the JSON-RPC response, typed as `T` by the
 *   caller (this function has no way to know the shape in advance — each
 *   call site names it, e.g. `rpcCall<RpcBlock>(...)`, rather than the whole
 *   function returning `any`).
 */
async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP error: ${res.status}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message || 'JSON-RPC error');
  }
  return json.result as T;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function scanLatestBlock() {
  if (!isPolling) return;

  try {
    const blockNumberHex = await rpcCall<string>('eth_blockNumber');
    const currentBlock = parseInt(blockNumberHex, 16);

    if (currentBlock > lastBlock) {
      // Check block with full transaction objects
      const block = await rpcCall<RpcBlock>('eth_getBlockByNumber', [blockNumberHex, true]);
      const blockTimestamp = block?.timestamp ? parseInt(block.timestamp, 16) * 1000 : Date.now();

      if (block && Array.isArray(block.transactions)) {
        const type4Txs = block.transactions.filter(
          (tx: RpcTransaction) => tx.type === '0x4' || tx.type === 4
        );

        if (type4Txs.length > 0) {
          const recoveredList: RecoveredDelegation[] = [];
          let recoveryFailures = 0;

          for (const tx of type4Txs) {
            const authList = tx.authorizationList || [];
            for (const tuple of authList) {
              try {
                const authority = await recoverAuthorizationAddress({
                  authorization: {
                    address: tuple.address,
                    chainId: toNumber(tuple.chainId),
                    nonce: toNumber(tuple.nonce),
                    r: tuple.r,
                    s: tuple.s,
                    yParity: toNumber(tuple.yParity),
                  },
                });

                recoveredList.push({
                  txHash: tx.hash,
                  sender: tx.from?.toLowerCase() || '',
                  delegate: tuple.address?.toLowerCase() || '',
                  authority: authority.toLowerCase(),
                  nonce: toNumber(tuple.nonce),
                  chainId: toNumber(tuple.chainId),
                });
              } catch {
                // A single authorization tuple's signature failed to
                // recover (malformed signature, wrong curve point, etc).
                // Counted and surfaced, never silently dropped.
                recoveryFailures += 1;
              }
            }
          }

          self.postMessage({
            type: 'NEW_DELEGATIONS',
            blockNumber: currentBlock,
            timestamp: blockTimestamp,
            type4Count: type4Txs.length,
            delegations: recoveredList,
            recoveryFailures,
          } satisfies LiveBlockEvent);
        } else {
          self.postMessage({
            type: 'BLOCK_SCANNED',
            blockNumber: currentBlock,
            timestamp: blockTimestamp,
            type4Count: 0,
          } satisfies LiveBlockEvent);
        }
      }

      lastBlock = currentBlock;
    }
  } catch (err: unknown) {
    self.postMessage({
      type: 'ERROR',
      blockNumber: lastBlock,
      timestamp: Date.now(),
      error: errorMessage(err) || 'RPC Polling Error',
    } satisfies LiveBlockEvent);
  }

  // Next poll in 12 seconds (typical Ethereum mainnet block cadence)
  if (isPolling) {
    pollTimer = setTimeout(scanLatestBlock, 12000);
  }
}

self.onmessage = (event: MessageEvent) => {
  const { action } = event.data || {};

  if (action === 'start') {
    if (!isPolling) {
      isPolling = true;
      self.postMessage({
        type: 'STATUS',
        blockNumber: lastBlock,
        timestamp: Date.now(),
        status: 'polling',
      } satisfies LiveBlockEvent);
      scanLatestBlock();
    }
  } else if (action === 'stop') {
    isPolling = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    self.postMessage({
      type: 'STATUS',
      blockNumber: lastBlock,
      timestamp: Date.now(),
      status: 'idle',
    } satisfies LiveBlockEvent);
  }
};
