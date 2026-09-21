import { ArrowUpRight } from 'lucide-react';

const REPO_URL = 'https://github.com/teofurlan/7702-reality-check';
const AUTHOR_HANDLE = 'teofurlan';
const AUTHOR_URL = `https://github.com/${AUTHOR_HANDLE}`;

/**
 * The footer carries the reproduction path, not decoration.
 *
 * Reproducibility without credentials is this project's one non-negotiable
 * commitment (PRODUCT.md), and the footer previously asserted it in text -
 * "Fully reproducible" - without linking anywhere a reader could act on it.
 * The only repo link on the page was a small mono line mid-hero. For a page
 * judged in minutes and then read as portfolio work, the source has to be
 * unmissable at the end of the scroll.
 *
 * No brand glyph for GitHub: `lucide-react` v1 dropped its brand icons, and
 * the Octocat silhouette is a filled mark that would clash with the stroke
 * weight of every other icon in the system (DESIGN.md: one consistent stroke
 * and weight). The word does the naming; the arrow does the affordance.
 */
export function Footer() {
  return (
    <footer className="relative border-t border-hairline px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">7702 Reality Check</span>
          {/* The handle stays in Inter, not mono: DESIGN.md's
              Mono-Is-Measurement Rule reserves the monospace face for a
              number, address, unit, or command, and a handle is none of
              those. */}
          <span className="text-sm text-ink-subtle">
            Built by{' '}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-text transition-colors hover:text-primary-hover"
            >
              @{AUTHOR_HANDLE}
            </a>{' '}
            for{' '}
            <a
              href="https://3rd-web-hack.devpost.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-text transition-colors hover:text-primary-hover"
            >
              3rd-Web-Hack
            </a>
          </span>
        </div>

        <div className="flex flex-col gap-2.5 md:items-end">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary-text transition-colors hover:text-primary-hover"
            >
              Source on GitHub
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink-subtle transition-colors hover:text-ink"
            >
              MIT licensed
            </a>
          </div>

          <span className="font-mono text-xs text-ink-tertiary">
            Public RPC only · No API key · No backend · Fully reproducible
          </span>
        </div>
      </div>
    </footer>
  );
}
