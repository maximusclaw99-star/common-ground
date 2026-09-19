A background layer that resamples an image down to one pixel per character cell and paints a monospace glyph per cell, chosen from a coverage ramp. It is what gives the page its plotted, instrument-output texture rather than a photographic one.

## What the consumer provides

`TB.asciiRelief(host, { source })`, where `host` is an element carrying `.tb-ascii` inside a positioned ancestor.

`source` is either:

- **A drawable** — an `<img>`, `<canvas>` or `ImageBitmap`. The image must be same-origin or CORS-enabled; a tainted canvas cannot be sampled and the layer silently renders nothing.
- **A function `(ctx, cols, rows)`** that paints the field itself at grid resolution. This is the better option: it ships no image, costs nothing to load, and scales to any viewport. `TB.reliefSource()` returns one.

Options: `cell` (column width in px, default 7), `ratio` (row height as a multiple of `cell`, default 1.6 — match your mono face's aspect), `alpha` (default 0.26), `ramp`, `gamma`.

## How coverage is read

Luminance says how dark a pixel is, alpha says how present it is, and the layer multiplies them. So a black field painted at varying alpha and a flat grayscale photograph both land on the same 0–1 coverage scale. Cells below the first ramp step are skipped entirely, which is why the layer stays cheap.

## Rules

- `alpha` belongs between 0.2 and 0.35. Above that the texture starts competing with the headline; below 0.15 it reads as a rendering artefact.
- Ink comes from the `ink` token at draw time, and the layer repaints on a `data-theme` change. Never hard-code its colour.
- It is `pointer-events: none` and `z-index: 0`. Everything else in the band needs `tb-layer`.
- Do not put it behind body copy — it belongs behind display type, the grid and whitespace.
- One relief per page. It is the single largest piece of texture in the system and a second one flattens both.
- It does not animate, and it must not. The grid already moves behind it; two moving textures at once is noise.
- Pair it with `GridBackground`, not instead of it. The grid gives the measured baseline, the relief gives the subject.

## On the artwork

`TB.reliefSource()` is procedural stand-in content: two masses reaching toward each other across a gap, banded like a contour map. It exists so the component has something to show and so the composition reads correctly at any size.

Replace it. Use artwork you own, commissioned work, or a public-domain source. Do not reuse another product's hero image in this treatment — the treatment is a technique and yours to use, the picture inside it is not.
