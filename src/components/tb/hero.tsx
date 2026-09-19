"use client";

import { useRef } from "react";
import { HeroLayers } from "./layers";
import { TypedLines } from "./typewriter";

/**
 * The hero, with its three background layers. One per page.
 *
 * The headline is flush right and the copy column sits under its right half —
 * the composition is asymmetric on purpose, and neither half is centred.
 * Headlines are broken by hand; a display line is never left to wrap.
 */
export function Hero({
  head, lines, note, children, picture, marble,
}: {
  head: React.ReactNode;
  lines: string[];
  note?: string;
  children?: React.ReactNode;
  /** A picture for the relief's subject, in place of the procedural one. */
  picture?: string;
  /** A faint paper-marbling texture under the grid. */
  marble?: string;
}) {
  const pageRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={pageRef}
      className="tb-page"
      // Tall enough that the hands are the page rather than a texture behind
      // it. Capped in px so a very tall monitor does not strand the bands
      // below it off-screen.
      style={{ position: "relative", flexGrow: 1, minHeight: "min(82vh, 880px)" }}
    >
      <HeroLayers pageRef={pageRef} picture={picture} marble={marble} />
      <div className="tb-hero tb-layer">
        <div className="tb-hero__inner">
          <h1 className="display-md tb-hero__head">{head}</h1>
          <div className="tb-hero__copy">
            <div className="mono-body tb-hero__lines" style={{ minHeight: 52 }}>
              <TypedLines lines={lines} />
            </div>
            {children && <div className="tb-hero__ctas">{children}</div>}
            {note && <p className="mono-micro tb-hero__note">{note}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
