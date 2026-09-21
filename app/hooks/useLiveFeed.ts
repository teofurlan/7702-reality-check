import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveBlockEvent, RecoveredDelegation } from '../workers/feed.worker';

export interface LiveDetection {
  blockNumber: number;
  timestamp: number;
  delegation: RecoveredDelegation;
}

export interface LiveFeedState {
  isPolling: boolean;
  latestBlock: number | null;
  detections: LiveDetection[];
  sessionScannedCount: number;
  lastDetection: LiveDetection | null;
  lastDetectionAt: number | null;
  pulseTrigger: number;
  // Cumulative count of authorization tuples that failed ECDSA recovery
  // this session, across every scanned block. Surfaced in the UI rather
  // than swallowed — see `feed.worker.ts`'s `LiveBlockEvent.recoveryFailures`.
  sessionRecoveryFailures: number;
  // Message from the worker's most recent `ERROR` event (e.g. a throttled or
  // unreachable public RPC), or `null` once a block has been scanned
  // successfully again. Without this, an RPC failure leaves the UI stuck on
  // "Connecting..." forever with no explanation — see `feed.worker.ts`.
  lastError: string | null;
  togglePolling: () => void;
}

export function useLiveFeed(): LiveFeedState {
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [detections, setDetections] = useState<LiveDetection[]>([]);
  const [sessionScannedCount, setSessionScannedCount] = useState<number>(0);
  const [lastDetection, setLastDetection] = useState<LiveDetection | null>(null);
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [pulseTrigger, setPulseTrigger] = useState<number>(0);
  const [sessionRecoveryFailures, setSessionRecoveryFailures] = useState<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const isPollingRef = useRef<boolean>(true);

  // Synchronize ref with state for event handlers
  useEffect(() => {
    isPollingRef.current = isPolling;
  }, [isPolling]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/feed.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<LiveBlockEvent>) => {
      const event = e.data;

      // An RPC failure (e.g. the public endpoint throttling) is surfaced
      // rather than left to strand the UI on "Connecting..." forever. It
      // does not count as a scanned block, so we return before touching
      // `latestBlock`/`sessionScannedCount`.
      if (event.type === 'ERROR') {
        setLastError(event.error || 'RPC polling error');
        return;
      }

      if (event.blockNumber) {
        setLatestBlock(event.blockNumber);
        setSessionScannedCount((prev) => prev + 1);
      }

      if (event.recoveryFailures) {
        setSessionRecoveryFailures((prev) => prev + event.recoveryFailures!);
      }

      // A successful block scan means the RPC is healthy again — clear any
      // previously surfaced error.
      if (event.type === 'BLOCK_SCANNED' || event.type === 'NEW_DELEGATIONS') {
        setLastError(null);
      }

      // Filter: ONLY record events that actually contain recovered EIP-7702 delegations
      if (event.type === 'NEW_DELEGATIONS' && event.delegations && event.delegations.length > 0) {
        const newHits: LiveDetection[] = event.delegations.map((d) => ({
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          delegation: d,
        }));

        setDetections((prev) => [...newHits, ...prev].slice(0, 5));
        setLastDetection(newHits[0]);
        setLastDetectionAt(Date.now());
        setPulseTrigger((prev) => prev + 1);
      }
    };

    worker.postMessage({ action: 'start' });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        worker.postMessage({ action: 'stop' });
      } else if (isPollingRef.current) {
        worker.postMessage({ action: 'start' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      worker.postMessage({ action: 'stop' });
      worker.terminate();
    };
  }, []);

  const togglePolling = useCallback(() => {
    if (!workerRef.current) return;
    setIsPolling((prev) => {
      const next = !prev;
      isPollingRef.current = next;
      workerRef.current?.postMessage({ action: next ? 'start' : 'stop' });
      return next;
    });
  }, []);

  return {
    isPolling,
    latestBlock,
    detections,
    sessionScannedCount,
    lastDetection,
    lastDetectionAt,
    pulseTrigger,
    sessionRecoveryFailures,
    lastError,
    togglePolling,
  };
}
