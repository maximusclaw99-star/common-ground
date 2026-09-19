The diagnostic strip that closes the page: environment facts in `mono-micro`, ending in a blinking LED. It is the detail that makes the whole page read as an instrument rather than a brochure.

## What the consumer provides

- Three to six short `KEY: VALUE` fields, uppercase. Real values, read from the client where possible — viewport, timezone, colour depth, build hash, region. Inventing them is the one thing that kills the effect.
- A status pair: a label, a `tb-led` and a word. The LED is decorative (`aria-hidden`), so the word carries the meaning for anyone who cannot see colour or motion.

## Rules

- `ink-faint` on `canvas` for the fields; the status pair steps up to `ink` so the one live fact is the one that reads first.
- `tb-led--live` uses `signal`, `tb-led--alert` uses `alert`. Both are 5.8:1 or better on `canvas` in both themes. Neither is ever placed on `inverse-surface`, where they fall under 3:1.
- Never carry status by the dot alone. `signal` and `alert` differ in hue, and hue alone is not a signal.
- The top border is `border-1` of `rule`. Padding is `space-16`, field gap `space-12`.
- One strip per page, pinned to the bottom of the layout, not to the viewport.
- Under `prefers-reduced-motion` the LED stops blinking and holds at full opacity, which still reads as on.
