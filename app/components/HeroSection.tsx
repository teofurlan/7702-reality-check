import { ArrowDown, Database, Cpu, ShieldCheck } from 'lucide-react';

interface HeroSectionProps {
  data: {
    fromBlock: number;
    toBlock: number;
    globalUnique: number;
  };
}

export function HeroSection({ data }: HeroSectionProps) {
  const blockSpan = data.toBlock - data.fromBlock;

  return (
    <section className="relative px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
      {/* 1. Technical Status Pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1/80 border border-hairline mb-8 shadow-sm backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-mono text-ink-muted">
          Ethereum Mainnet · {blockSpan.toLocaleString()} Contiguous Blocks ({data.fromBlock.toLocaleString()} – {data.toBlock.toLocaleString()})
        </span>
      </div>

      {/* 2. Main Claim / Punchline */}
      <h1
        className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-ink leading-[1.08] mb-6 max-w-4xl mx-auto"
        style={{ letterSpacing: '-0.035em' }}
      >
        The EIP-7702 delegation epidemic is mostly{' '}
        <span className="text-primary font-semibold">
          automation
        </span>
        , not victims.
      </h1>

      {/* 3. The Core Thesis */}
      <p className="text-ink-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
        Published figures count raw authorizations and treat <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-ink-subtle border border-hairline">tx.from</code> as the delegating wallet. Both are false. We recovered all {data.globalUnique.toLocaleString()} signing authorities cryptographically from the authorization tuples.
      </p>

      {/* 4. Methodology Badges */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-ink-subtle mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-1/60 border border-hairline">
          <Cpu className="w-3.5 h-3.5 text-primary" />
          ECDSA Public Key Recovery
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-1/60 border border-hairline">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          No API Keys · Public JSON-RPC
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-1/60 border border-hairline">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          Behaviour Labeling, Never Intent
        </span>
      </div>

      {/* 5. Jump action buttons */}
      <div className="flex items-center justify-center gap-4">
        <a
          href="#archetypes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold tracking-wide transition-colors shadow-lg shadow-primary/20"
        >
          <span>Explore 4 Archetypes</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </a>

        <a
          href="#contracts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-surface-1 hover:bg-surface-2 text-ink border border-hairline hover:border-hairline-strong text-xs font-mono transition-colors"
        >
          View Contracts Table
        </a>
      </div>
    </section>
  );
}
