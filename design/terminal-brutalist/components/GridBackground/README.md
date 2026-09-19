The engineering grid behind the page: two `grid-line` hairlines repeating at `grid-pitch`, panning one full cell every 24 seconds so the loop is invisible.

## What the consumer provides

- A positioned ancestor (`position: relative`) with `overflow: hidden`. The grid is `position: absolute; inset: 0` and will otherwise escape.
- `tb-layer` on every sibling that must sit above it. The grid is `z-index: 0` and `pointer-events: none`, so it never intercepts a click, but unlayered content can still land underneath.

## Rules

- `grid-line` is deliberately below the contrast floor — 6% ink on paper, 8% on terminal. It carries no information, so it must not read as content. If you find yourself raising it to make it visible, you want a bordered panel instead.
- One grid per page, on the hero. Repeating it in every section turns texture into noise.
- The pan distance equals `grid-pitch` exactly. Any other distance makes the grid visibly snap at the end of each cycle.
- Never put the grid behind long body copy. It belongs behind display type and whitespace.
- Under `prefers-reduced-motion` the grid holds still. It still reads correctly, which is why it is allowed to move at all.
