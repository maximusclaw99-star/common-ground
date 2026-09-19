/**
 * A picture as the relief's subject, split at the gap between two hands, with
 * the halves closing as the cursor nears the point where they would touch.
 *
 * This is the reference page's own treatment: the hands arrive as plotted
 * glyphs, not as a photograph. The layer is driven through the relief handle's
 * redraw(), so the picture never leaves the system's rendering path — the same
 * ramp, the same ink token, the same repaint on a theme change.
 *
 * Geometry is measured from the picture's alpha at load, so a regenerated
 * picture with the gap somewhere else still works.
 */

export const RELIEF_RATIO = 1.6;

export interface Geometry {
  /** Fractions of the picture. */
  split: number;
  gap: number;
  contactY: number;
  w: number;
  h: number;
}

export function measure(img: HTMLImageElement): Geometry | null {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  let d: Uint8ClampedArray;
  try { d = ctx.getImageData(0, 0, w, h).data; } catch { return null; }

  // Coverage per column: alpha x darkness, so it works for a cutout and for
  // a picture on a white ground alike.
  const cov = (i: number) => (d[i + 3] / 255) * (1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255);
  const from = Math.floor(w * 0.3), to = Math.ceil(w * 0.7);
  const col = new Float32Array(w);
  let hi = 0;
  for (let x = from; x < to; x += 1) {
    let s = 0;
    for (let y = 0; y < h; y += 2) s += cov((y * w + x) * 4);
    col[x] = s; if (s > hi) hi = s;
  }
  let minX = from;
  for (let x = from; x < to; x += 1) if (col[x] < col[minX]) minX = x;
  const floor = col[minX] + (hi - col[minX]) * 0.04;
  let a = minX, b = minX;
  while (a > from && col[a - 1] <= floor) a -= 1;
  while (b < to - 1 && col[b + 1] <= floor) b += 1;

  // The row where the two sides come closest: most coverage just outside the gap.
  const pad = Math.max(2, Math.round(w * 0.02));
  let bestY = Math.round(h / 2), best = -1;
  for (let y = 0; y < h; y += 1) {
    let s = 0;
    for (let x = Math.max(0, a - pad); x < a; x += 1) s += cov((y * w + x) * 4);
    for (let x = b + 1; x <= Math.min(w - 1, b + pad); x += 1) s += cov((y * w + x) * 4);
    if (s > best) { best = s; bestY = y; }
  }
  return { split: (a + b) / 2 / w, gap: (b - a + 1) / w, contactY: bestY / h, w, h };
}

/** Where the picture lands in a buffer, in visually-square units. */
export interface Fit { ox: number; oy: number; dw: number; dh: number; W: number; H: number }

export function fit(geo: Geometry, cols: number, rows: number): Fit {
  const W = cols, H = rows * RELIEF_RATIO;
  const s = Math.min(W / geo.w, H / geo.h);
  const dw = geo.w * s, dh = geo.h * s;
  return { ox: (W - dw) / 2, oy: (H - dh) / 2, dw, dh, W, H };
}

// Of buffer width, per side. Small on purpose: the picture already has its
// forearms at the frame edges, so a large rest gap pushes a whole hand out of
// frame — the reference rests both hands fully visible, just not touching.
export const REST_APART = 0.018;
export const REACH = 0.9;           // radius, as a fraction of host height
export const CONNECT_AT = 0.965;
export const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** How far each half has moved inward at closeness p. */
export function inwardAt(geo: Geometry, f: Fit, p: number): number {
  return -REST_APART * f.W + ease(p) * (REST_APART * f.W + (geo.gap * f.dw) / 2);
}

/**
 * The relief source. Paints the two halves into the buffer, each translated
 * by the current closeness. The right half is darkened a touch: brushed metal
 * is bright, and bright paints sparse — the reference's second hand reads
 * lighter too, but it must not vanish.
 */
export function pictureSource(img: HTMLImageElement, geo: Geometry, state: { p: number }) {
  return (ctx: CanvasRenderingContext2D, cols: number, rows: number) => {
    const f = fit(geo, cols, rows);
    const inward = inwardAt(geo, f, state.p);
    const splitX = f.ox + geo.split * f.dw;

    ctx.save();
    ctx.scale(1, 1 / RELIEF_RATIO);
    ctx.clearRect(0, 0, f.W, f.H);
    ctx.imageSmoothingEnabled = true;

    // Left half, moved right.
    ctx.save();
    ctx.beginPath(); ctx.rect(-f.W, 0, f.W + splitX + inward, f.H); ctx.clip();
    ctx.drawImage(img, f.ox + inward, f.oy, f.dw, f.dh);
    ctx.restore();

    // Right half, moved left, lifted.
    ctx.save();
    ctx.beginPath(); ctx.rect(splitX - inward, 0, f.W * 2, f.H); ctx.clip();
    ctx.drawImage(img, f.ox - inward, f.oy, f.dw, f.dh);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(img, f.ox - inward, f.oy, f.dw, f.dh);
    ctx.restore();

    ctx.restore();
  };
}
