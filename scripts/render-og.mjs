// Renders `public/og.png`, the social preview card, from the measured
// artifact rather than from typed-in numbers.
//
// Every figure on the card is read through the exact seams the UI uses --
// `projectArtifactForUi` plus the `ui-aggregates` helpers -- so the preview
// can never claim a number the page does not show. `npm run measure` changes
// the dataset; `npm run og` regenerates the card from it. A hand-typed card
// would be one re-measurement away from advertising a stale figure, which is
// the class of error this whole project exists to correct.
//
// Rasterisation goes through headless Edge/Chrome because it is already on
// the machine and needs no new dependency. No runtime dependency is added to
// the app: this is an authoring script, run by hand, and its output is a
// committed static asset.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { projectArtifactForUi } from '../src/artifact/ui-projection.mjs'
import {
  contractsByLabel,
  fundedRatioPct,
  maxRedelegation,
  separationRatio,
} from '../src/artifact/ui-aggregates.mjs'

const ARTIFACT = fileURLToPath(new URL('../data/artifact.json', import.meta.url))
const OUT_PNG = fileURLToPath(new URL('../public/og.png', import.meta.url))
const TMP_HTML = fileURLToPath(new URL('../public/.og-render.html', import.meta.url))
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))

// The same faces app/index.css bundles. Referenced as file:// URLs because the
// render HTML is loaded from disk, not served.
const FONT_SANS = new URL(
  '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  import.meta.url,
).href
const FONT_MONO = new URL(
  '../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  import.meta.url,
).href
const FONT_CLAIM = new URL(
  '../node_modules/@fontsource/gloock/files/gloock-latin-400-normal.woff2',
  import.meta.url,
).href

// Facebook, X, LinkedIn and Slack all read a 1.91:1 card at this size.
const WIDTH = 1200
const HEIGHT = 630

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function resolveBrowser() {
  const found = BROWSERS.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      'no Chrome or Edge binary found for rasterisation; set CHROME_PATH to one',
    )
  }
  return found
}

function fmtInt(n) {
  return n.toLocaleString('en-US')
}

/** The measured figures, read through the same seams the page reads. */
function readFigures() {
  const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'))
  const data = projectArtifactForUi(artifact)

  const singleOperator = contractsByLabel(data.contracts, 'single-operator')
  const organic = contractsByLabel(data.contracts, 'organic')
  const singleOpFunded = fundedRatioPct(singleOperator)
  const organicFunded = fundedRatioPct(organic)
  const separation = separationRatio(organicFunded, singleOpFunded)
  const worst = maxRedelegation(data.contracts)

  return {
    totalAuths: data.totalAuths,
    globalUnique: data.globalUnique,
    globalRedelegation: data.globalRedelegation,
    separation,
    worst,
    fromBlock: data.fromBlock,
    toBlock: data.toBlock,
    recoveryFailures: data.recoveryFailures,
  }
}

/**
 * The card. Built to DESIGN.md: Ledger Black canvas, the two-pole atmosphere,
 * hairline structure with no resting shadow, Reported Grey on the vanity
 * metric and the axis hues on the findings.
 *
 * The card loads the same two self-hosted woff2 files the app bundles, read
 * straight out of node_modules, so the preview is set in the same faces a
 * visitor sees. Left on the platform sans it would have quietly advertised a
 * different typeface than the page it links to.
 */
function buildHtml(f) {
  const stat = (value, label, note, colorVar) => `
    <div class="stat">
      <span class="stat-value" style="color:var(${colorVar})">${value}</span>
      <span class="stat-label">${label}</span>
      <span class="stat-note">${note}</span>
    </div>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Inter Variable';
    font-style: normal;
    font-weight: 100 900;
    src: url('${FONT_SANS}') format('woff2-variations');
  }
  @font-face {
    font-family: 'JetBrains Mono Variable';
    font-style: normal;
    font-weight: 100 800;
    src: url('${FONT_MONO}') format('woff2-variations');
  }
  @font-face {
    font-family: 'Gloock';
    font-style: normal;
    font-weight: 400;
    src: url('${FONT_CLAIM}') format('woff2');
  }
  :root {
    --canvas:#030308; --ink:#f7f8f8; --ink-muted:#d0d6e0; --ink-subtle:#8a8f98;
    --ink-tertiary:#7a7e88; --hairline:#23252a;
    --primary-text:#828fff; --automation-text:#fbbf24; --organic-text:#34d399;
    --volume-text:#9ba3af;
    --sans: 'Inter Variable', system-ui, -apple-system, sans-serif;
    --claim: 'Gloock', Georgia, serif;
    --mono: 'JetBrains Mono Variable', ui-monospace, 'Fira Code', monospace;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { width:${WIDTH}px; height:${HEIGHT}px; overflow:hidden; }
  body {
    position:relative; background:var(--canvas); color:var(--ink);
    font-family:var(--sans); -webkit-font-smoothing:antialiased;
  }
  /* Atmosphere: the same two poles, amber left and emerald right. */
  .atmos { position:absolute; inset:0; overflow:hidden; }
  .atmos i { position:absolute; display:block; border-radius:999px; filter:blur(120px); }
  .pole-a { left:-16%; top:-10%; width:700px; height:700px;
    background:radial-gradient(circle, rgba(245,166,35,.24) 0%, rgba(214,138,26,.11) 45%, transparent 72%); }
  .pole-o { right:-12%; bottom:-18%; width:740px; height:740px;
    background:radial-gradient(circle, rgba(16,185,129,.26) 0%, rgba(13,148,136,.11) 46%, transparent 74%); }
  .core { left:56%; top:42%; width:820px; height:820px; transform:translate(-50%,-50%);
    background:radial-gradient(circle, rgba(94,106,210,.22) 0%, rgba(94,106,210,.07) 50%, transparent 76%); }
  .grid { position:absolute; inset:0; opacity:.14;
    background-image:radial-gradient(#34343a 1px, transparent 1px); background-size:30px 30px;
    mask-image:linear-gradient(to bottom, #000 0%, rgba(0,0,0,.3) 55%, #000 100%);
    -webkit-mask-image:linear-gradient(to bottom, #000 0%, rgba(0,0,0,.3) 55%, #000 100%); }

  /* Generous safe margins: several networks crop a card's edges, so nothing
     load-bearing sits near one. */
  .card { position:relative; z-index:1; height:100%;
    display:flex; flex-direction:column; padding:48px 60px 46px; }

  .brand { display:flex; align-items:center; gap:13px; flex:0 0 auto; }
  .brand-name { font-size:18px; font-weight:600; letter-spacing:-.01em; }
  .brand-sep { color:var(--ink-tertiary); }
  .brand-window { font-family:var(--mono); font-size:12.5px; color:var(--ink-tertiary); }

  /* Two columns so the headline has a real measure and the mark occupies the
     right instead of leaving it dead. */
  .body { flex:1 1 auto; display:flex; align-items:center; gap:40px; padding:30px 0 26px; }
  .copy { flex:1 1 auto; min-width:0; }
  .mark { flex:0 0 auto; width:236px; display:flex; align-items:center; justify-content:center; }

  h1 { font-family:var(--claim); font-size:56px; line-height:1.04;
       letter-spacing:-.018em; font-weight:400; }
  h1 em { font-style:normal; color:var(--primary-text); }
  .sub { margin-top:18px; font-size:17.5px; line-height:1.55; color:var(--ink-muted); max-width:56ch; }
  .sub code { font-family:var(--mono); font-size:15px; color:var(--ink-subtle); }

  .stats { flex:0 0 auto; display:flex; gap:52px;
    padding-top:22px; border-top:1px solid var(--hairline); }
  .stat { display:flex; flex-direction:column; gap:3px; }
  .stat-value { font-family:var(--mono); font-size:32px; font-weight:600;
    letter-spacing:-.02em; font-variant-numeric:tabular-nums; line-height:1.1; }
  .stat-label { font-family:var(--mono); font-size:10.5px; letter-spacing:.09em;
    text-transform:uppercase; color:var(--ink-subtle); }
  .stat-note { font-size:12px; color:var(--ink-tertiary); }
</style></head>
<body>
  <div class="atmos">
    <i class="pole-a"></i><i class="pole-o"></i><i class="core"></i>
    <div class="grid"></div>
  </div>

  <div class="card">
    <div class="brand">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <polygon points="16,2 5,16.5 16,21.5" fill="#fbbf24"/>
        <polygon points="16,2 27,16.5 16,21.5" fill="#34d399"/>
        <polygon points="16,24 5,18 16,30" fill="#fbbf24" fill-opacity="0.78"/>
        <polygon points="16,24 27,18 16,30" fill="#34d399" fill-opacity="0.78"/>
        <line x1="16" y1="2" x2="16" y2="21.5" stroke="#030308" stroke-width="1.1"/>
        <line x1="16" y1="24" x2="16" y2="30" stroke="#030308" stroke-width="1.1"/>
      </svg>
      <span class="brand-name">7702 Reality Check</span>
      <span class="brand-sep">/</span>
      <span class="brand-window">blocks ${fmtInt(f.fromBlock)} &ndash; ${fmtInt(f.toBlock)} &middot; ${f.recoveryFailures} recovery failures</span>
    </div>

    <div class="body">
      <div class="copy">
        <h1>The EIP-7702 delegation epidemic is mostly <em>automation</em>, not victims.</h1>
        <p class="sub">
          <code>tx.from</code> is the gas sponsor, not the signer. We recovered every
          signing authority cryptographically and deduplicated across all delegate
          contracts.
        </p>
      </div>

      <!-- The octahedron the page carries in its hero, echoed here as the
           right-hand anchor. Wireframe is legible at this size, unlike at
           favicon scale, so it matches the page rather than the icon. -->
      <div class="mark">
        <svg width="236" height="236" viewBox="0 0 320 320" aria-hidden="true">
          <circle cx="160" cy="160" r="130" stroke="rgba(255,255,255,0.07)" stroke-width="1" fill="none"/>
          <circle cx="160" cy="160" r="90" stroke="rgba(94,106,210,0.22)" stroke-width="1"
                  stroke-dasharray="4 6" fill="none"/>
          <polygon points="160,50 208,145 160,172 112,145" fill="rgba(94,106,210,0.12)"
                   stroke="rgba(165,180,252,0.7)" stroke-width="1.6"/>
          <polygon points="160,50 208,145 160,128" fill="rgba(130,143,255,0.16)"/>
          <polygon points="160,50 112,145 160,128" fill="rgba(94,106,210,0.24)"/>
          <line x1="160" y1="50" x2="160" y2="172" stroke="rgba(255,255,255,0.8)" stroke-width="1.6"/>
          <polygon points="160,188 208,155 160,250 112,155" fill="rgba(94,106,210,0.08)"
                   stroke="rgba(165,180,252,0.6)" stroke-width="1.6"/>
          <line x1="160" y1="188" x2="160" y2="250" stroke="rgba(255,255,255,0.65)" stroke-width="1.6"/>
          <!-- The recovered authority, and the delegate it points at. -->
          <path d="M 160,50 C 120,40 75,70 75,115" stroke="rgba(52,211,153,0.75)"
                stroke-width="1.9" stroke-dasharray="4 4" fill="none"/>
          <circle cx="75" cy="115" r="5" fill="#10b981"/>
          <path d="M 160,172 C 160,215 240,205 240,245" stroke="rgba(251,191,36,0.75)"
                stroke-width="1.9" stroke-dasharray="4 4" fill="none"/>
          <circle cx="240" cy="245" r="4.5" fill="#fbbf24"/>
        </svg>
      </div>
    </div>

    <div class="stats">
      ${stat(fmtInt(f.totalAuths), 'Authorizations', 'Reported vanity metric', '--volume-text')}
      ${stat(fmtInt(f.globalUnique), 'Distinct wallets', 'Recovered via ECDSA', '--primary-text')}
      ${stat(
        `${f.globalRedelegation.toFixed(2)}×`,
        'Re-delegation gap',
        f.worst === null ? 'Per-contract worst case unavailable' : `Up to ${f.worst.toFixed(0)}× per contract`,
        '--automation-text',
      )}
      ${stat(
        f.separation === null ? 'n/a' : `${f.separation.toFixed(0)}×`,
        'Funded separation',
        'Automation vs. real accounts',
        '--organic-text',
      )}
    </div>
  </div>
</body></html>`
}

function main() {
  const figures = readFigures()
  mkdirSync(PUBLIC_DIR, { recursive: true })
  writeFileSync(TMP_HTML, buildHtml(figures))

  const browser = resolveBrowser()
  try {
    execFileSync(
      browser,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--virtual-time-budget=3000',
        `--window-size=${WIDTH},${HEIGHT}`,
        `--screenshot=${OUT_PNG}`,
        `file:///${TMP_HTML.replace(/\\/g, '/')}`,
      ],
      { stdio: 'ignore' },
    )
  } finally {
    rmSync(TMP_HTML, { force: true })
  }

  if (!existsSync(OUT_PNG)) {
    throw new Error('rasterisation produced no file')
  }

  console.error(
    `wrote ${OUT_PNG} (${WIDTH}x${HEIGHT}) from blocks ` +
      `${figures.fromBlock}..${figures.toBlock}: ` +
      `${fmtInt(figures.totalAuths)} authorizations, ` +
      `${fmtInt(figures.globalUnique)} distinct wallets`,
  )
}

main()
