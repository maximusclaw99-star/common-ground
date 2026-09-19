The landing hero: an oversized uppercase headline pushed to the right edge, a monospace copy block underneath it, and the engineering grid running behind both.

The asymmetry is the idea. The headline is flush right against the page edge; the copy and CTAs sit in a narrow left-aligned column tucked under its right half. Centring any part of it collapses the composition.

## What the consumer provides

- A headline of two to five words, uppercase, broken onto two or three lines with explicit `<br />`. Never let it wrap on its own.
- Two typewriter lines (see `Typewriter`), or static `mono-lead` text if the page has no room for motion.
- Exactly two CTAs: one `tb-btn--solid`, one ghost.
- An optional `mono-micro` footnote in `ink-faint`.

## Rules

- The headline is `display-md` below 768px and `display-xl` above. The swap is in `bundle.css`, not in markup.
- `mix-blend-mode: multiply` on the headline lets the grid read through it on paper. It is switched off under `[data-theme='dark']`, where multiply would erase light ink against a dark ground.
- The content column is capped at `container-max`; the copy block at `copy-max`.
- Padding is `space-32` below 768px, `space-64` above.
- Space under the headline is `space-48`, and nothing else goes in that gap.
- Give the hero `tb-layer` so it sits above `.tb-grid`.
- One hero per page. The composition depends on being the only right-aligned thing in the document.
