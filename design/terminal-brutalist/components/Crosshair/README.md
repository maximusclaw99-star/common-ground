Two full-bleed hairlines that follow the cursor, with a dot at the intersection and a live `x` / `y` readout beside it.

`TB.crosshair(host)` appends the layer to `host` and tracks pointer movement within it. `host` needs `position: relative` and `overflow: hidden`.

## Rules

- Lines are `rule`, the dot is `ink`, the readout is `ink-subtle` at `mono-micro`. The readout is uppercase, two lines, `white-space: pre`.
- Fine pointers only. `TB.crosshair` returns `null` on a coarse pointer and the CSS hides the layer at `(pointer: coarse)`, because a crosshair that lags a finger reads as a bug.
- It is `aria-hidden` and `pointer-events: none`. Nothing is ever reached through it and nothing is ever announced by it.
- Coordinates are relative to `host`, not the viewport. If the crosshair spans the page, `host` is the page.
- One per page, on the hero band. Do not scope it to a card.
- The only motion is a 120ms opacity fade on enter and leave. The lines themselves are not transitioned — they must track the cursor exactly, and easing them turns precision into drift.
- It is decoration that claims to be instrumentation, so keep the claim small. Coordinates are honest. An invented "threat level" or "scan progress" is not.
