---
name: 7702 Reality Check
description: A forensic measurement instrument for EIP-7702 delegation, where every label carries the evidence that produced it.
colors:
  canvas: "#030308"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  ink-tertiary: "#7a7e88"
  primary: "#5e6ad2"
  primary-hover: "#828fff"
  primary-text: "#828fff"
  on-primary: "#ffffff"
  automation: "#f5a623"
  automation-text: "#fbbf24"
  automation-dim: "#7c5a12"
  organic: "#10b981"
  organic-text: "#34d399"
  organic-dim: "#0b5c42"
  volume: "#6b7280"
  volume-text: "#9ba3af"
  evidence: "#e5484d"
  evidence-text: "#f87171"
typography:
  display:
    fontFamily: "Gloock, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.25rem, 6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.018em"
  headline:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Fira Code, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.05em"
  readout:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Fira Code, monospace"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tabular-nums"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "24px"
  lg: "48px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  badge-automation:
    backgroundColor: "{colors.automation-dim}"
    textColor: "{colors.automation-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-organic:
    backgroundColor: "{colors.organic-dim}"
    textColor: "{colors.organic-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-neutral:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.volume-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input-search:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 12px 8px 36px"
  tab-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  tab-idle:
    backgroundColor: "transparent"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: 7702 Reality Check

## Overview

**Creative North Star: "The Forensic Ledger"**

This is not a page that argues. It is a ledger that lays evidence out and lets
the reader convict or acquit. Every classification on the surface sits directly
above the four numbers that produced it; the inflated figure the project exists
to debunk is kept on the page, beside the corrected one, because deleting the
error would leave the correction unmotivated. Nothing is asserted that the
measurement cannot carry.

The material consequence is restraint with teeth. Data is set in monospace with
tabular figures so columns of numbers align into a readable ledger rather than
a paragraph of digits. Prose is set in Inter and kept short. The canvas is a
near-black with a faint violet cast, not as a style choice but as the condition
for reading faint light: the whole page floats on a slow atmospheric field whose
weighting travels the argument, amber-heavy where the reported volume lives and
emerald-heavy where the money that actually exists is. That field is the only
decorative element in the system, and it is not decorative — it is the thesis
rendered as light.

The system refuses two things absolutely. It refuses a verdict it has not
earned: no 0–100 risk score, no red applied to automation, no language that
imputes intent where only behaviour was measured. And it refuses to make the
reported figure attractive: volume is drawn as inert neutral mass, because it is
the largest number on the page and the least meaningful one.

**Key Characteristics:**

- Evidence sits under every label, never behind a disclosure.
- Two hues carry one axis; subtypes are carried by words.
- Volume reads as mass, not as accent.
- Depth is light and state, never a resting shadow.
- The atmosphere answers to recovered chain data, not to a timer.

## Colors

A near-black field with two opposed data hues and a deliberately unattractive
neutral for the number the project disputes.

### Primary

- **Recovery Violet** (`primary` / `primary-hover`): the signature-recovery
  machinery and the interface itself — links, the one CTA, focus rings, the
  octahedron wireframe, the ambient core. It also carries the recovered
  headline figure (`distinctGlobalAuthorityCount`), because that number is the
  instrument's own output and names no tier. What it never marks is a position
  on the behavioural axis: no contract, tier, or signal reading is violet. The
  lighter variant is the text-safe form and the hover state.

### Secondary

The behavioural axis. These two are the only hues permitted to classify data.

- **Automation Amber** (`automation` / `automation-text` / `automation-dim`):
  contracts the instrument flagged as operated by few relayers, the
  re-delegation gap, fresh-address readings, and recovery failures in the live
  feed. Amber means *the instrument marked this*, not *this is guilty*.
- **Organic Emerald** (`organic` / `organic-text` / `organic-dim`): relayer
  diversity at the organic end, funded-wallet ratios, verified ETH, and live
  connection state. It marks accounts that hold real money.

### Tertiary

- **Evidence Red** (`evidence` / `evidence-text`): reserved for the single
  archetype carrying independently published attribution. It is expected to
  appear exactly once on the page.

### Neutral

- **Reported Grey** (`volume` / `volume-text`): the authorization count and
  every bar that represents it. Neutral on purpose.
- **Ledger Black** (`canvas`): the page floor, carrying a faint violet cast so
  the atmosphere has something to sit in rather than an absence.
- **Stacked Surfaces** (`surface-1` / `surface-2` / `surface-3`): panels, cards,
  and nested readouts, almost always at partial opacity so the atmosphere reads
  through.
- **Hairlines** (`hairline` / `hairline-strong`): the 1px rules that define
  every container, and the dot-matrix texture.
- **Ink ramp** (`ink` → `ink-muted` → `ink-subtle` → `ink-tertiary`): headings,
  body, labels, and provenance notes respectively.

### Named Rules

**The Two-Pole Rule.** Data classification uses Automation Amber and Organic
Emerald and nothing else. A third data hue means the axis was misunderstood: put
the distinction in the label text, or in shape, not in a new colour.

**The Inert Volume Rule.** The authorization count and its bars are never drawn
in an accent colour. The most attractive colour on a screen must never land on
the figure the project disputes.

**The Earned Red Rule.** Red never marks automation. It marks independently
published evidence, and it appears once. If a second red appears, a verdict was
smuggled in — `src/signals/labels.mjs` refuses to assert intent and
`containsForbiddenField` exists to keep it that way.

## Typography

**Claim Font:** Gloock, self-hosted (fallback `Georgia`,
`Times New Roman`, `serif`)
**Body & Heading Font:** Inter Variable, self-hosted (fallback `system-ui`,
`-apple-system`, `sans-serif`)
**Label/Mono Font:** JetBrains Mono Variable, self-hosted (fallback
`ui-monospace`, `Fira Code`, `monospace`)

**Character:** Three voices, each with one job. A high-contrast editorial
serif makes the claim; a neutral grotesque carries every other word; a
monospace carries every number, address and unit so the data columns behave
like a ledger. The page argues in a publication voice and reports in an
instrument voice, and that split is the whole conceit.

Inter is the right workhorse for dense tabular data — it was designed for it —
but as the *display* face it is also the face every generated dashboard
converges on, so the one sentence the project stands behind read as generic.

Gloock rather than one of the more common editorial serifs: it carries
newspaper masthead weight, which reads as *published claim, on the record*
rather than merely refined, and its numerals are lining, so `7702` keeps the
precision the rest of the page is built on. Set at 400 with `-0.018em`; at 600
with the old `-0.035em` a serif of this contrast collides with itself.

Both are **self-hosted**, bundled by Vite from `@fontsource-variable/*` as two
woff2 files (48 KB and 40 KB for the full 100–900 weight axis, latin subset
only). Nothing is fetched from a font CDN at runtime: this project's claim is
that it needs no third-party service, and a request to `fonts.gstatic.com` to
render its own lettering would undercut that for no benefit. Both faces were
declared in the tokens and never actually loaded until this was fixed, so the
page rendered in whatever sans the operating system supplied.

### Hierarchy

- **Claim** (Gloock 400, `clamp(2.25rem, 6vw, 4.5rem)`, 1.04,
  `-0.018em`): the hero headline and the social card headline. Nowhere else.
- **Headline** (600, 1.875rem, `-0.02em`): section titles.
- **Title** (600, 1.25rem, `-0.02em`): archetype card names.
- **Body** (400, 0.875–1rem, 1.625): explanation and provenance. Measure stays
  inside 65–75ch.
- **Label** (mono, 0.75rem, `0.05em`, uppercase): signal names, column headers,
  zone banners.
- **Readout** (mono 600, 1.875rem, tabular figures): the headline metrics and
  every number in a column.

### Named Rules

**The One Claim Rule.** Gloock sets the hero headline and the social card
headline, and nothing else — not section titles, not card names, not a
pull quote. Its whole value is that the page speaks in that voice exactly once,
where it stakes its claim. A second use spends it.

**The Mono-Is-Measurement Rule.** Monospace marks a number, an address, a unit,
or a command — never a mood. A monospace heading with no data in it is the
costume version of this system.

**The Tabular Figures Rule.** Any number that appears in a column or updates in
place uses tabular figures. A metric that reflows its own width while the live
feed ticks is a defect, not a detail.

**The Latin-Subset Rule.** The bundled subsets carry no `≤`, `≥`, `→` or `↗`
(Google Fonts drops them in subsetting, so widening `unicode-range` does not
help — the glyphs are absent from the file). Write a band as a range with an en
dash or a plus — `1–5 relayers`, `15+ relayers` — which is plainer than a
boundary operator anyway, and draw arrows as icons. Reaching for one of those
four codepoints silently falls back to the platform face mid-line.

## Layout

A single centred column with three widths, chosen by density rather than by
section type: `max-w-5xl` for the hero claim, `max-w-6xl` for data sections, and
`max-w-2xl` for the introductory paragraph under each heading. Horizontal gutter
is a constant 24px.

Vertical rhythm runs on a 96px section spacing token, compressing to 64px for
the full-bleed bars (metrics, live feed) which are separated by hairlines rather
than by space. Within a card the rhythm is 24px between blocks and 12–14px
inside a signal group, with more space above a heading than below it.

Breakpoints are Tailwind's defaults (640 / 768 / 1024). Data tables and the
bimodal chart scroll horizontally inside a fixed minimum width rather than
reflowing, because a relayer distribution that rewraps stops being a
distribution. The archetype grid is one column below 768px and two above it. The
reading rail and the hero prism are desktop-only; a phone gutter has no room
for either.

## Elevation & Depth

Hybrid, and the two halves have different jobs. **Ambient depth comes from
light:** a fixed atmospheric field of large blurred radial gradients sits behind
everything, and surfaces are translucent with a backdrop blur so that field
reads through them. **Structural depth comes from hairlines,** not shadows: a
1px `hairline` rule is what defines a card.

Shadows exist, but only as a response to state. Nothing carries a shadow at
rest.

### Shadow Vocabulary

- **Hover lift** (`box-shadow: 0 20px 50px -24px rgba(0,0,0,0.9)`): archetype
  cards on hover.
- **Action lift** (`box-shadow: 0 10px 28px -10px rgba(130,143,255,0.55)`): the
  primary button on hover.
- **Detection glow** (`box-shadow: 0 6px 24px -4px rgba(52,211,153,0.45)`): the
  prism's orbital ring, only while a live delegation is being recovered.

### Named Rules

**The No-Resting-Shadow Rule.** Surfaces are flat at rest and defined by their
hairline. A shadow appears on hover, focus, or a live detection, and disappears
with it. A shadow in the default state is decoration.

**The Offset-And-Blur Rule.** Every shadow carries a vertical offset and a soft
blur. A zero-offset coloured halo is a glow effect, not depth, and does not
belong in this vocabulary.

**The Atmosphere-Is-Data Rule.** The background field's weighting is bound to
scroll position and its brightness to the live feed. Adding a light that
responds to neither is adding wallpaper.

## Shapes

Corners are consistently soft but never round: 6px on controls and small
readouts, 8px on inputs and tabs, 12px on panels, 16px on cards, and fully round
only on status pills and badges. Nothing in the system is square-cornered and
nothing is a circle except a state dot.

The recurring geometry is the **bar pair**: two 8–10px columns side by side, the
left one volume and the right one money, with the right column's top corner
varying by tier (square for single-operator, pill for mixed, flat for organic)
so the classification survives in grayscale. Beyond that, the only non-rectangular
form is the octahedron wireframe, drawn from straight strokes with dashed vectors
for the recovered authority and the delegation pointer.

## Components

### Buttons

- **Shape:** softly rounded (8px, `rounded.md`).
- **Primary:** Recovery Violet fill, white label, mono uppercase at 12px, 8px
  by 16px padding. One per page.
- **Hover / Focus:** lightens to `primary-hover` and gains the Action lift
  shadow; focus-visible draws a 2px `primary-hover` ring at 2px offset.
- **Ghost:** used for in-card utilities (copy, Etherscan). Hairline border on
  `surface-3`, `ink-muted` label, shifts to `ink` on hover.

### Chips / Badges

- **Style:** fully rounded, 1px border at 25% of the hue, fill at 10%, text at
  the `-text` variant. Three variants only: automation, organic, neutral, plus
  the single evidence badge.
- **State:** a badge states a measured classification and is never interactive.
  Interactive filters are tabs, not badges.

### Cards / Containers

- **Corner Style:** 16px (`rounded.xl`) for content cards, 12px for panels.
- **Background:** `surface-1` at 70–75% opacity with a backdrop blur, so the
  atmosphere reads through.
- **Shadow Strategy:** none at rest; Hover lift on interactive cards only.
- **Border:** 1px `hairline`, moving to `hairline-strong` on hover.
- **Internal Padding:** 24px, rising to 32px above 640px.

### Inputs / Fields

- **Style:** `surface-1` fill, 1px `hairline`, 8px radius, mono 12px text, icon
  inset 36px from the left.
- **Focus:** border shifts to `primary`, no glow; the themed caret is
  `primary-hover`.
- **Placeholder:** `ink-tertiary`.

### Navigation

There is no site navigation. Section movement happens through one hero anchor
and the reading rail. The in-section navigation pattern is a **segmented
control**: a `surface-2` track with a 1px hairline and 4px inset, the active
segment lifted to `surface-3` with `ink` text, idle segments `ink-subtle`. When
a segment names a tier it borrows that tier's hue at 12% fill and 30% border.

### Signature Component: the Atmosphere

A fixed, full-viewport field of four layers: a static top-and-bottom violet
vignette that gives the page a floor; an Automation Amber pole on the left and
an Organic Emerald pole on the right, whose opacities crossfade against
`--doc-progress` so the light travels from the reported volume toward the real
money; a slowly breathing violet core; and a 30px dot matrix masked by a
vertical gradient so it never reads as uniform wallpaper. All drift is transform
only, paused when the tab is hidden, and dropped under reduced motion while the
crossfade and the feed breath — which carry meaning rather than movement — stay.

### Signature Component: the Hero Prism

The octahedron belongs to the hero and leaves with it. Over the first ~270px of
scroll it shrinks slightly, lifts, and fades to nothing, driven entirely by CSS
custom properties so the subtree does not re-render while scrolling. On a fine
pointer it tilts up to 7.5° and drifts up to 10px toward the cursor, eased at
0.08 per frame, with the orbital ring staying put so the parallax reads.

It draws **behind** the content (`z-0`), only from `lg` up, and at 60% presence
(30% when the feed is paused) so it sits clearly below the claim.

**There is no docked state, and adding one back is a mistake already made
twice.** The mark's fixed 320px box always overlaps the centred claim's box on
desktop — 100px of overlap at 1400px wide, 210px at 1180px — so whether glyphs
collide comes down to how the sentence happens to wrap, which is chance rather
than design. At `z-20` the octahedron sat on top of the one sentence the page
exists to make; moved to `z-0` it stopped occluding anything but the translucent
section bands then blurred it on the way down, trading obstruction for
obscurity. It carries no information either: its status pill was removed for
duplicating LiveFeed, the page's one authoritative live readout. A decorative
mark that carries nothing has not earned a permanent corner.

What it does carry is live state, through its own appearance: ring colour by
polling state, reduced presence when the feed is paused, and a 450ms pulse on
the recovered-authority node per detection.

### Named Rules

**The Nothing-Persists-In-The-Corner Rule.** No decorative mark is pinned over
content for the length of the page. Ambient elements either span the whole
scroll as atmosphere, or belong to one section and leave with it. Persistent
*state* belongs in a section that scrolls with the page, never in an element
floating over content it cannot see.

**The Decoration-Goes-Behind Rule.** Every ambient layer — atmosphere, dot
matrix, prism — draws below the content. A decorative element that can overlap
text must lose to the text, and the way to guarantee that at every viewport is
z-order, not a media query.

## Do's and Don'ts

### Do:

- **Do** put the four behavioural signals under every classification, visible
  without interaction.
- **Do** draw volume in Reported Grey (`#6b7280`) and money in the tier's own
  hue, so the asymmetry reads as two masses of colour.
- **Do** keep the inflated figure on the page next to the corrected one.
- **Do** carry classification in shape as well as hue (the bar pair's top
  corner), so it survives in grayscale.
- **Do** bind any new ambient motion to real state — scroll position or the live
  feed — or leave it out.
- **Do** use tabular figures for every number in a column or a live readout.
- **Do** state unmeasured as unmeasured. `funded: null` renders as an em dash or
  "Unsampled", never as `0`.

### Don't:

- **Don't** apply red, rose, or purple to automation. Amber is the automation
  hue; red is reserved for published evidence and appears once.
- **Don't** introduce a third data hue. Put the subtype in the label text.
- **Don't** give any surface a shadow at rest.
- **Don't** put the atmosphere's continuous values into React state. They are
  written to CSS custom properties from one rAF-throttled handler; a per-frame
  `setState` re-renders a 600-line component for the length of every scroll.
- **Don't** pin a floating label beside the corner mark. One existed, duplicated
  LiveFeed, and overlapped section content; the mark carries its own state.
- **Don't** place an element that must stay legible inside a transform-scaled
  subtree — it inherits the scale and renders at a fraction of its type size.
- **Don't** use monospace for prose, or for a heading with no data in it.
- **Don't** add a 0–100 score, a gauge, or any field named `risk*`, `score*` or
  `threat*`. The pipeline structurally rejects them and the interface must not
  reintroduce them by other means.
