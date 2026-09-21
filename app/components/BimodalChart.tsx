import React, { useState, useMemo } from 'react';
import {
  contractsByLabel,
  classifiedContracts,
  volumeSharePct,
  fundedRatioPct,
  sumTotalEth,
} from '../../src/artifact/ui-aggregates.mjs';

interface ContractData {
  addr: string;
  auths: number;
  unique: number;
  relayers: number;
  redelegation: number;
  medNonce: number;
  funded: number | null;
  sampled: number;
  totalEth: number;
  label: string;
}

interface ScanData {
  fromBlock: number;
  toBlock: number;
  totalType4Tx: number;
  totalAuths: number;
  uniqueContracts: number;
  globalUnique: number;
  globalRedelegation: number;
  contracts: ContractData[];
}

interface BimodalChartProps {
  data: ScanData;
}

// Sensible minimum so a bar column never collapses to nothing when a group
// happens to be small (or empty) on a given measurement run.
const MIN_COLUMN_FR = 1;

export function BimodalChart({ data }: BimodalChartProps) {
  const [metricMode, setMetricMode] = useState<'eth' | 'funded'>('eth');
  const [hoveredContract, setHoveredContract] = useState<ContractData | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Every grouping below is driven by the pipeline's own `label` field
  // (single source of truth: src/signals/labels.mjs + threshold.mjs), never
  // a relayer/authorization threshold re-derived here.
  const sortedContracts = useMemo(() => {
    return [...classifiedContracts(data.contracts)].sort((a, b) => a.relayers - b.relayers);
  }, [data.contracts]);

  const singleOperatorContracts = useMemo(
    () => contractsByLabel(sortedContracts, 'single-operator'),
    [sortedContracts],
  );
  const mixedContracts = useMemo(
    () => contractsByLabel(sortedContracts, 'mixed-relayers'),
    [sortedContracts],
  );
  const organicContracts = useMemo(
    () => contractsByLabel(sortedContracts, 'organic'),
    [sortedContracts],
  );

  const stats = useMemo(() => {
    const classifiedVolumePct = volumeSharePct(sortedContracts, data.totalAuths);
    const singleOpVolumePct = volumeSharePct(singleOperatorContracts, data.totalAuths);
    const mixedVolumePct = volumeSharePct(mixedContracts, data.totalAuths);
    const organicVolumePct = volumeSharePct(organicContracts, data.totalAuths);
    const singleOpFundedPct = fundedRatioPct(singleOperatorContracts);
    const organicFundedPct = fundedRatioPct(organicContracts);
    const singleOpEth = sumTotalEth(singleOperatorContracts);
    const organicEth = sumTotalEth(organicContracts);
    const classifiedEth = sumTotalEth(sortedContracts);
    const organicEthSharePct = classifiedEth > 0 ? (organicEth / classifiedEth) * 100 : null;

    return {
      classifiedVolumePct,
      singleOpVolumePct,
      mixedVolumePct,
      organicVolumePct,
      singleOpFundedPct,
      organicFundedPct,
      singleOpEth,
      organicEth,
      organicEthSharePct,
    };
  }, [sortedContracts, singleOperatorContracts, mixedContracts, organicContracts, data.totalAuths]);

  // Column widths follow the actual group sizes for this run, rather than
  // the fixed 13/3/10 split baked in for a previous dataset's counts.
  const columnTemplate = `${Math.max(singleOperatorContracts.length, MIN_COLUMN_FR)}fr ${Math.max(mixedContracts.length, MIN_COLUMN_FR)}fr ${Math.max(organicContracts.length, MIN_COLUMN_FR)}fr`;

  // Scaling limits for chart rendering (log scale for authorizations due to wide spread across contracts)
  const maxAuths = useMemo(() => Math.max(1, ...sortedContracts.map((c) => c.auths)), [sortedContracts]);
  const maxEth = useMemo(() => Math.max(1, ...sortedContracts.map((c) => c.totalEth)), [sortedContracts]);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const getArchetype = (c: ContractData) => {
    if (c.addr.toLowerCase() === '0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed') {
      return { name: 'Address Poisoner', tag: 'Poisoner', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' };
    }
    if (c.relayers === 1 && c.funded === 0 && c.medNonce === 0) {
      return { name: 'Fresh-Address Farm', tag: 'Farm', color: 'text-rose-400 border-rose-500/20 bg-rose-500/10' };
    }
    if (c.label === 'single-operator') {
      return { name: 'Single-Operator Bot', tag: 'Automated', color: 'text-purple-400 border-purple-500/20 bg-purple-500/10' };
    }
    return { name: 'Organic Infrastructure', tag: 'Organic', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' };
  };

  // Text description of a column for screen readers, mirroring exactly what
  // the hover inspector shows sighted users — the four behavioural signals,
  // not just the classification color.
  const describeContract = (c: ContractData) => {
    const archetype = getArchetype(c);
    const fundedText = c.sampled > 0 && c.funded !== null
      ? `${c.funded} of ${c.sampled} sampled wallets funded (${((c.funded / c.sampled) * 100).toFixed(1)}%)`
      : 'funded ratio unsampled';
    return `${c.addr}, ${archetype.name}. ${c.relayers} ${c.relayers === 1 ? 'relayer' : 'relayers'}, ${c.auths.toLocaleString()} authorizations, ${c.totalEth.toFixed(4)} ETH verified, ${fundedText}.`;
  };

  // `topShape` gives each zone a shape cue in addition to color, so
  // classification is never conveyed by color alone at this layer (relayer
  // zone banners above already say it in text; this carries it down to the
  // individual bar).
  const renderBars = (contracts: ContractData[], accentHover: string, accentBase: string, topShape: string) =>
    contracts.map((c) => {
      const fundedRatio = c.funded !== null && c.sampled > 0 ? (c.funded / c.sampled) * 100 : 0;

      // Log-scaling for auths height (minimum 12% for visibility, up to 96%)
      const authHeight = Math.max(12, Math.round((Math.log10(c.auths + 1) / Math.log10(maxAuths + 1)) * 95));

      // Height for right bar (ETH or funded ratio)
      const valHeight = metricMode === 'eth'
        ? Math.max(2, Math.min(95, Math.round((c.totalEth / maxEth) * 95)))
        : Math.max(2, Math.min(95, Math.round((fundedRatio / 100) * 95)));

      const isHovered = hoveredContract?.addr === c.addr;
      const focusContract = () => setHoveredContract(c);

      return (
        <div
          key={c.addr}
          role="button"
          tabIndex={0}
          aria-label={describeContract(c)}
          onMouseEnter={focusContract}
          onFocus={focusContract}
          onBlur={focusContract}
          className={`group relative flex h-full items-end justify-center gap-0.5 cursor-pointer rounded-t p-0.5 transition-all ${
            isHovered ? `bg-surface-3 ring-1 ${accentHover}` : 'hover:bg-surface-2'
          }`}
        >
          {/* Auth Bar */}
          <div
            style={{ height: `${authHeight}%` }}
            className={`w-2 sm:w-2.5 rounded-t-sm transition-all duration-300 ${
              isHovered ? 'bg-primary-hover shadow-lg shadow-primary/20' : 'bg-primary/80'
            }`}
          />
          {/* Metric Bar — top shape (square/pill/flat) varies by zone so
              classification survives in grayscale, not just via color. */}
          <div
            style={{ height: `${valHeight}%` }}
            className={`w-2 sm:w-2.5 ${topShape} transition-all duration-300 ${
              isHovered ? accentBase : 'bg-emerald-500/70'
            }`}
          />
        </div>
      );
    });

  const formatPct = (value: number | null, digits = 2) => (value !== null ? `${value.toFixed(digits)}%` : 'n/a');
  const formatEth = (value: number) => `${value.toFixed(2)} ETH`;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="rounded-xl border border-hairline bg-surface-1 p-6 sm:p-8 shadow-2xl transition-all">
        {/* Section Heading & Controls */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-hairline pb-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink font-display">
              Bimodal Relayer Distribution & Capital Asymmetry
            </h2>
            <p className="mt-2 text-sm sm:text-base text-ink-subtle font-body leading-relaxed">
              Distribution of the {sortedContracts.length} classified contracts accounting for{' '}
              {formatPct(stats.classifiedVolumePct)} of all volume. {singleOperatorContracts.length} single-operator
              contracts (≤5 relayers) hold {formatPct(stats.singleOpVolumePct)} of volume with{' '}
              {formatPct(stats.singleOpFundedPct)} funded wallets,{' '}
              {mixedContracts.length === 0
                ? 'an empty gap between 6–14 relayers'
                : `${mixedContracts.length} contract${mixedContracts.length === 1 ? '' : 's'} in the 6–14 relayer gap`}
              , and {formatPct(stats.organicEthSharePct)} of real ETH concentrated in the organic tier (≥15 relayers).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Metric Toggle */}
            <div className="inline-flex rounded-lg border border-hairline bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setMetricMode('eth')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  metricMode === 'eth'
                    ? 'bg-surface-3 text-ink shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                Authorizations vs ETH
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('funded')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  metricMode === 'funded'
                    ? 'bg-surface-3 text-ink shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                Authorizations vs Funded %
              </button>
            </div>
          </div>
        </div>

        {/* Measured Window Readout — only one contiguous window was ever
            scanned, so there is no sub-window to show without measuring it.
            These figures are read straight from `data`, never scaled. */}
        <div className="mt-6 rounded-lg border border-hairline/60 bg-surface-2/60 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-ink-subtle uppercase tracking-wider">Measured Block Window:</span>
              <span className="font-mono text-ink font-medium">
                #{data.fromBlock.toLocaleString()} → #{data.toBlock.toLocaleString()}
              </span>
              <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary-text">
                {(data.toBlock - data.fromBlock).toLocaleString()} blocks
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-ink-tertiary text-xs">
              <span>{data.totalType4Tx.toLocaleString()} Type-4 txs</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-primary" />
              <span className="text-ink">Authorizations (Volume)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" />
              <span className="text-ink">
                {metricMode === 'eth' ? 'ETH Balance' : 'Funded Wallet Ratio (%)'}
              </span>
            </div>
          </div>
          <div className="text-ink-tertiary text-xs">
            Hover column for details • Log-normalized volume bars
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="relative mt-6 overflow-x-auto pb-4">
          <div className="min-w-[760px]">
            {/* Zones Banner */}
            <div className="grid gap-2 mb-3 text-xs font-mono" style={{ gridTemplateColumns: columnTemplate }}>
              <div className="rounded border border-primary/20 bg-primary/5 py-1.5 px-3 text-left">
                <span className="text-primary-text font-semibold">Single-Operator Zone (≤5 Relayers)</span>
                <span className="text-ink-tertiary ml-2">
                  {singleOperatorContracts.length} Contracts • {formatPct(stats.singleOpVolumePct)} Vol • {formatEth(stats.singleOpEth)}
                </span>
              </div>
              <div className="rounded border border-dashed border-hairline-strong bg-surface-2/40 py-1.5 px-2 text-center text-ink-tertiary">
                <span>Mixed-Relayers Zone (6–14 Relayers)</span>
                <div className="text-xs text-amber-500/80 font-medium">
                  {mixedContracts.length} Contract{mixedContracts.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="rounded border border-emerald-500/20 bg-emerald-500/5 py-1.5 px-3 text-right">
                <span className="text-emerald-400 font-semibold">Organic Tier (≥15 Relayers)</span>
                <span className="text-ink-tertiary ml-2">
                  {organicContracts.length} Contracts • {formatPct(stats.organicVolumePct)} Vol • {formatEth(stats.organicEth)}
                </span>
              </div>
            </div>

            {/* Visual Bars Container */}
            <div className="relative h-64 border-b border-hairline bg-surface-2/30 rounded-t-lg p-4 flex items-end">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
                <div className="border-b border-dashed border-hairline w-full" />
                <div className="border-b border-dashed border-hairline w-full" />
                <div className="border-b border-dashed border-hairline w-full" />
                <div className="border-b border-dashed border-hairline w-full" />
              </div>

              {/* Columns Group */}
              <div className="relative z-10 grid gap-2 w-full h-full items-end" style={{ gridTemplateColumns: columnTemplate }}>
                {/* Single-Operator Bars */}
                <div className="grid gap-1.5 h-full items-end" style={{ gridTemplateColumns: `repeat(${Math.max(singleOperatorContracts.length, 1)}, minmax(0, 1fr))` }}>
                  {renderBars(singleOperatorContracts, 'ring-primary/40', 'bg-emerald-400', 'rounded-t-sm')}
                </div>

                {/* Mixed-Relayers Zone (6–14 Relayers) — rendered with real
                    bars whenever the measured window has any, instead of a
                    hardcoded "always empty" placeholder. */}
                {mixedContracts.length > 0 ? (
                  <div className="grid gap-1.5 h-full items-end border-x border-dashed border-hairline px-1" style={{ gridTemplateColumns: `repeat(${mixedContracts.length}, minmax(0, 1fr))` }}>
                    {renderBars(mixedContracts, 'ring-amber-400/40', 'bg-amber-400', 'rounded-t-full')}
                  </div>
                ) : (
                  <div className="relative h-full flex flex-col items-center justify-center border-x border-dashed border-hairline bg-canvas/40 px-2 py-4">
                    <div className="text-center">
                      <span className="font-mono text-xs font-semibold text-amber-400/90 block">GAP (0)</span>
                      <span className="text-xs text-ink-tertiary block mt-1 leading-tight">
                        No contracts with 6–14 relayers
                      </span>
                    </div>
                  </div>
                )}

                {/* Organic Bars */}
                <div className="grid gap-1.5 h-full items-end" style={{ gridTemplateColumns: `repeat(${Math.max(organicContracts.length, 1)}, minmax(0, 1fr))` }}>
                  {renderBars(organicContracts, 'ring-emerald-500/40', 'bg-emerald-400', 'rounded-t-none')}
                </div>
              </div>
            </div>

            {/* X-Axis Relayers Scale Labels */}
            <div className="mt-2 grid gap-2 font-mono text-xs text-ink-subtle" style={{ gridTemplateColumns: columnTemplate }}>
              <div className="flex justify-between px-1">
                <span>1 Relayer</span>
                <span>5 Relayers</span>
              </div>
              <div className="text-center text-ink-tertiary">
                <span>6 — 14</span>
              </div>
              <div className="flex justify-between px-1">
                <span>15 Relayers</span>
                <span>
                  {organicContracts.length > 0 ? Math.max(...organicContracts.map((c) => c.relayers)) : '—'} Relayers
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Contract Inspector Card (When Hovered or Default Focus) */}
        {hoveredContract ? (
          <div className="mt-6 rounded-lg border border-hairline bg-surface-2 p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs sm:text-sm text-ink font-semibold">
                  {hoveredContract.addr}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(hoveredContract.addr)}
                  className="rounded border border-hairline bg-surface-3 px-2 py-0.5 text-xs font-mono text-ink-muted hover:bg-surface-4 transition-colors"
                >
                  {copiedAddr === hoveredContract.addr ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={`https://etherscan.io/address/${hoveredContract.addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-primary-text hover:underline"
                >
                  Etherscan ↗
                </a>
              </div>

              {/* Archetype badge */}
              {(() => {
                const arch = getArchetype(hoveredContract);
                return (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${arch.color}`}>
                    {arch.name}
                  </span>
                );
              })()}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded border border-hairline/60 bg-surface-3/50 p-2.5">
                <span className="text-ink-tertiary text-xs block uppercase">Relayer Count</span>
                <span className="text-ink font-semibold text-sm mt-0.5 block">
                  {hoveredContract.relayers} {hoveredContract.relayers === 1 ? 'relayer' : 'relayers'}
                </span>
              </div>
              <div className="rounded border border-hairline/60 bg-surface-3/50 p-2.5">
                <span className="text-ink-tertiary text-xs block uppercase">Authorizations</span>
                <span className="text-primary-text font-semibold text-sm mt-0.5 block">
                  {hoveredContract.auths.toLocaleString()}
                </span>
              </div>
              <div className="rounded border border-hairline/60 bg-surface-3/50 p-2.5">
                <span className="text-ink-tertiary text-xs block uppercase">Verified ETH</span>
                <span className="text-emerald-400 font-semibold text-sm mt-0.5 block">
                  {hoveredContract.totalEth.toFixed(4)} ETH
                </span>
              </div>
              <div className="rounded border border-hairline/60 bg-surface-3/50 p-2.5">
                <span className="text-ink-tertiary text-xs block uppercase">Funded Wallets</span>
                <span className="text-ink font-semibold text-sm mt-0.5 block">
                  {hoveredContract.sampled > 0 && hoveredContract.funded !== null
                    ? `${hoveredContract.funded} / ${hoveredContract.sampled} (${((hoveredContract.funded / hoveredContract.sampled) * 100).toFixed(1)}%)`
                    : 'Unsampled'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-center rounded-lg border border-dashed border-hairline/70 bg-surface-2/30 py-3 text-center text-xs font-mono text-ink-subtle">
            Hover any column to inspect the contract and its full signal set.
          </div>
        )}
      </div>
    </section>
  );
}
