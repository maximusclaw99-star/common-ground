"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/**
 * The three background layers, together.
 *
 * The system is explicit that they are used as a set or not at all: any one
 * alone reads as an unfinished version of the other two, and nothing else is
 * allowed to add a fourth texture. One per page.
 *
 * `bundle.js` is a classic script defining the global TB, synced into public/
 * by scripts/sync-design.mjs. Both entry points hand back a handle with
 * destroy(), which is what React needs on unmount.
 */
declare global {
  interface Window {
    TB?: {
      asciiRelief: (el: Element, opts?: Record<string, unknown>) => { destroy(): void } | null;
      reliefSource: (opts?: Record<string, unknown>) => unknown;
      crosshair: (el: Element) => { destroy(): void } | null;
    };
  }
}

export function HeroLayers({ pageRef }: { pageRef: React.RefObject<HTMLElement | null> }) {
  const reliefRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !window.TB) return;
    const relief = reliefRef.current
      ? window.TB.asciiRelief(reliefRef.current, {
          source: window.TB.reliefSource({ seed: 0.6 }), cell: 7, ratio: 1.6, alpha: 0.24,
        })
      : null;
    const cross = pageRef.current ? window.TB.crosshair(pageRef.current) : null;
    return () => { relief?.destroy(); cross?.destroy(); };
  }, [ready, pageRef]);

  return (
    <>
      <div className="tb-grid" />
      <div className="tb-ascii" ref={reliefRef} />
      <Script src="/tb/bundle.js" strategy="afterInteractive" onReady={() => setReady(true)} />
    </>
  );
}
