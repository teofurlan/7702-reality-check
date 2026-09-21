import { ArrowDown, ArrowUpRight } from 'lucide-react';

interface HeroSectionProps {
  data: {
    globalUnique: number;
  };
}

export function HeroSection({ data }: HeroSectionProps) {
  return (
    <section className="relative px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
      {/* 1. Main Claim / Punchline */}
      {/* The claim, and the only place Instrument Serif appears. Weight 400
          and looser tracking than the old Inter setting: a high-contrast serif
          at 600 with -0.035em collides with itself at display size. */}
      <h1
        className="font-claim mx-auto mb-6 max-w-3xl text-4xl font-normal leading-[1.04] text-ink sm:text-6xl lg:text-7xl"
        style={{ letterSpacing: '-0.018em' }}
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

      {/* 3. Two actions: read the evidence, or go regenerate it.
          This used to be a shell command set in 12px mono, wrapped in an
          anchor with no affordance beyond a hover colour. Two problems. It
          broke register - the hero addresses anyone, then handed a terminal
          command to a reader who has not opened one - and it gave the page's
          single most load-bearing warrant its weakest affordance, so nobody
          would ever click it.

          The claim stays above the fold because reproducibility without
          credentials is this project's one non-negotiable commitment and a
          judge may never reach the footer. Only its form changed: a real
          secondary action. `npm run measure` now lives where a reader is
          already in a terminal (the linked README section) and in the
          footer's factual line, instead of interrupting the thesis. */}
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <a
          href="#archetypes"
          className="group inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold tracking-wide text-on-primary transition-all hover:bg-primary-hover hover:shadow-[0_10px_28px_-10px_rgba(130,143,255,0.55)]"
        >
          <span>Explore 4 Archetypes</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </a>

        <a
          href="https://github.com/teofurlan/7702-reality-check#reproducing-the-measurement"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-2/60 px-4 py-2 text-xs font-semibold tracking-wide text-ink-muted backdrop-blur-sm transition-all hover:border-hairline-strong hover:bg-surface-2 hover:text-ink"
        >
          <span>Reproduce it yourself</span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </div>

      <p className="mt-5 font-mono text-xs text-ink-tertiary">
        No API key, no backend, no wallet.
      </p>
    </section>
  );
}
