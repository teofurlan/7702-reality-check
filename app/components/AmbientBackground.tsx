import { useEffect, useRef, useState } from 'react';
import type { LiveFeedState } from '../hooks/useLiveFeed';

interface AmbientBackgroundProps {
  feed: LiveFeedState;
}

export function AmbientBackground({ feed }: AmbientBackgroundProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [isHeroInView, setIsHeroInView] = useState(true);
  const [isFinePointer, setIsFinePointer] = useState(true);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // DOM and Animation Refs
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const prismTiltRef = useRef<HTMLDivElement>(null);
  const tiltRafRef = useRef<number | null>(null);
  const currentTilt = useRef({ x: 0, y: 0 });
  const targetTilt = useRef({ x: 0, y: 0 });

  // 1. Detect media capabilities (prefers-reduced-motion & pointer: fine)
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

  // 2. Tab Visibility Discipline (pause all continuous motion when tab is hidden)
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
      if (document.hidden) {
        targetTilt.current = { x: 0, y: 0 };
        currentTilt.current = { x: 0, y: 0 };
        if (prismTiltRef.current) {
          prismTiltRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // 3. Hero Section Intersection Observer (pause aurora drift when hero is off-screen)
  useEffect(() => {
    const sentinel = heroSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // 4. Scroll-Tied Progress Tracker (Hero to LiveFeed transition)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Transition completes around 420px (when hero ends and metrics/feed engage)
          const maxScroll = 420;
          const current = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
          setScrollProgress(current);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initialize

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 5. Mouse-Driven Presence (Desktop, pointer:fine, non-reduced-motion only)
  useEffect(() => {
    if (!isFinePointer || isReducedMotion) return;

    const startTiltLoop = () => {
      if (tiltRafRef.current != null) return;

      const step = () => {
        const ease = 0.08;
        currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * ease;
        currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * ease;

        if (prismTiltRef.current) {
          prismTiltRef.current.style.transform = `perspective(800px) rotateX(${currentTilt.current.x.toFixed(
            2
          )}deg) rotateY(${currentTilt.current.y.toFixed(2)}deg)`;
        }

        const deltaX = Math.abs(currentTilt.current.x - targetTilt.current.x);
        const deltaY = Math.abs(currentTilt.current.y - targetTilt.current.y);

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

      // Bounded interaction: Measure proximity to top-right graphic region
      const graphicCenterX = window.innerWidth - (scrollProgress > 0.7 ? 80 : 200);
      const graphicCenterY = scrollProgress > 0.7 ? 50 : 180;
      const dx = e.clientX - graphicCenterX;
      const dy = e.clientY - graphicCenterY;
      const dist = Math.hypot(dx, dy);

      // 650px bounded interaction radius with natural quadratic falloff
      const maxRadius = 650;
      if (dist < maxRadius) {
        const factor = Math.max(0, 1 - dist / maxRadius);
        // Max ~7 deg rotation on each axis, pointing towards cursor
        targetTilt.current.x = -(dy / maxRadius) * 7.5 * factor;
        targetTilt.current.y = (dx / maxRadius) * 7.5 * factor;
      } else {
        targetTilt.current.x = 0;
        targetTilt.current.y = 0;
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
  }, [isFinePointer, isReducedMotion, scrollProgress]);

  // 6. Data-Driven Signal: Deliberate 450ms pulse when live NEW_DELEGATIONS arrive
  useEffect(() => {
    if (feed.pulseTrigger > 0) {
      setPulseActive(true);
      const timer = setTimeout(() => {
        setPulseActive(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [feed.pulseTrigger]);

  // Compute smooth eased values for scroll migration
  // Ease-out curve: t * (2 - t)
  const easedScroll = scrollProgress * (2 - scrollProgress);
  const scale = 1 - easedScroll * 0.62; // 1.0 down to ~0.38
  const translateX = easedScroll * 32; // Slight tuck toward viewport edge
  const translateY = -easedScroll * 36; // Migrate to top edge

  // Determine pausing states
  const shouldPauseAuroras = isTabHidden || !isHeroInView;
  const shouldPausePrism = isTabHidden || !feed.isPolling;

  return (
    <>
      {/* Sentinel for IntersectionObserver to track when Hero leaves viewport */}
      <div
        ref={heroSentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-[600px] w-full"
      />

      {/* 1. Engineering dot-matrix grid with radial falloff */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden z-0 select-none min-h-screen"
      >
        <div
          className="absolute inset-0 opacity-[0.2]"
          style={{
            backgroundImage: `radial-gradient(var(--color-hairline-strong) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(circle 800px at 90% 10%, black 10%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle 800px at 90% 10%, black 10%, transparent 70%)',
          }}
        />

        {/* 2. Primary Vibrant Lavender Aurora Glow (pulsing & drifting, paused off-screen/tab-hidden) */}
        <div
          className={`absolute -top-[120px] -right-[100px] w-[650px] h-[650px] rounded-full blur-[100px] animate-aurora-1 transition-opacity duration-700 ${
            shouldPauseAuroras ? 'animation-paused' : ''
          } ${feed.isPolling ? 'opacity-100' : 'opacity-35'}`}
          style={{
            background:
              'radial-gradient(circle, rgba(94, 106, 210, 0.55) 0%, rgba(130, 143, 255, 0.35) 45%, rgba(94, 106, 210, 0.05) 75%, transparent 100%)',
          }}
        />

        {/* 3. Secondary Deep Indigo / Cyan counter-balancing glow */}
        <div
          className={`absolute top-[40px] right-[160px] w-[500px] h-[500px] rounded-full blur-[110px] animate-aurora-2 transition-opacity duration-700 ${
            shouldPauseAuroras ? 'animation-paused' : ''
          } ${feed.isPolling ? 'opacity-100' : 'opacity-25'}`}
          style={{
            background:
              'radial-gradient(circle, rgba(94, 106, 210, 0.4) 0%, rgba(39, 166, 68, 0.15) 55%, transparent 75%)',
          }}
        />
      </div>

      {/* 4. Interactive, Data-Driven EIP-7702 Octahedron Cryptographic Visualization */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-6 right-4 sm:top-8 sm:right-8 md:top-12 md:right-16 lg:right-24 z-20 select-none"
        style={{
          transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          transformOrigin: 'top right',
          willChange: scrollProgress > 0 && scrollProgress < 1 ? 'transform' : 'auto',
        }}
      >
        <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
          {/* Mouse-Driven Tilt Container */}
          <div
            ref={prismTiltRef}
            className="w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
              transition: isFinePointer && !isReducedMotion ? 'none' : 'transform 0.4s ease-out',
            }}
          >
            {/* Float prism keyframe layer */}
            <div
              className={`relative w-full h-full animate-float-prism transition-opacity duration-500 ${
                shouldPausePrism ? 'animation-paused' : ''
              } ${feed.isPolling ? 'opacity-100' : 'opacity-45'}`}
            >
              {/* Orbital Ring (brightens on detection pulse, pauses when feed is idle/paused) */}
              <div
                className={`absolute inset-2 rounded-full border border-dashed transition-colors duration-300 animate-spin-slow ${
                  shouldPausePrism ? 'animation-paused' : ''
                } ${
                  pulseActive
                    ? 'border-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                    : feed.isPolling
                    ? 'border-primary/30'
                    : 'border-hairline-strong/40'
                }`}
              />

              {/* SVG Ethereum Prism & Real Cryptographic Authority Lineage */}
              <svg
                viewBox="0 0 320 320"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`w-full h-full transition-all duration-300 ${
                  pulseActive
                    ? 'drop-shadow-[0_0_35px_rgba(52,211,153,0.5)]'
                    : 'drop-shadow-[0_0_25px_rgba(94,106,210,0.3)]'
                }`}
              >
                {/* Technical coordinate ring */}
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

                {/* Stylized Faceted Ethereum Octahedron Wireframe */}
                {/* Top Pyramid */}
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

                {/* Bottom Inverted Pyramid */}
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

                {/* Delegation pointer vector: 0xef0100 designation line */}
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

                {/* Target delegate node: single deliberate pulse on detection */}
                <g transform="translate(240, 245)">
                  <circle
                    cx="0"
                    cy="0"
                    r="4"
                    fill={feed.isPolling ? '#a5b4fc' : '#62666d'}
                  />
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

                {/* Authority Signer Origin Vector: Thesis of the App */}
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

                {/* Authority Signer Origin Node: Focal pulse on live recovered delegation */}
                <g transform="translate(75, 115)">
                  <circle
                    cx="0"
                    cy="0"
                    r="4.5"
                    fill={feed.isPolling ? '#10b981' : '#62666d'}
                  />
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

          {/* Persistent Docked Live Status Indicator (Fades in when scrolled to
              LiveFeed and beyond). Purely a connection-state dot — no block
              number or detection count here, since LiveFeed is the single
              authoritative live readout on the page. */}
          <div
            className="absolute top-1/2 -left-64 -translate-y-1/2 transition-opacity duration-300"
            style={{
              opacity: Math.min(Math.max((scrollProgress - 0.45) * 2.2, 0), 1),
              pointerEvents: scrollProgress > 0.7 ? 'auto' : 'none',
            }}
          >
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border bg-surface-2/95 backdrop-blur-md shadow-2xl text-xs font-mono transition-colors duration-300 ${
                pulseActive
                  ? 'border-emerald-400/70 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                  : 'border-hairline'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {feed.isPolling && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    feed.isPolling ? 'bg-emerald-500' : 'bg-ink-tertiary'
                  }`}
                />
              </span>

              <span className="text-ink font-medium">
                {feed.isPolling ? 'Live' : 'Paused'}
              </span>

              {pulseActive && (
                <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[10px] uppercase font-bold text-emerald-300 animate-pulse">
                  NEW
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
