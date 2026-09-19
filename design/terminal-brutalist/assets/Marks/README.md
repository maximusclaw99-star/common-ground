# Marks

There is no logo in this system. `placeholder-mark.svg` is a stand-in built from the system's own geometry — a square with an inscribed crosshair, 24×24 box, 2.5 stroke, square caps, no fill — so the nav has correct proportions while the real identity is missing. Replace it before shipping anything public, and do not treat it as a brand asset.

Its ink is hard-coded `#111111`, because a file displayed through `<img>` cannot inherit `currentColor`. Use this file only on `canvas` in the light theme. Anywhere the mark must follow the theme — the nav, a button, a favicon in dark mode — inline the same two paths as SVG markup with `stroke="currentColor"`, as `NavBar` does, and it will pick up `ink` or `inverse-ink` from its context.
