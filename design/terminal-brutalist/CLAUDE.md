# Terminal Brutalist — for agents working in this repo

A two-tone, square-cornered design system for technical product pages. Warm paper ground, full-black ink, one grotesque and one monospace, no rounded corners and no blur anywhere.

## Read these first, in this order

1. `README.md` — the brand book. Usage rules that name tokens. Read it before writing any markup.
2. `tokens.json` — every token with a usage note saying where it is used and which grounds it reads on.
3. `components/<Name>/README.md` — guidelines for that component. Read the one you are about to use.
4. `components/<Name>/preview.html` — the reference implementation. Plain markup plus classes, no framework assumptions, so it translates one-to-one into React, Svelte, Astro or plain HTML.

`guidelines/10-motion.md` and `guidelines/20-implementation.md` cover the six animations and how to wire the system into a build.

## What to load

```html
<link rel="stylesheet" href="tokens.css" />
<link rel="stylesheet" href="components/bundle.css" />
<script src="components/bundle.js"></script>
```

`tokens.css` is **generated** from `tokens.json`. Change the JSON and recompile; never hand-edit the CSS. `bundle.js` is a dependency-free classic script defining one global, `TB`, with `asciiRelief`, `reliefSource` and `crosshair`. Both entry points return a handle with `destroy()` for framework cleanup.

`index.html` is the composed landing page and runs with no build step. Open it directly.

## Rules that are easy to get wrong

- **Never hard-code a colour, size or shadow.** Every value is a token. If you need one that does not exist, add it to `tokens.json` with a usage note rather than inlining it.
- **`radius-none` everywhere.** The status LED is the only rounded thing in the system. Do not soften a corner.
- **`rule-strong` for control borders, `rule` for decorative band dividers.** They are not interchangeable.
- **Shadows are states, not decoration.** `shadow-brutal` appears on hover, in the gap left by a 2px translate up and left. Only `shadow-brutal-lg` is allowed at rest.
- **Every interactive label is `mono-label`**, uppercase. A button set in the display face looks like a different product.
- **`signal` and `alert` are status only**, and never sit on `inverse-surface` — they fall below 3:1 there. Always pair them with a word; hue alone is not a signal.
- **Check both themes.** Contrast floors are stated per token and hold in `light` and `dark`. The hero's `mix-blend-mode` is the one theme-conditional rule in the stylesheet.
- **Respect `prefers-reduced-motion`.** The stylesheet already handles it; anything you add must too.
- **One per page:** one hero, one ticker, one relief, one crosshair, one diagnostic strip. These are composition rules, not suggestions — the layout depends on each being the only one of its kind.

## Placeholders to replace before shipping

- The product name `Helix`, in `index.html` and the `NavBar` / `LandingPage` previews.
- The mark in `assets/Marks/` — a generic square-and-crosshair stand-in, not an identity.
- The `AsciiRelief` source. It ships with `TB.reliefSource()`, procedural stand-in artwork. Point it at work you own, commissioned, or public-domain. The treatment is a technique and it is yours to use; the picture inside it has to be yours too.
- The diagnostic strip must read real client values. Invented ones are the difference between this reading as an instrument and reading as a costume.

## Adding a component

Add `components/<Name>/preview.html` (line 1 is the `@dsCard` marker) and `components/<Name>/README.md` saying what the consumer provides and the do/don'ts. Put shared styling in `components/bundle.css` bound to tokens. Keep `bundle.js` for behaviour CSS genuinely cannot do.
