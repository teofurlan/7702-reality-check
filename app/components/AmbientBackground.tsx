import { useEffect, useRef, useState } from 'react';
import type { LiveFeedState } from '../hooks/useLiveFeed';

interface AmbientBackgroundProps {
  feed: LiveFeedState;
}

/** Scroll distance over which the hero prism completes its exit. */
const HERO_MIGRATION_PX = 420;

/**
 * Scale the mark reaches as it leaves, and the opacity it is drawn at while
 * present.
 *
 * There is deliberately no docked state and no status pill. The pill was
 * removed first, for duplicating LiveFeed, which is the page's one
 * authoritative live readout. The dock went next: the mark's fixed box always
 * overlapped the centred claim's box on desktop (100px of overlap at 1400,
 * 210px at 1180), so whether glyphs collided came down to how the sentence
 * happened to wrap. Drawing it behind the text stopped the occlusion, but the
 * translucent section bands then blurred it on the way down — obstructing
 * traded for obscured. Carrying no information, it did not earn a permanent
 * corner, so it belongs to the hero and leaves with it.
 *
 * PRESENCE keeps it clearly below the claim in the visual hierarchy, so a line
 * that does cross it reads as depth rather than as a collision.
 */
const EXIT_SCALE = 0.82;
const PRESENCE = 0.6;
const PRESENCE_IDLE = 0.3;

/** Peak pointer-driven displacement, in px, at the centre of the hover field. */
const PRISM_DRIFT_PX = 10;

/**
 * Page atmosphere and the interactive EIP-7702 prism.
 *
 * Two things live here, and they are deliberately not the same layer:
 *
 * 1. A **fixed** atmosphere spanning the entire scroll. The earlier version
 *    anchored its light to `absolute inset-0 min-h-screen`, so every section
 *    after the hero sat on flat canvas. The atmosphere now travels the page's
 *    own argument: the automation pole carries the early scroll (volume, the
 *    reported figure) and hands off to the organic pole by the end (the ETH
 *    that actually exists). The crossfade is the thesis rendered as light, not
 *    a parallax layer.
 *
 * 2. The hero prism, which belongs to the hero and fades out with it.
 *
 * **Continuous values never touch React state.** `--doc-progress` and
 * `--hero-eased` are written straight onto the document element from one
 * rAF-throttled scroll handler. The previous implementation called
 * `setScrollProgress` on every animation frame, re-rendering this whole
 * component — including the 320x320 SVG below — for the full duration of every
 * scroll. State here is reserved for coarse, rare transitions (tab hidden,
 * hero visibility, pointer class, reduced motion, feed pulse).
 */
export function AmbientBackground({ feed }: AmbientBackgroundProps) {
  const [pulseActive, setPulseActive] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [isHeroInView, setIsHeroInView] = useState(true);
  const [isFinePointer, setIsFinePointer] = useState(true);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const prismTiltRef = useRef<HTMLDivElement>(null);
  const prismAnchorRef = useRef<HTMLDivElement>(null);
  const tiltRafRef = useRef<number | null>(null);
  // x/y are degrees of tilt; dx/dy are px of positional drift.
  const currentTilt = useRef({ x: 0, y: 0, dx: 0, dy: 0 });
  const targetTilt = useRef({ x: 0, y: 0, dx: 0, dy: 0 });

  // Read by the pointer handler so it can position the interaction target
  // against how far the prism has travelled through its exit, without
  // re-subscribing the listener on every scroll frame.
  const heroProgressRef = useRef(0);

  // 1. Media capabilities
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: fine)');

    setIsReducedMotion(motionQuery.matches);
    setIsFinePointer(pointerQuery.matches);

    const onMotionChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    const onPointerChange = (e: MediaQueryListEvent) => setIsFinePointer(e.matches);

    motionQuery.addEventListener('change', onMotionChange);
    pointerQuery.addEventListener('change', onPointerChange);

    return () => {
      motionQuery.removeEventListener('change', onMotionChange);
      pointerQuery.removeEventListener('change', onPointerChange);
    };
  }, []);

  // 2. Tab visibility discipline — pause all continuous motion when hidden.
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
      if (document.hidden) {
        targetTilt.current = { x: 0, y: 0, dx: 0, dy: 0 };
        currentTilt.current = { x: 0, y: 0, dx: 0, dy: 0 };
        if (prismTiltRef.current) {
          prismTiltRef.current.style.transform =
            'perspective(800px) translate3d(0px, 0px, 0) rotateX(0deg) rotateY(0deg)';
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // 3. Hero visibility — pauses the hero's own auroras once they are off-screen.
  useEffect(() => {
    const sentinel = heroSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => setIsHeroInView(entry.isIntersecting), {
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // 4. Scroll writer: one rAF-throttled handler, zero renders.
  //
  // `--doc-progress` spans the whole document and drives the atmosphere
  // crossfade plus the reading rail. `--hero-eased` is the prism's short exit,
  // pre-eased here (t * (2 - t)) so the CSS stays declarative.
  useEffect(() => {
    const root = document.documentElement;
    let ticking = false;

    const write = () => {
      const scrollable = root.scrollHeight - window.innerHeight;
      const docProgress = scrollable > 0 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 0;

      const heroRaw = Math.min(Math.max(window.scrollY / HERO_MIGRATION_PX, 0), 1);
      const heroEased = heroRaw * (2 - heroRaw);

      const scale = 1 - heroEased * (1 - EXIT_SCALE);

      heroProgressRef.current = heroRaw;
      root.style.setProperty('--doc-progress', docProgress.toFixed(4));
      root.style.setProperty('--hero-eased', heroEased.toFixed(4));
      root.style.setProperty('--prism-scale', scale.toFixed(4));
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(write);
    };

    write();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // 5. Mouse-driven presence (desktop, fine pointer, motion allowed).
  useEffect(() => {
    if (!isFinePointer || isReducedMotion) return;

    const startTiltLoop = () => {
      if (tiltRafRef.current != null) return;

      const step = () => {
        const ease = 0.08;
        const t = targetTilt.current;
        const c = currentTilt.current;
        c.x += (t.x - c.x) * ease;
        c.y += (t.y - c.y) * ease;
        c.dx += (t.dx - c.dx) * ease;
        c.dy += (t.dy - c.dy) * ease;

        if (prismTiltRef.current) {
          prismTiltRef.current.style.transform =
            'perspective(800px) translate3d(' +
            c.dx.toFixed(2) +
            'px, ' +
            c.dy.toFixed(2) +
            'px, 0) rotateX(' +
            c.x.toFixed(2) +
            'deg) rotateY(' +
            c.y.toFixed(2) +
            'deg)';
        }

        const deltaX = Math.abs(c.x - t.x) + Math.abs(c.dx - t.dx);
        const deltaY = Math.abs(c.y - t.y) + Math.abs(c.dy - t.dy);

        if (deltaX > 0.01 || deltaY > 0.01) {
          tiltRafRef.current = requestAnimationFrame(step);
        } else {
          tiltRafRef.current = null;
        }
      };

      tiltRafRef.current = requestAnimationFrame(step);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (document.hidden) return;

      // Measured from the prism's actual box rather than from two hand-tuned
      // screen constants, so the hover field keeps following the mark through
      // the whole migration instead of jumping at a 0.7 threshold.
      const anchor = prismAnchorRef.current;
      if (!anchor) return;
      const box = anchor.getBoundingClientRect();
      const heroRaw = heroProgressRef.current;
      const scale = 1 - heroRaw * (2 - heroRaw) * (1 - EXIT_SCALE);
      const renderedW = box.width * scale;
      const graphicCenterX = box.right - renderedW / 2;
      const graphicCenterY = box.top + renderedW / 2;

      const dx = e.clientX - graphicCenterX;
      const dy = e.clientY - graphicCenterY;
      const dist = Math.hypot(dx, dy);

      const maxRadius = 650;
      if (dist < maxRadius) {
        const factor = Math.max(0, 1 - dist / maxRadius);
        targetTilt.current.x = -(dy / maxRadius) * 7.5 * factor;
        targetTilt.current.y = (dx / maxRadius) * 7.5 * factor;
        // Small positional drift toward the cursor, on top of the tilt. The
        // parallax between the drifting body and the fixed orbital ring is what
        // makes the mark feel handled rather than pinned to the corner.
        targetTilt.current.dx = (dx / maxRadius) * PRISM_DRIFT_PX * factor;
        targetTilt.current.dy = (dy / maxRadius) * PRISM_DRIFT_PX * factor;
      } else {
        targetTilt.current.x = 0;
        targetTilt.current.y = 0;
        targetTilt.current.dx = 0;
        targetTilt.current.dy = 0;
      }

      startTiltLoop();
    };

    const handlePointerLeave = () => {
      targetTilt.current.x = 0;
      targetTilt.current.y = 0;
      startTiltLoop();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      if (tiltRafRef.current != null) {
        cancelAnimationFrame(tiltRafRef.current);
        tiltRafRef.current = null;
      }
    };
  }, [isFinePointer, isReducedMotion]);

  // 6. Data-driven signal: one deliberate 450ms beat when a delegation is
  // recovered live. It drives the prism pulse AND lifts `--feed-breath`, so
  // the page's ambient light answers to recovered chain data rather than to a
  // timer. This is the authored moment; everything else here is quiet.
  useEffect(() => {
    if (feed.pulseTrigger <= 0) return;

    const root = document.documentElement;
    setPulseActive(true);
    root.style.setProperty('--feed-breath', '1');

    const timer = setTimeout(() => {
      setPulseActive(false);
      root.style.setProperty('--feed-breath', '0');
    }, 450);

    return () => clearTimeout(timer);
  }, [feed.pulseTrigger]);

  const shouldPauseAuroras = isTabHidden || !isHeroInView;
  const shouldPausePrism = isTabHidden || !feed.isPolling;
  const shouldPauseAtmosphere = isTabHidden;

  return (
    <>
      {/* Sentinel tracking when the hero leaves the viewport. */}
      <div
        ref={heroSentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-[600px] w-full"
      />

      {/* ============================================================
          Fixed atmosphere — spans the whole scroll.
          ============================================================ */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 select-none overflow-hidden ${
          shouldPauseAtmosphere ? 'animation-paused' : ''
        }`}
      >
        {/* Floor. Static, no motion: it exists so the page never bottoms out
            into flat black between sections. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 70% at 50% -10%, rgba(94, 106, 210, 0.16) 0%, transparent 60%), radial-gradient(100% 60% at 50% 108%, rgba(94, 106, 210, 0.10) 0%, transparent 62%)',
          }}
        />

        {/* Automation pole — left, matching the chart's own axis, where the
            single-operator zone sits. Strongest through the volume sections
            and fading as the argument moves to the money. */}
        <div
          className="atmos-automation animate-atmos-slow absolute top-[8%] -left-[22%] h-[820px] w-[820px] rounded-full blur-[120px] transition-opacity duration-700"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 166, 35, 0.30) 0%, rgba(214, 138, 26, 0.16) 42%, transparent 72%)',
          }}
        />

        {/* Organic pole — right, where the organic tier sits in the chart.
            Near-dark at the top of the page, carrying the close. */}
        <div
          className="atmos-organic animate-atmos-counter absolute bottom-[4%] -right-[20%] h-[880px] w-[880px] rounded-full blur-[130px] transition-opacity duration-700"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.32) 0%, rgba(13, 148, 136, 0.15) 45%, transparent 74%)',
          }}
        />

        {/* Recovery core — the violet that belongs to the signature machinery
            itself, present the whole way down and breathing with the feed. */}
        <div
          className="atmos-core animate-atmos-breathe absolute top-1/2 left-1/2 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px] transition-opacity duration-700"
          style={{
            background:
              'radial-gradient(circle, rgba(94, 106, 210, 0.20) 0%, rgba(94, 106, 210, 0.08) 48%, transparent 76%)',
          }}
        />

        {/* Engineering dot matrix, now spanning the full viewport instead of
            being masked into the hero's top-right corner. The vertical mask
            keeps it from reading as uniform wallpaper. */}
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: 'radial-gradient(var(--color-hairline-strong) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            maskImage:
              'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.35) 42%, rgba(0,0,0,0.55) 68%, black 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.35) 42%, rgba(0,0,0,0.55) 68%, black 100%)',
          }}
        />
      </div>

      {/* ============================================================
          Reading rail — position in the argument, coloured by the same
          axis the atmosphere carries. Desktop only; it would crowd a
          phone gutter for no gain.
          ============================================================ */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-20 hidden h-full w-px bg-hairline/40 lg:block"
      >
        <div
          className="axis-rail-lit h-full w-px"
          style={{
            background:
              'linear-gradient(to bottom, rgba(245, 166, 35, 0.75) 0%, rgba(94, 106, 210, 0.7) 50%, rgba(16, 185, 129, 0.8) 100%)',
          }}
        />
      </div>

      {/* Hero-local auroras. These stay anchored to the hero and scroll away
          with it — the fixed atmosphere above is what carries the rest. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 min-h-screen select-none overflow-hidden"
      >
        <div
          className={`animate-aurora-1 absolute -top-[120px] -right-[100px] h-[650px] w-[650px] rounded-full blur-[100px] transition-opacity duration-700 ${
            shouldPauseAuroras ? 'animation-paused' : ''
          } ${feed.isPolling ? 'opacity-100' : 'opacity-35'}`}
          style={{
            background:
              'radial-gradient(circle, rgba(94, 106, 210, 0.55) 0%, rgba(130, 143, 255, 0.35) 45%, rgba(94, 106, 210, 0.05) 75%, transparent 100%)',
          }}
        />

        <div
          className={`animate-aurora-2 absolute top-[40px] right-[160px] h-[500px] w-[500px] rounded-full blur-[110px] transition-opacity duration-700 ${
            shouldPauseAuroras ? 'animation-paused' : ''
          } ${feed.isPolling ? 'opacity-100' : 'opacity-25'}`}
          style={{
            background:
              'radial-gradient(circle, rgba(94, 106, 210, 0.4) 0%, rgba(16, 185, 129, 0.15) 55%, transparent 75%)',
          }}
        />
      </div>

      {/* ============================================================
          Interactive, data-driven EIP-7702 octahedron.

          Hero only: behind the content (z-0, under main's z-10), desktop
          only, and faded out by the time the hero has scrolled away.

          See EXIT_SCALE for why there is no docked state. Desktop only because
          a phone gutter has no room for it at all, which is what DESIGN.md
          already committed to and the markup had not done.
          Migration is driven entirely by --hero-eased, so this subtree
          does not re-render while the page scrolls.
          ============================================================ */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-6 right-4 z-0 hidden select-none sm:top-8 sm:right-8 md:top-12 md:right-16 lg:right-24 lg:block"
        style={{
          // Gone by the time the hero has left. `clamp` keeps it at exactly 0
          // past the end of the migration rather than going negative.
          opacity: 'clamp(0, calc(1 - var(--hero-eased, 0) * 1.15), 1)',
        }}
      >
        {/* Unscaled anchor box. The migration scale sits on the wrapper
            inside it, never on this box, so the pointer handler can measure the
            mark's true rendered geometry off a stable rect. */}
        <div
          ref={prismAnchorRef}
          className="relative h-[280px] w-[280px] sm:h-[320px] sm:w-[320px]"
        >
          {/* Scaled migration wrapper */}
          <div
            className="absolute inset-0"
            style={{
              transform:
                'translate3d(calc(var(--hero-eased, 0) * 32px), calc(var(--hero-eased, 0) * -36px), 0) scale(var(--prism-scale, 1))',
              transformOrigin: 'top right',
            }}
          >
          <div
            ref={prismTiltRef}
            className="h-full w-full"
            style={{
              transformStyle: 'preserve-3d',
              transition: isFinePointer && !isReducedMotion ? 'none' : 'transform 0.4s ease-out',
            }}
          >
            <div
              className={`animate-float-prism relative h-full w-full transition-opacity duration-500 ${
                shouldPausePrism ? 'animation-paused' : ''
              }`}
              style={{ opacity: feed.isPolling ? PRESENCE : PRESENCE_IDLE }}
            >
              {/* Orbital ring */}
              <div
                className={`animate-spin-slow absolute inset-2 rounded-full border border-dashed transition-colors duration-300 ${
                  shouldPausePrism ? 'animation-paused' : ''
                } ${
                  pulseActive
                    ? 'border-organic-text/80 shadow-[0_6px_24px_-4px_rgba(52,211,153,0.45)]'
                    : feed.isPolling
                      ? 'border-primary/30'
                      : 'border-hairline-strong/40'
                }`}
              />

              <svg
                viewBox="0 0 320 320"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`h-full w-full transition-all duration-300 ${
                  pulseActive
                    ? 'drop-shadow-[0_8px_30px_rgba(52,211,153,0.45)]'
                    : 'drop-shadow-[0_6px_22px_rgba(94,106,210,0.3)]'
                }`}
              >
                <circle
                  cx="160"
                  cy="160"
                  r="130"
                  stroke={feed.isPolling ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
                  strokeWidth="1"
                />
                <circle
                  cx="160"
                  cy="160"
                  r="90"
                  stroke={feed.isPolling ? 'rgba(94, 106, 210, 0.25)' : 'rgba(94, 106, 210, 0.1)'}
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />

                {/* Top pyramid */}
                <polygon
                  points="160,50 208,145 160,172 112,145"
                  stroke={
                    pulseActive
                      ? 'rgba(165, 180, 252, 1)'
                      : feed.isPolling
                        ? 'rgba(165, 180, 252, 0.7)'
                        : 'rgba(165, 180, 252, 0.3)'
                  }
                  strokeWidth={pulseActive ? '2' : '1.5'}
                  fill={
                    pulseActive
                      ? 'rgba(94, 106, 210, 0.25)'
                      : feed.isPolling
                        ? 'rgba(94, 106, 210, 0.1)'
                        : 'rgba(94, 106, 210, 0.03)'
                  }
                />
                <line
                  x1="160"
                  y1="50"
                  x2="160"
                  y2="172"
                  stroke={pulseActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.8)'}
                  strokeWidth="1.5"
                />

                {/* Side facet folds */}
                <polygon
                  points="160,50 208,145 160,128"
                  fill={
                    pulseActive
                      ? 'rgba(130, 143, 255, 0.3)'
                      : feed.isPolling
                        ? 'rgba(130, 143, 255, 0.15)'
                        : 'rgba(130, 143, 255, 0.05)'
                  }
                />
                <polygon
                  points="160,50 112,145 160,128"
                  fill={
                    pulseActive
                      ? 'rgba(94, 106, 210, 0.38)'
                      : feed.isPolling
                        ? 'rgba(94, 106, 210, 0.22)'
                        : 'rgba(94, 106, 210, 0.07)'
                  }
                />

                {/* Bottom inverted pyramid */}
                <polygon
                  points="160,188 208,155 160,250 112,155"
                  stroke={
                    pulseActive
                      ? 'rgba(165, 180, 252, 0.9)'
                      : feed.isPolling
                        ? 'rgba(165, 180, 252, 0.6)'
                        : 'rgba(165, 180, 252, 0.25)'
                  }
                  strokeWidth={pulseActive ? '2' : '1.5'}
                  fill={feed.isPolling ? 'rgba(94, 106, 210, 0.08)' : 'rgba(94, 106, 210, 0.02)'}
                />
                <line
                  x1="160"
                  y1="188"
                  x2="160"
                  y2="250"
                  stroke={feed.isPolling ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'}
                  strokeWidth="1.5"
                />

                {/* Delegation pointer vector: the 0xef0100 designation */}
                <path
                  d="M 160,172 C 160,215 240,205 240,245"
                  stroke={
                    pulseActive
                      ? 'rgba(130, 143, 255, 1)'
                      : feed.isPolling
                        ? 'rgba(130, 143, 255, 0.75)'
                        : 'rgba(130, 143, 255, 0.3)'
                  }
                  strokeWidth={pulseActive ? '2.4' : '1.8'}
                  strokeDasharray="4 4"
                />

                <g transform="translate(240, 245)">
                  <circle cx="0" cy="0" r="4" fill={feed.isPolling ? '#a5b4fc' : '#62666d'} />
                  {pulseActive && (
                    <circle
                      cx="0"
                      cy="0"
                      r="10"
                      fill="none"
                      stroke="#828fff"
                      strokeWidth="2"
                      className={
                        isReducedMotion ? 'animate-detection-reduced' : 'animate-detection-pulse'
                      }
                    />
                  )}
                </g>

                {/* Authority signer origin vector: the thesis of the app */}
                <path
                  d="M 160,50 C 120,40 75,70 75,115"
                  stroke={
                    pulseActive
                      ? 'rgba(52, 211, 153, 1)'
                      : feed.isPolling
                        ? 'rgba(52, 211, 153, 0.7)'
                        : 'rgba(52, 211, 153, 0.25)'
                  }
                  strokeWidth={pulseActive ? '2.4' : '1.8'}
                  strokeDasharray="4 4"
                />

                <g transform="translate(75, 115)">
                  <circle cx="0" cy="0" r="4.5" fill={feed.isPolling ? '#10b981' : '#62666d'} />
                  {pulseActive && (
                    <circle
                      cx="0"
                      cy="0"
                      r="10"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      className={
                        isReducedMotion ? 'animate-detection-reduced' : 'animate-detection-pulse'
                      }
                    />
                  )}
                </g>
              </svg>
            </div>
          </div>
          </div>

        </div>
      </div>
    </>
  );
}
