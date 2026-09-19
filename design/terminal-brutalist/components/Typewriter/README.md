A monospace line that types itself out one character at a time, with a caret that keeps blinking after it lands.

It exists for exactly one job: the sub-headline under the hero, where it makes a static page feel like a running process. Do not use it for body copy, headings, labels, or anything a reader needs to re-read.

## What the consumer provides

- The text, in a `mono-*` style. The reveal animates `width` in `ch` units, so it only lines up in a monospace face.
- `--tb-chars`: the character count of that exact string, including spaces and punctuation. Get it wrong and the line either clips or finishes early against an empty gap.
- `--tb-delay` on every line after the first: the sum of the previous lines' durations. At 45ms per character, a 27-character line takes 1,215ms, so the next line starts at `1300ms`.

## Rules

- Two lines maximum. A third turns the hero into a loading screen.
- Put `tb-type--nocaret` on every line except the last, so only one caret blinks at a time.
- Reserve the block's height (`min-height`) so nothing below it jumps as lines arrive.
- The text is `ink-muted` on `canvas`, never `ink` — the headline above it owns full contrast.
- Never animate text a user must act on. The CTA below appears immediately; it does not wait for the typing.
- Under `prefers-reduced-motion` the animation is dropped and both lines render in full at once, caret hidden. Write the copy so that state reads correctly, because it is the state a real share of readers will get.
