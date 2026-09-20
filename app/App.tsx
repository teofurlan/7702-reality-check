import rawArtifact from '../data/artifact.json';
import { projectArtifactForUi } from '../src/artifact/ui-projection.mjs';
import { AmbientBackground } from './components/AmbientBackground';
import { HeroSection } from './components/HeroSection';
import { LiveFeed } from './components/LiveFeed';
import { MetricsBar } from './components/MetricsBar';
import { BimodalChart } from './components/BimodalChart';
import { ArchetypeGrid } from './components/ArchetypeGrid';
import { ContractsTable } from './components/ContractsTable';
import { Footer } from './components/Footer';

import { useLiveFeed } from './hooks/useLiveFeed';

// Projected once, at module load, so every component below reads the exact
// same numbers — see `src/artifact/ui-projection.mjs` for why `globalUnique`
// must never be swapped for `perContractSumWithOverlap`.
const data = projectArtifactForUi(rawArtifact);

export function App() {
  const feed = useLiveFeed();

  return (
    <div className="relative min-h-screen bg-canvas text-ink selection:bg-primary/30 selection:text-ink">
      {/* Ambient background with interactive, data-driven EIP-7702 technical prism */}
      <AmbientBackground feed={feed} />

      <main className="relative z-10 flex flex-col">
        <HeroSection data={data} />
        <MetricsBar data={data} />
        <LiveFeed feed={feed} />
        <BimodalChart data={data} />
        <ArchetypeGrid data={data} />
        <ContractsTable data={data} />
      </main>

      <Footer />
    </div>
  );
}
