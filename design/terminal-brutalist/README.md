A two-tone, square-cornered system for technical product pages. Warm paper ground, full-black ink, one grotesque and one monospace, no rounded corners and no blur anywhere. It reads as an instrument panel rather than a brochure, and every rule below exists to keep it on that side of the line.

The product name in every example is the placeholder **Helix**. Replace it, and the four copy strings in `LandingPage`, and the system is rebranded.

## Voice and copy

- Write short declaratives. "Proof for every build." Not "Helping teams build with confidence."
- Uppercase everything structural: headlines, nav links, button labels, ticker text, the diagnostic strip. Sentence case is for prose in `body` and `body-sm` only.
- Say *you* to the reader, *we* only where a person is doing the work. Never name the product as the subject of a sentence twice in a row.
- Use real numbers. `1,284 commits`, `3 exploitable paths`, `30bit`. The whole aesthetic depends on the page looking like it is reporting something it actually measured.
- Terminal punctuation carries meaning: `>` opens a machine line, `_` ends one that is still running, `↗` marks a link that leaves the current context. Do not use them decoratively.
- No emoji, anywhere.

## Color

Two themes. `light` (Paper) is the brand; `dark` (Terminal) is the same system with `canvas` and `ink` exchanged, plus lifted `signal` and `alert` so they still clear their grounds.

- Every page ground is `canvas`. Inset panels are `canvas-raised`, and are always separated from `canvas` by a `rule` line as well as by shade, because the two are only a few percent apart on purpose.
- Text runs `ink` → `ink-muted` → `ink-subtle` → `ink-faint`, in that order of importance. All four clear 4.5:1 on `canvas` and `canvas-raised` in both themes; `ink-faint` is the floor, and nothing smaller than `mono-micro` uses it.
- `inverse-surface` and `inverse-ink` are a pair. Use them only for the ticker and the solid button, and never put `ink`, `signal` or `alert` on `inverse-surface` — those fall below 3:1 there.
- `rule-strong` is for borders that carry meaning: controls, cards, inputs. `rule` is for decorative band dividers. Do not swap them.
- `signal` and `alert` are status only. Never brand, never decoration, never a fill behind text. Always pair them with a word, because hue alone is not a signal.
- `grid-line` is intentionally below the contrast floor. If you need it visible, you want a bordered panel instead.
- `focus-ring` is one value across both themes, chosen so a single outline clears 3:1 on `canvas`, `canvas-raised` and `inverse-surface`. Do not re-tint it per theme.

## Type

Two families, no third. `display` is Space Grotesk at 500 and 700; `mono` is Space Mono at 400 and 700. Both load from Google Fonts — there are no font files in this system.

- Headlines take `display-xl` / `display-lg` / `display-md` / `display-sm`, uppercase, with negative tracking. Break them by hand with `<br />`; never let a display line wrap on its own.
- Prose takes `body` or `body-sm` in `ink-muted`. Prose is the only sentence-case text in the system and the only text that is not in `display` or uppercase.
- Every interactive label is `mono-label`: uppercase, `0.1em` tracking, 700. No exceptions — a button set in `display` looks like a different product.
- `mono-ticker` is for the announcement bar only; its tracking is looser than `mono-label` so long strings stay readable in motion.
- `mono-micro` at 10px is the smallest text permitted. It is always uppercase and always `ink-faint`.
- Never mix a `display` style with a `mono` style on the same line.

## Space and layout

Spacing tokens are named by their pixel value, because this system copies real paddings rather than snapping to a grid. `space-14` and `space-10` are button paddings, not rounding errors.

- Page bands run full bleed, edge to edge, with no outer container. Only the hero's content is constrained, at `container-max`, and its copy column at `copy-max`.
- Band padding is `space-24` for the nav, `space-16` for the diagnostic strip, `space-32` / `space-64` for the hero below and above 768px.
- Compose asymmetrically. The hero headline is flush right; its copy column sits left-aligned under the headline's right half. Do not centre either one.
- Stack no more than four full-width bands on a screen.

## Borders, shadow and corners

- `radius-none` everywhere. The one exception in the whole system is `radius-dot` on the status LED.
- Borders do the work shadows do elsewhere: `border-1` of `rule-strong` on controls and containers, `border-1` of `rule` between bands.
- `shadow-brutal` and `shadow-brutal-lg` are hard offsets, zero blur, zero spread. A blurred or coloured shadow does not belong here.
- A shadow is a *state*, not decoration. `shadow-brutal` appears on hover, in the gap left by a 2px translate up and left, and disappears on `:active`. Only `shadow-brutal-lg` is allowed at rest, on a card that needs to sit proud of the page.
- Focus is a `border-2` `focus-ring` outline at `border-2` offset, on every interactive element. Never remove it, and never replace it with a colour change.

## Iconography

There is no logo in this system. The mark in `assets/Marks` is a placeholder built from the same square geometry as everything else — a square with an inscribed crosshair — and it is there so the nav has correct proportions, not because it is anyone's identity. Replace it before shipping.

Icons are single-ink SVG on a 24px box with a 2.5 stroke, square caps and joins, no fill. Draw with `currentColor` so a mark inherits `ink` or `inverse-ink` from its context. The one exception is anything under `assets/` displayed through `<img>`, which cannot inherit colour — those files name their ink in the group's README.

## Background layers

Three layers stack behind the hero, in this order, and each does a different job:

- `GridBackground` — the measured baseline. A 30px engineering grid in `grid-line`, panning one cell per cycle.
- `AsciiRelief` — the subject. Artwork resampled to one monospace glyph per cell, in `ink` at 0.2–0.35 alpha, so a picture arrives as plotted output rather than as a photograph. Never animated.
- `Crosshair` — the instrument. Cursor-tracking hairlines with a live coordinate readout, on fine pointers only.

Use all three together or none. Any one alone reads as an unfinished version of the other two, and nothing else in the system is allowed to add a fourth texture.

The relief ships with procedural stand-in artwork. Replace it with work you own, commissioned, or public-domain. The treatment is a technique and it is yours to use; whatever picture goes inside it has to be yours too.

## Motion

Six behaviours, defined in `components/bundle.css`, all documented in the Motion section. Everything that moves does so continuously and at a constant rate, and everything that moves starts at page load. Nothing moves in response to scroll. The only transitions tied to input are the 100ms button lift and the crosshair's 120ms fade.

## Components

`bundle.css` is nearly the whole implementation: every component is markup plus a class, so the previews are the reference implementation and copy straight into React, Svelte, Astro or plain HTML.

`bundle.js` is a small dependency-free runtime — `window.TB` — for the two layers that cannot be done in CSS: `TB.asciiRelief`, `TB.reliefSource` and `TB.crosshair`. Both read their colour and type from the tokens at draw time and repaint on a `data-theme` change, so neither needs telling about a theme switch. There is no framework dependency anywhere.

Start from `LandingPage`, which composes the other seven.
