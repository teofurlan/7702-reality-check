import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @ts-expect-error -- plain ESM seam, deliberately not TypeScript so the
// `node --test` harness can cover it with no build step (see the module).
import { buildSocialCopy } from './src/artifact/social-copy.mjs';

/**
 * Absolute origin for the social-card tags.
 *
 * Open Graph and Twitter scrapers largely ignore a relative `og:image`, so the
 * tags need a real origin at build time. Rather than hardcode a domain the
 * project does not own yet, this reads it from the deploy environment:
 *
 *   SITE_URL                        explicit override, wins over everything
 *   VERCEL_PROJECT_PRODUCTION_URL   the stable production domain on Vercel
 *   VERCEL_URL                      the per-deployment URL (preview builds)
 *
 * The fallback is the default domain Vercel assigns a project with this name.
 * If the real domain differs, set SITE_URL in the project's environment
 * variables and rebuild; nothing else needs to change.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'https://7702-reality-check.vercel.app';
}

/** Minimal escaping for values interpolated into HTML attributes. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Substitutes the social-card placeholders in index.html.
 *
 * `%SITE_URL%` is resolved from the deploy environment (see above) rather than
 * through Vite's `%VITE_*%` env interpolation, so it can know about Vercel's
 * variables and so the result is verifiable in the built output.
 *
 * `%OG_DESCRIPTION%` and `%OG_IMAGE_ALT%` are built from data/artifact.json
 * through `buildSocialCopy`, the same seam `scripts/render-og.mjs` uses for the
 * card image. Both regenerate on every build, so a re-measurement can never
 * leave the preview quoting a figure the page no longer shows.
 */
function socialTagsHtmlPlugin() {
  const siteUrl = resolveSiteUrl();

  return {
    name: 'social-tags-html',
    transformIndexHtml(html: string) {
      const artifact = JSON.parse(
        readFileSync(new URL('./data/artifact.json', import.meta.url), 'utf8'),
      );
      const { description, imageAlt } = buildSocialCopy(artifact);

      return html
        .replaceAll('%SITE_URL%', siteUrl)
        .replaceAll('%OG_DESCRIPTION%', attr(description))
        .replaceAll('%OG_IMAGE_ALT%', attr(imageAlt));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), socialTagsHtmlPlugin()],
  root: '.',
  resolve: {
    alias: {
      '@': import.meta.dirname + '/app',
    },
  },
});
