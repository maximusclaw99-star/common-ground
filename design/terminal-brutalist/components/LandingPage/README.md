The whole landing screen assembled: ticker, nav, hero over the grid, diagnostic strip. Copy this file when you start a page; it is the reference composition, not a component to import.

## Order, top to bottom

1. `MarqueeBar` — the only inverted band.
2. `NavBar` — `tb-layer`, closed by a `rule` hairline.
3. `GridBackground` — absolute, behind everything from the nav down.
4. `AsciiRelief` — absolute, over the grid and under the content, at `alpha: 0.24`.
5. `Hero` — `tb-layer`, `flex-grow: 1` so it takes the remaining height.
6. `StatusFooter` — `tb-layer`, pinned to the bottom of the layout.
7. `Crosshair` — mounted on the page root, `z-index: 2`, so it crosses every band.

The page root carries `tb-root tb-page`, which sets the ground, the display family and a column flex layout with `min-height: 100%`.

Three layers stack in the background, and the order matters: the grid is the measured baseline, the relief is the subject, the crosshair is the instrument on top of both. Drop any one and the other two still read; reorder them and the page turns muddy.

## Rules

- Four bands, no more. Adding a fifth full-width band to this screen breaks the rhythm; extra content goes on a second page.
- The diagnostic fields are read from the client at load. Keep it that way — invented values are the difference between this reading as an instrument and reading as a costume.
- Everything moves at once on load: the ticker, the grid, the caret. That is the intended first impression, and it is also why nothing else on the page is allowed to animate.
- Swap the placeholder name `Helix`, the four copy strings, and the `AsciiRelief` source. Nothing else needs editing to rebrand the page.
- The relief here is `TB.reliefSource()`, procedural stand-in content. Point it at your own artwork before shipping — see `AsciiRelief`.
