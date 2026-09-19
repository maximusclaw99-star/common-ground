A square, bordered control whose hover state is physical: it translates 2px up and left, and `shadow-brutal` fills the gap it leaves. Nothing fades, nothing blurs.

## Variants

- **Solid** (`tb-btn--solid`) — `inverse-surface` fill, `inverse-ink` label. One per view, and it is the primary action.
- **Ghost** (`tb-btn`) — transparent fill, `border-1` of `rule-strong`, `ink` label. Everything else.
- **Small** (`tb-btn--sm`) — `space-10` / `space-20` padding instead of `space-14` / `space-24`. Reserved for the nav.

## What the consumer provides

- A label in `mono-label`, uppercase, two or three words. Never a sentence.
- An optional trailing `↗` for anything that leaves the current context. Nothing else goes inside a button: no icons, no spinners, no badges.
- `disabled` or `aria-disabled="true"` for the unavailable state, which drops the label and border to `ink-faint` and removes the lift.

## Rules

- `radius-none`, always. A rounded button is not in this system.
- Transition only `transform` and `box-shadow`, over 100ms. Colour never animates.
- On `:active` the button returns to its resting position with no shadow, so a click reads as the button being pressed back into the page.
- Focus is a `border-2` `focus-ring` outline at `border-2` offset. It is one value across both themes and clears 3:1 on `canvas`, `canvas-raised` and `inverse-surface`, so the solid variant needs no special case.
- Two buttons side by side are `space-16` apart. A solid button never sits next to another solid button.
- Under `prefers-reduced-motion` the transition is removed; the hover shadow still appears, it just appears at once.
