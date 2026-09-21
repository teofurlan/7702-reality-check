import { useState } from 'react';
import { ExternalLink, Copy, Check, Info, ShieldAlert, Cpu, Sparkles, UserCheck } from 'lucide-react';

interface Contract {
  addr: string;
  auths: number;
  unique: number;
  relayers: number;
  redelegation: number;
  medNonce: number;
  funded: number | null;
  sampled: number;
  totalEth: number;
}

interface ArchetypeGridProps {
  data: { contracts: Contract[] };
}

/**
 * Upper bounds for the signal bars, derived from the measured dataset rather
 * than hardcoded. Fixed denominators were previously calibrated to an older
 * sample (relayers/350, ratio/180) and silently mis-scaled every bar once the
 * data changed.
 */
interface SignalScales {
  maxRelayers: number;
  maxRedelegation: number;
  maxMedNonce: number;
}

interface Archetype {
  id: string;
  title: string;
  addr: string;
  tag: string;
  tagClass: string;
  icon: typeof ShieldAlert;
  description: string;
  takeaway: string;
}

const archetypes: Archetype[] = [
  {
    id: 'poisoner',
    title: 'Poisoner',
    addr: '0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed',
    tag: 'Single-Operator Farm (Loop)',
    tagClass: 'bg-red-950/40 text-red-400 border-red-800/40',
    icon: ShieldAlert,
    description: 'Contract with verified, published source (attributed by Wintermute). The constructor binds thief = tx.origin and gates batch execution to it. One single operator re-delegating its own address pool in an automated cycle.',
    takeaway: 'Verified source on Etherscan does NOT mean safe. Behavioural metrics flag the loop immediately.',
  },
  {
    id: 'fresh-farm',
    title: 'Fresh-Address Farm',
    addr: '0xc43b6c6a43e5760a756a67756b2155c7fa735310',
    tag: 'Industrial Address Generator',
    tagClass: 'bg-amber-950/40 text-amber-400 border-amber-800/40',
    icon: Cpu,
    description: 'Authorizations spread almost one-to-one across distinct authorities, but sponsored by a handful of relayers, and with a median nonce of exactly 0: wallets that never completed a prior on-chain transaction.',
    takeaway: 'Addresses generated and delegated in the exact same motion. No funded accounts in the sample.',
  },
  {
    id: 'industrial-bot',
    title: 'Industrial Bot',
    addr: '0x2e086ac01cb8e6538d393944f02be58d52439ae8',
    tag: 'High-Frequency Re-signer',
    tagClass: 'bg-amber-950/40 text-amber-400 border-amber-800/40',
    icon: Sparkles,
    description: 'Every authorization in the window traces back to a single recovered authority, producing an extreme re-delegation ratio. That authority carries a median nonce in the hundreds of thousands — it has been signing for a very long time.',
    takeaway: 'One address, re-signing on a loop. Enormous delegation volume, exactly one account behind it.',
  },
  {
    id: 'organic',
    title: 'Organic Protocol',
    addr: '0x7702cb554e6bfb442cb743a7df23154544a7176c',
    tag: 'Legitimate User Base',
    tagClass: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40',
    icon: UserCheck,
    description: 'One distinct authority per authorization and one distinct relayer per authorization — a 1.00× ratio with no re-delegation at all. The median nonce reflects real wallet histories rather than fresh burners.',
    takeaway: 'Most sampled wallets hold ETH. Real economic activity, not an address pool.',
  },
];

const SIGNAL_EXPLANATIONS: Record<string, string> = {
  relayers: 'Distinct tx.from addresses sponsoring gas. A low count (≤5) indicates a single automated entity. High counts (≥15) indicate organic users sponsoring their own transactions.',
  redelegation: 'Total authorizations divided by distinct recovered authorities. 1.00× means every authorization came from a different account. Ratios far above 1 reveal the same addresses being re-delegated in loops.',
  nonce: 'Transaction count history of the delegating authorities. Nonce 0 means disposable burner wallets; nonces in the tens/hundreds indicate active personal wallets; nonces in the hundreds of thousands indicate industrial automation.',
  funded: 'Percentage of sampled authorities holding an ETH balance above a dust threshold. Automated farms rarely fund their address pools; the overwhelming majority of the measured ETH sits with the organic cohort.',
};

function SignalIndicator({
  name,
  label,
  value,
  formattedValue,
  pct,
  accentColor,
}: {
  name: string;
  label: string;
  value: number | null;
  formattedValue: string;
  pct: number;
  accentColor?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 relative">
          <span className="text-ink-subtle font-mono text-xs uppercase">{label}</span>
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip((s) => !s)}
            aria-label={`Explain the ${label} signal`}
            className="text-ink-tertiary hover:text-ink transition-colors"
          >
            <Info className="w-3 h-3" />
          </button>

          {showTooltip && (
            <div className="absolute left-0 bottom-6 z-30 w-64 p-2.5 bg-surface-3 border border-hairline-strong rounded text-xs text-ink-muted leading-relaxed shadow-xl">
              {SIGNAL_EXPLANATIONS[name]}
            </div>
          )}
        </div>
        <span className={`font-mono text-xs font-semibold ${accentColor || 'text-ink'}`}>
          {formattedValue}
        </span>
      </div>

      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            accentColor ? 'bg-primary' : 'bg-primary-hover/80'
          }`}
          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function ArchetypeCard({
  archetype,
  contract,
  scales,
}: {
  archetype: Archetype;
  contract?: Contract;
  scales: SignalScales;
}) {
  const [isCopied, setIsCopied] = useState(false);

  // An archetype whose contract does not appear in the measured window is
  // stated, never hidden. Silently rendering nothing is how a dead card went
  // unnoticed once already: the grid still claimed four archetypes while
  // showing three, and nothing in the UI said which one was missing or why.
  if (!contract) {
    return (
      <div className="bg-surface-1 border border-dashed border-hairline rounded-xl p-6 flex flex-col justify-center items-start gap-2">
        <h3 className="text-xl font-semibold text-ink-subtle tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          {archetype.title}
        </h3>
        <p className="text-ink-tertiary text-xs leading-relaxed">
          This archetype's reference contract received no authorizations in the
          measured block window, so there are no signals to show. It is listed
          rather than dropped: an absent card would overstate the coverage of
          this sample.
        </p>
        <span className="font-mono text-xs text-ink-tertiary break-all">
          {archetype.addr}
        </span>
      </div>
    );
  }

  const copyAddr = () => {
    navigator.clipboard.writeText(archetype.addr);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const Icon = archetype.icon;

  return (
    <div className="bg-surface-1 border border-hairline rounded-xl p-6 flex flex-col justify-between hover:border-hairline-strong transition-all duration-200 group">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-2 border border-hairline text-ink">
              <Icon className="w-5 h-5 text-primary-text" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-ink tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                {archetype.title}
              </h3>
              <span className={`inline-block mt-0.5 text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${archetype.tagClass}`}>
                {archetype.tag}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-ink-muted text-xs leading-relaxed mb-4">
          {archetype.description}
        </p>

        {/* Address badge */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-2/60 border border-hairline font-mono text-xs text-ink-tertiary mb-6">
          <span className="truncate text-ink-subtle">
            {archetype.addr.slice(0, 10)}...{archetype.addr.slice(-8)}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyAddr}
              title="Copy contract address"
              aria-label="Copy contract address"
              className="text-ink-tertiary hover:text-ink transition-colors"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={`https://etherscan.io/address/${archetype.addr}`}
              target="_blank"
              rel="noreferrer"
              title="Inspect on Etherscan"
              aria-label="Inspect on Etherscan"
              className="text-ink-tertiary hover:text-primary-text transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 4 Behavioral Signals */}
        <div className="space-y-3.5 pt-4 border-t border-hairline">
          <SignalIndicator
            name="relayers"
            label="Relayer Diversity"
            value={contract.relayers}
            formattedValue={`${contract.relayers} sponsor${contract.relayers === 1 ? '' : 's'}`}
            pct={(contract.relayers / scales.maxRelayers) * 100}
            accentColor={contract.relayers <= 5 ? 'text-red-400' : 'text-emerald-400'}
          />

          {/* Re-delegation and median nonce use a log scale, mirroring
              BimodalChart's authorization bars: both ranges span several
              orders of magnitude (redelegation up to ~1379x, nonce up to
              ~487k), so a linear scale renders every contract but the most
              extreme outlier as an indistinguishable sliver at the floor.
              Relayers and funded ratio stay linear — their ranges are
              well-behaved (bounded counts / percentages). */}
          <SignalIndicator
            name="redelegation"
            label="Re-delegation Ratio"
            value={contract.redelegation}
            formattedValue={`${contract.redelegation.toFixed(2)}×`}
            pct={(Math.log10(1 + contract.redelegation) / Math.log10(1 + scales.maxRedelegation)) * 100}
            accentColor={contract.redelegation > 2 ? 'text-amber-400' : 'text-emerald-400'}
          />

          <SignalIndicator
            name="nonce"
            label="Median Nonce"
            value={contract.medNonce}
            formattedValue={contract.medNonce.toLocaleString()}
            pct={(Math.log10(1 + contract.medNonce) / Math.log10(1 + scales.maxMedNonce)) * 100}
          />

          <SignalIndicator
            name="funded"
            label="Funded Wallets Ratio"
            value={contract.funded}
            formattedValue={
              contract.funded !== null && contract.sampled > 0
                ? `${contract.funded}/${contract.sampled} (${((contract.funded / contract.sampled) * 100).toFixed(0)}%)`
                : 'Not sampled'
            }
            pct={contract.funded !== null && contract.sampled > 0 ? (contract.funded / contract.sampled) * 100 : 0}
            accentColor={contract.funded !== null && contract.funded > 20 ? 'text-emerald-400' : 'text-ink-subtle'}
          />
        </div>
      </div>

      {/* Takeaway footer */}
      <div className="mt-6 pt-3 border-t border-hairline/60">
        <p className="text-xs text-ink-subtle leading-relaxed italic">
          <span className="text-primary-text font-mono not-italic mr-1.5">Evidence:</span>
          {archetype.takeaway}
        </p>
      </div>
    </div>
  );
}

export function ArchetypeGrid({ data }: ArchetypeGridProps) {
  // `Math.max(..., 1)` keeps every bar's denominator positive even for a
  // degenerate dataset, so a bar can never divide by zero and render NaN.
  const scales: SignalScales = {
    maxRelayers: Math.max(...data.contracts.map((c) => c.relayers), 1),
    maxRedelegation: Math.max(...data.contracts.map((c) => c.redelegation), 1),
    maxMedNonce: Math.max(...data.contracts.map((c) => c.medNonce), 1),
  };

  return (
    <section className="px-6 py-20 max-w-6xl mx-auto" id="archetypes">
      <div className="max-w-2xl mb-12">
        <h2 className="text-3xl font-semibold text-ink tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
          The Four Archetypes
        </h2>
        <p className="text-ink-subtle text-sm leading-relaxed">
          EIP-7702 delegation volume is not homogeneous. Every contract leaves a distinct behavioural fingerprint across our four derived signals. We label observable behaviour, never intent.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {archetypes.map((a) => {
          const contract = data.contracts.find((c) => c.addr.toLowerCase() === a.addr.toLowerCase());
          return <ArchetypeCard key={a.id} archetype={a} contract={contract} scales={scales} />;
        })}
      </div>
    </section>
  );
}
