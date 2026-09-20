import { useMemo } from 'react';
import {
  contractsByLabel,
  volumeSharePct,
  fundedRatioPct,
  maxRedelegation,
  separationRatio,
} from '../../src/artifact/ui-aggregates.mjs';

interface Contract {
  auths: number;
  relayers: number;
  redelegation: number;
  funded: number | null;
  sampled: number;
  totalEth: number;
  label: string;
}

interface MetricsBarProps {
  data: {
    totalType4Tx: number;
    totalAuths: number;
    globalUnique: number;
    globalRedelegation: number;
    uniqueContracts: number;
    contracts: Contract[];
  };
}

export function MetricsBar({ data }: MetricsBarProps) {
  // Every figure below is derived from `data.contracts` via the shared
  // aggregation helpers (`src/artifact/ui-aggregates.mjs`), grouped by the
  // pipeline's own `label` field — never a re-derived relayer/authorization
  // threshold, and never a literal copied from a previous run's numbers.
  const { fundedSeparation, singleOpFundedPct, organicFundedPct, worstRedelegation } = useMemo(() => {
    const singleOperator = contractsByLabel(data.contracts, 'single-operator');
    const organic = contractsByLabel(data.contracts, 'organic');
    const singleOpFunded = fundedRatioPct(singleOperator);
    const organicFunded = fundedRatioPct(organic);

    return {
      singleOpFundedPct: singleOpFunded,
      organicFundedPct: organicFunded,
      fundedSeparation: separationRatio(organicFunded, singleOpFunded),
      worstRedelegation: maxRedelegation(data.contracts),
    };
  }, [data.contracts]);

  return (
    <section className="border-y border-hairline bg-surface-1/40 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-4 md:divide-x md:divide-hairline">
          {/* Metric 1 */}
          <div className="flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-4">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink font-mono tabular-nums">
              {data.totalType4Tx.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-ink-subtle uppercase tracking-wider mt-1">
              Type-4 Txs
            </span>
            <span className="text-xs text-ink-tertiary mt-0.5">Contiguous window</span>
          </div>

          {/* Metric 2 */}
          <div className="flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-4">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink-muted font-mono tabular-nums">
              {data.totalAuths.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-ink-subtle uppercase tracking-wider mt-1">
              Authorizations
            </span>
            <span className="text-xs text-ink-tertiary mt-0.5">Reported vanity metric</span>
          </div>

          {/* Metric 3: The reality check */}
          <div className="flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-4">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-primary font-mono tabular-nums">
              {data.globalUnique.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-primary-hover uppercase tracking-wider mt-1 font-medium">
              Distinct Wallets
            </span>
            <span className="text-xs text-primary/70 mt-0.5">Recovered via ECDSA</span>
          </div>

          {/* Metric 4: Inflation */}
          <div className="flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-4">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-amber-400 font-mono tabular-nums">
              {data.globalRedelegation.toFixed(2)}×
            </span>
            <span className="text-xs font-mono text-amber-300/80 uppercase tracking-wider mt-1">
              Re-delegation Gap
            </span>
            <span className="text-xs text-amber-400/60 mt-0.5">
              {worstRedelegation !== null
                ? `Up to ${worstRedelegation.toFixed(0)}× per contract`
                : 'Per-contract worst case unavailable'}
            </span>
          </div>

          {/* Metric 5: Economic separation */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-4">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-400 font-mono tabular-nums">
              {fundedSeparation !== null ? `${fundedSeparation.toFixed(0)}×` : 'n/a'}
            </span>
            <span className="text-xs font-mono text-emerald-300/80 uppercase tracking-wider mt-1">
              Funded Separation
            </span>
            <span className="text-xs text-emerald-400/60 mt-0.5">
              {singleOpFundedPct !== null && organicFundedPct !== null
                ? `${singleOpFundedPct.toFixed(2)}% vs ${organicFundedPct.toFixed(2)}% funded`
                : 'Funded ratio unavailable'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
