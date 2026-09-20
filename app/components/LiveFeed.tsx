import React from 'react';
import { Play, Pause, Radio, ExternalLink, ShieldCheck } from 'lucide-react';
import { useLiveFeed, type LiveFeedState, type LiveDetection } from '../hooks/useLiveFeed';
export type { LiveDetection };

interface LiveFeedProps {
  feed?: LiveFeedState;
}

export function LiveFeed({ feed: externalFeed }: LiveFeedProps) {
  const defaultFeed = useLiveFeed();
  const feed = externalFeed || defaultFeed;
  const {
    isPolling,
    latestBlock,
    detections,
    sessionScannedCount,
    sessionRecoveryFailures,
    togglePolling,
  } = feed;

  return (
    <section className="border-b border-hairline bg-surface-1/25 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-5">
        {/* Header & Status Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              {isPolling && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isPolling ? 'bg-emerald-500' : 'bg-ink-tertiary'
                }`}
              />
            </span>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink font-display">
                  Live Mainnet Ingestion Stream
                </span>
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary font-medium">
                  Web Worker · Off-Thread secp256k1
                </span>
              </div>
              <p className="text-xs text-ink-subtle mt-0.5">
                Real-time Ethereum block monitoring with cryptographic signature recovery on incoming EIP-7702 transactions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="rounded border border-hairline bg-surface-2 px-2.5 py-1 text-ink-muted">
                Block: <span className="text-ink font-medium">{latestBlock ? `#${latestBlock.toLocaleString()}` : 'Connecting...'}</span>
              </span>
              <span className="rounded border border-hairline bg-surface-2 px-2.5 py-1 text-ink-muted">
                Live Detections: <span className="text-emerald-400 font-medium">{detections.length}</span>
              </span>
              <span
                className="rounded border border-hairline bg-surface-2 px-2.5 py-1 text-ink-muted"
                title="Authorization tuples whose signature failed ECDSA recovery this session — counted, never silently dropped"
              >
                Recovery Failures:{' '}
                <span className={sessionRecoveryFailures > 0 ? 'text-amber-400 font-medium' : 'text-ink-muted font-medium'}>
                  {sessionRecoveryFailures}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={togglePolling}
              className="inline-flex items-center gap-1.5 rounded border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-mono text-ink hover:bg-surface-3 transition-colors"
              title={isPolling ? 'Pause live polling' : 'Resume live polling'}
            >
              {isPolling ? (
                <Pause className="h-3 w-3 text-amber-400" />
              ) : (
                <Play className="h-3 w-3 text-emerald-400" />
              )}
              <span>{isPolling ? 'Pause' : 'Resume'}</span>
            </button>
          </div>
        </div>

        {/* Feed Content: Latest 5 Detections or Active Polling Indicator */}
        {detections.length === 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-dashed border-hairline/70 bg-surface-2/30 px-4 py-3.5 font-mono text-xs text-ink-subtle">
            <div className="flex items-center gap-2.5">
              <Radio className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
              <span>
                Monitoring live blocks ({sessionScannedCount} blocks checked) · Awaiting next mainnet block with EIP-7702 transactions...
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-ink-tertiary text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
              <span>Zero UI thread blocking</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {detections.map((item, idx) => {
              const d = item.delegation;
              const isSponsored = d.sender.toLowerCase() !== d.authority.toLowerCase();

              return (
                <div
                  key={`${d.txHash}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg border border-hairline bg-surface-2/60 px-3.5 py-2.5 font-mono text-xs transition-colors hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-ink-tertiary">
                      #{item.blockNumber.toLocaleString()}
                    </span>
                    <span className="text-ink-tertiary">•</span>
                    <span className="text-ink-tertiary">Signer (Authority):</span>
                    <span className="font-semibold text-emerald-400">
                      {d.authority.slice(0, 8)}...{d.authority.slice(-6)}
                    </span>
                    <span className="text-ink-tertiary">→ Target:</span>
                    <span className="text-ink">
                      {d.delegate.slice(0, 8)}...{d.delegate.slice(-6)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isSponsored ? (
                      <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs text-amber-400 font-medium">
                        Sponsored (Relayer: {d.sender.slice(0, 6)}...{d.sender.slice(-4)})
                      </span>
                    ) : (
                      <span className="rounded bg-surface-3 px-2 py-0.5 text-xs text-ink-subtle">
                        Direct Self-Sponsored
                      </span>
                    )}

                    <a
                      href={`https://etherscan.io/tx/${d.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-hover transition-colors"
                    >
                      <span>Etherscan</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
