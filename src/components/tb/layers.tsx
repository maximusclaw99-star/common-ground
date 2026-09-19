"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { RELIEF_RATIO, handsReliefSource } from "./hands-relief";
import { CONNECT_AT, REACH, fit, measure, pictureSource, type Geometry } from "./picture-relief";

/**
 * The three background layers, together — the system is explicit that they
 * are used as a set or not at all. One per page.
 *
 * With `picture`, the relief's subject is that picture, split at the gap
 * between its two hands, and the halves close as the cursor nears the contact
 * point. With `marble`, a faint paper-marbling sits under the grid, which is
 * the one texture the reference page carries beyond the three the pack ships.
 *
 * `bundle.js` is a classic script defining the global TB, synced into public/
 * by scripts/sync-design.mjs. Its handles expose redraw() and destroy().
 */
declare global {
  interface Window {
    TB?: {
      asciiRelief: (el: Element, opts?: Record<string, unknown>) => { redraw(): void; destroy(): void } | null;
      reliefSource: (opts?: Record<string, unknown>) => unknown;
      crosshair: (el: Element) => { destroy(): void } | null;
    };
  }
}

export function HeroLayers({ pageRef, picture, marble }: {
  pageRef: React.RefObject<HTMLElement | null>;
  picture?: string;
  marble?: string;
}) {
  const reliefRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<{ img: HTMLImageElement; geo: Geometry } | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!picture) return;
    const img = new Image();
    img.src = picture;
    img.decode().then(() => {
      const geo = measure(img);
      if (geo) setLoaded({ img, geo });
    }).catch(() => setLoaded(null));
  }, [picture]);

  useEffect(() => {
    if (!ready || !window.TB || !reliefRef.current) return;
    if (picture && !loaded) return;
    const host = reliefRef.current;
    const page = pageRef.current;

    const state = { p: 0 };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (reduced) state.p = 1;

    const relief = window.TB.asciiRelief(host, loaded
      ? { source: pictureSource(loaded.img, loaded.geo, state), cell: 5, ratio: RELIEF_RATIO, alpha: 0.55 }
      : { source: handsReliefSource(), cell: 5, ratio: RELIEF_RATIO, alpha: 0.32 });
    const cross = page ? window.TB.crosshair(page) : null;

    let target = state.p, raf = 0, pinned = false;
    const cell = 5;

    /** The contact point in host pixels: buffer units are cell pixels. */
    const contact = () => {
      if (!loaded) return null;
      const cols = Math.max(1, Math.floor(host.clientWidth / cell));
      const rows = Math.max(1, Math.floor(host.clientHeight / Math.round(cell * RELIEF_RATIO)));
      const f = fit(loaded.geo, cols, rows);
      return { x: (f.ox + loaded.geo.split * f.dw) * cell, y: (f.oy + loaded.geo.contactY * f.dh) * cell };
    };
    const placeMark = () => {
      const c = contact();
      if (c && markRef.current) {
        markRef.current.style.left = `${c.x}px`;
        markRef.current.style.top = `${c.y}px`;
      }
    };

    const tick = () => {
      state.p += (target - state.p) * 0.16;
      if (Math.abs(target - state.p) < 0.002) state.p = target;
      relief?.redraw();
      setConnected((was) => { const now = state.p >= CONNECT_AT; return was === now ? was : now; });
      raf = state.p !== target ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const onMove = (e: PointerEvent) => {
      if (reduced || pinned || !loaded) return;
      const c = contact(); if (!c) return;
      const r = host.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + c.x), e.clientY - (r.top + c.y));
      target = 1 - Math.min(1, d / (REACH * host.clientHeight));
      kick();
    };
    const onLeave = () => { if (!reduced && !pinned) { target = 0; kick(); } };
    // No hover on a touch screen: a tap closes the gap and holds it.
    const onTap = () => { if (coarse && loaded) { pinned = !pinned; target = pinned ? 1 : 0; kick(); } };

    if (page && loaded) {
      page.addEventListener("pointermove", onMove);
      page.addEventListener("pointerleave", onLeave);
      page.addEventListener("click", onTap);
    }
    const ro = new ResizeObserver(placeMark);
    ro.observe(host);
    placeMark();
    if (reduced) relief?.redraw();

    return () => {
      if (page) {
        page.removeEventListener("pointermove", onMove);
        page.removeEventListener("pointerleave", onLeave);
        page.removeEventListener("click", onTap);
      }
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      relief?.destroy(); cross?.destroy();
    };
  }, [ready, pageRef, picture, loaded]);

  return (
    <>
      {marble && (
        <div className="tb-marble" aria-hidden style={{ backgroundImage: `url(${marble})` }} />
      )}
      <div className="tb-grid" />
      <div className="tb-ascii" ref={reliefRef} />
      {picture && (
        <div ref={markRef} className="mono-micro tb-contact" aria-hidden data-on={connected || undefined}>
          <span className="tb-led tb-led--live" aria-hidden /> Connected
        </div>
      )}
      <Script src="/tb/bundle.js" strategy="afterInteractive" onReady={() => setReady(true)} />
    </>
  );
}
