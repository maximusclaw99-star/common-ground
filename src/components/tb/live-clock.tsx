"use client";

import { useSyncExternalStore } from "react";

/**
 * A ticking clock for the diagnostic strip, as the reference page carries.
 *
 * useSyncExternalStore rather than an interval in an effect: the server
 * snapshot is a dash, the client snapshot is the real time, and there is no
 * setState inside an effect for the linter to object to. The store ticks
 * once a second while anything is subscribed.
 */
const subscribe = (notify: () => void) => {
  const id = setInterval(notify, 1000);
  return () => clearInterval(id);
};

const pad = (n: number) => String(n).padStart(2, "0");

function now(zone: "utc" | "local"): string {
  const d = new Date();
  return zone === "utc"
    ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function LiveClock({ zone = "local" }: { zone?: "utc" | "local" }) {
  const time = useSyncExternalStore(subscribe, () => now(zone), () => "—");
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{time}</span>;
}
