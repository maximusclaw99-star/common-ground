# Implementation

Three files carry the entire system: the compiled `tokens.css` (custom properties plus a class per type style), `components/bundle.css` (component classes) and `components/bundle.js` (the two layers CSS cannot do). Load them in that order. Everything else is markup.

```html
<link rel="stylesheet" href="tokens.css" />
<link rel="stylesheet" href="bundle.css" />
<body class="tb-root tb-page">
  <!-- markup -->
  <script src="bundle.js"></script>
  <script>
    TB.asciiRelief(document.querySelector('.tb-ascii'), { source: TB.reliefSource() });
    TB.crosshair(document.querySelector('.tb-page'));
  </script>
```

`bundle.js` is a classic script with no dependencies and no network access. It defines one global, `TB`. Both entry points return a handle with `destroy()`, so a framework can clean up on unmount:

```jsx
useEffect(() => {
  const layer = TB.asciiRelief(ref.current, { source: TB.reliefSource() });
  return () => layer && layer.destroy();
}, []);
```

`tokens.css` declares every colour and shadow under `:root, [data-theme="light"]`, overrides them under `[data-theme="dark"]`, and declares spacing, radius, border and layout values plus `--font-display` and `--font-mono` on `:root`. Type styles arrive as classes: `display-xl`, `body`, `mono-label` and the rest.

## Themes

Set `data-theme` on `<html>`. There is no automatic theme — wire it to `prefers-color-scheme` yourself, and persist the reader's override if you offer a toggle.

```js
document.documentElement.dataset.theme =
  matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
```

One theme-conditional rule exists in `bundle.css`: the hero headline's `mix-blend-mode: multiply` is switched to `normal` under `[data-theme='dark']`. If you add another blend mode, check it in both themes before shipping.

## Fonts

Space Grotesk and Space Mono are hosted, not bundled — `bundle.css` opens with an `@import` from Google Fonts. Self-hosting is better for a production site: download both families, add `@font-face` rules, and drop the `@import`. The family stacks in `tokens.css` do not change.

## Porting to Tailwind

The source of this aesthetic was Tailwind utilities. If you go back to Tailwind, map tokens rather than re-deriving values:

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      canvas: 'var(--canvas)', ink: 'var(--ink)',
      'ink-muted': 'var(--ink-muted)', 'inverse-surface': 'var(--inverse-surface)',
      // ...one entry per color token
    },
    borderRadius: { none: 'var(--radius-none)' },
    boxShadow: { brutal: 'var(--shadow-brutal)', 'brutal-lg': 'var(--shadow-brutal-lg)' },
    fontFamily: { display: 'var(--font-display)', mono: 'var(--font-mono)' },
  },
}
```

Keep `bundle.css` for the five animated behaviours. They are keyframe animations with derived durations, which is not what utility classes are good at.

## Porting to components

Each `preview.html` is plain markup with no framework assumptions, so a component is a one-to-one translation. The only prop that needs computing is the typewriter's:

```jsx
const Type = ({ children, delay = 0, caret = true }) => (
  <span
    className={caret ? 'tb-type' : 'tb-type tb-type--nocaret'}
    style={{ '--tb-chars': children.length, '--tb-delay': `${delay}ms` }}
  >
    {children}
  </span>
);
```

Compute `--tb-chars` from the string rather than hard-coding it, and derive each line's delay from the sum of the previous lines' durations at 45ms per character.

## Putting a real picture in the relief

`tools/prep-relief.py` turns any photograph or painting into an `AsciiRelief` source:

```
python3 tools/prep-relief.py source.jpg assets/Art/subject.png --rect 120,80,1650,900 --lift 0.2
```

`--rect` is the box the subject sits in, in source pixels; GrabCut separates it from whatever ground is outside. `--lift` darkens the subject so a pale one still paints dense glyphs; `--gamma` shapes its shading. The output PNG carries the mask in its alpha channel, which is what lets the relief stop at the subject's edge rather than filling the frame. Load it with an `<img>` on the same origin and hand the element to `TB.asciiRelief`. For a fully self-contained page, `--data-uri` prints the PNG as a `data:` URI to inline.

Cell size sets the texture's coarseness: `cell: 7` is a chunky plot, `cell: 5` reads closer to a halftone. The row ratio should match your mono face's glyph aspect; Space Mono is about 1.6.

## Checklist before shipping a page

- Replace the placeholder name `Helix` and the mark in `assets/Marks`.
- The diagnostic strip reads real client values, not invented ones.
- Exactly one solid button on the screen.
- Both themes checked, including the hero's blend mode.
- `prefers-reduced-motion` checked: the page still reads with nothing moving.
- Every interactive element shows the `focus-ring` outline on keyboard focus.
