"use client";

import Script from "next/script";
import { RELIEF_RATIO, handsReliefSource } from "./hands-relief";
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
          source: handsReliefSource(), cell: 5, ratio: RELIEF_RATIO, alpha: 0.32,
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
