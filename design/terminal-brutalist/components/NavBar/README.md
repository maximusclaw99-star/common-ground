The primary navigation band: wordmark left, `mono-label` links centre, locale and a single small CTA right, closed by a `rule` hairline.

## What the consumer provides

- The wordmark: a 20×20 mark plus the product name in `title`, uppercase. Both inherit `ink`, so the mark must be a single-ink SVG drawn with `currentColor`.
- Three to five section links. More than five and the centre group starts competing with the wordmark.
- One CTA, using `tb-btn tb-btn--sm`. Never two — the second CTA belongs in the hero.

## Rules

- Links rest at `ink-subtle` and go to `ink` with a `border-2` underline on hover. The current section carries `aria-current` and takes the same treatment permanently.
- Padding is `space-24` on all four sides. The bottom border is `border-1` of `rule`, the decorative divider, because the nav and the page share one ground.
- Below 768px, hide the centre link group and keep the wordmark and CTA. Do not introduce a hamburger drawer; this system has no overlay surface.
- The locale control is optional. If present it sits in `ink-subtle` at `mono-label` and never gets a border.
- The nav sits above the background grid. Give it `tb-layer` when it overlaps `.tb-grid`.
