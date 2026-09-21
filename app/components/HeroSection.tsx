import { ArrowDown } from 'lucide-react';

interface HeroSectionProps {
  data: {
    globalUnique: number;
  };
}

export function HeroSection({ data }: HeroSectionProps) {
  return (
    <section className="relative px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
      {/* 1. Main Claim / Punchline */}
      <h1
        className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-ink leading-[1.08] mb-6 max-w-4xl mx-auto"
        style={{ letterSpacing: '-0.035em' }}
      >
        The EIP-7702 delegation epidemic is mostly{' '}
        <span className="text-primary-text font-semibold">
          automation
        </span>
        , not victims.
      </h1>

      {/* 2. The Core Thesis */}
      <p className="text-ink-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
        Published figures count raw authorizations and treat <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-ink-subtle border border-hairline">tx.from</code> as the delegating wallet. Both are false. We recovered all {data.globalUnique.toLocaleString()} signing authorities cryptographically from the authorization tuples.
      </p>

      {/* 3. Reproducibility claim: replaces the three methodology badges with
          one claim that also gives a skeptical reader the reproduction path. */}
      <a
        href="https://github.com/teofurlan/7702-reality-check#reproducing-the-measurement"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs font-mono text-ink-subtle text-center mb-10 hover:text-ink-muted transition-colors"
      >
        No API key. Every figure regenerates with{' '}
        <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 text-ink-subtle border border-hairline">npm run measure</code>.
      </a>

      {/* 4. Jump action button */}
      <div className="flex items-center justify-center gap-4">
        <a
          href="#archetypes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold tracking-wide transition-colors shadow-lg shadow-primary/20"
        >
          <span>Explore 4 Archetypes</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </a>
      </div>
    </section>
  );
}
