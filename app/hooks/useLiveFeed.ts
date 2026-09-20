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

      if (event.blockNumber) {
        setLatestBlock(event.blockNumber);
        setSessionScannedCount((prev) => prev + 1);
      }

      if (event.recoveryFailures) {
        setSessionRecoveryFailures((prev) => prev + event.recoveryFailures!);
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
    togglePolling,
  };
}
