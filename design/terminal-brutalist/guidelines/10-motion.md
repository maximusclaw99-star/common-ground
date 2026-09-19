# Motion

Motion is not a token family here, because none of it is tunable. Six behaviours exist, each with one timing, and each lives in `components/bundle.css`.

| Behaviour | Class | Timing | What it does |
| --- | --- | --- | --- |
| Ticker pan | `.tb-ticker__track` | 34s linear, infinite | Translates the duplicated item list to `-50%`, which is why the loop has no seam |
| Grid pan | `.tb-grid` | 24s linear, infinite | Moves the background position by exactly `grid-pitch`, so the cycle end is invisible |
| Typewriter | `.tb-type` | `--tb-chars` × 45ms, stepped | Animates `width` from `0` to `--tb-chars` × `1ch` |
| Caret | `.tb-type` | 750ms, `step-end`, infinite | Toggles the right border between `ink` and transparent |
| Status LED | `.tb-led` | 1.6s, `steps(1, end)`, infinite | Holds at full opacity for 55% of the cycle, then drops to 0.2 |
| Button lift | `.tb-btn` | 100ms ease | Transitions `transform` and `box-shadow` only |
| Crosshair fade | `.tb-crosshair` | 120ms ease | Fades the layer in on pointer enter and out on leave. The lines themselves are never transitioned |

## Rules

- Everything continuous starts at page load and never stops. There is no scroll-triggered motion, no stagger on entry, no parallax.
- Nothing eases except the button. Every continuous behaviour is `linear` or stepped, because easing makes a machine look like it is performing.
- Never animate colour, opacity of text, or layout size. The LED is the only opacity animation in the system.
- The button lift and the crosshair fade are the only motion tied to input. The button moves rather than fades; the crosshair fades rather than eases, because its lines have to track the cursor exactly.
- `AsciiRelief` never animates. The grid is already moving behind it, and two moving textures in the same band is noise.
- One typewriter block per page, two lines maximum.

## Reduced motion

`bundle.css` ends with a `prefers-reduced-motion: reduce` block that stops the ticker, the grid and the LED, removes the button transition, and renders the typewriter lines in full with the caret hidden. That state is not a degraded fallback — it is the page as a meaningful share of readers will see it, so:

- Put the most important ticker announcement first, because the track will not move to reveal the second.
- Write typewriter copy that reads correctly when both lines appear at once.
- Never put information in the LED's blink. `Status: ● On` says "on" in a word, and it still does when the dot holds still.
