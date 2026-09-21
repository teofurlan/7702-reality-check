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

      {/* A plain block, deliberately not a column flexbox.
          As `flex flex-col` every section below was a flex item, and a flex
          item's default `min-width: auto` resolves to its min-content width.
          The contracts table's min-content is ~920px, so that section refused
          to shrink to the viewport and pushed the whole document to 920px on a
          phone: the page could be zoomed out, the centred content then hugged
          the left edge, the table spilled off the right, and zooming out widened
          the layout viewport far enough to re-trigger `lg` and bring the corner
          mark back on top of the content. One property, four symptoms.

          The flex bought nothing here — there is no gap and every child is a
          block — so the sections are blocks again and each `overflow-x-auto`
          wrapper finally has a constrained parent to scroll against. */}
      <main className="relative z-10">
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
