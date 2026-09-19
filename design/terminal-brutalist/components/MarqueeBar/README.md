The full-bleed announcement ticker that sits above the nav, on `inverse-surface`, scrolling one direction forever.

Use it for one thing only: a live offer, a release, a status notice. It is the loudest element on the page because it is the only inverted band, so a second ticker anywhere else cancels the effect.

## What the consumer provides

- One to three announcement strings, each short enough to read while moving. Aim under 120 characters; anything longer reads as a paragraph in motion.
- An optional trailing link per string. Style it as an underlined `inverse-ink` link with a `↗` glyph.

## Markup

Set `mono-ticker` on `.tb-ticker`. Inside `.tb-ticker__track`, list every item **twice**, in the same order. The track animates to `translateX(-50%)`, so the second copy is what makes the loop seamless. Mark the duplicate set `aria-hidden="true"` so screen readers hear each announcement once.

## Rules

- Text is uppercase, `inverse-ink`, never `ink`. There is no light variant of this bar.
- The bottom border is `border-1` of `rule-strong`, not `rule`. It is a hard edge between two grounds, not a divider inside one.
- Vertical padding is `space-8`; the gap between items is `space-32` of horizontal padding on each item.
- Do not pause on hover and do not add controls. If the content is important enough to need re-reading, it belongs in the page, not the ticker.
- One loop is 34 seconds. Slower reads as broken, faster is unreadable.
- Under `prefers-reduced-motion`, the track stops and the first items stay visible. Keep the most important announcement first for that reason.
