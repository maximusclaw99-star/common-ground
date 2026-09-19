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
  /** Fractions of the CONTENT BOX, not of the whole picture. */
  split: number;
  gap: number;
  contactY: number;
  /** The content box: where the hands actually are, in source pixels. */
  w: number;
  h: number;
  bx: number;
  by: number;
  /** The whole picture, in source pixels. */
  iw: number;
  ih: number;
}

export function measure(img: HTMLImageElement): Geometry | null {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return null;
  const c = document.createElement("canvas");
  c.width = iw; c.height = ih;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  let d: Uint8ClampedArray;
  try { d = ctx.getImageData(0, 0, iw, ih).data; } catch { return null; }

  // Coverage: alpha x darkness, so this works for a cutout and for a picture
  // on a white ground alike.
  const cov = (i: number) =>
    (d[i + 3] / 255) * (1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255);

  // The content box. A generated picture carries a lot of empty ground around
  // the subject, and fitting the whole frame makes the hands small for no
  // reason — everything below works inside this box instead.
  const rowSum = new Float32Array(ih);
  const colSum = new Float32Array(iw);
  for (let y = 0; y < ih; y += 1) {
    for (let x = 0; x < iw; x += 1) {
      const v = cov((y * iw + x) * 4);
      rowSum[y] += v; colSum[x] += v;
    }
  }
  const edge = (arr: Float32Array) => {
    let hi = 0;
    for (const v of arr) if (v > hi) hi = v;
    const t = hi * 0.02;
    let a = 0, b = arr.length - 1;
    while (a < arr.length && arr[a] <= t) a += 1;
    while (b > a && arr[b] <= t) b -= 1;
    return [a, b] as const;
  };
  const [by, by2] = edge(rowSum);
  const [bx, bx2] = edge(colSum);
  const bw = Math.max(1, bx2 - bx + 1), bh = Math.max(1, by2 - by + 1);

  // The gap between the hands, searched across the middle of the BOX.
  const from = bx + Math.floor(bw * 0.3), to = bx + Math.ceil(bw * 0.7);
  let minX = from, hi = 0;
  const band = new Float32Array(iw);
  for (let x = from; x < to; x += 1) {
    let sum = 0;
    for (let y = by; y <= by2; y += 2) sum += cov((y * iw + x) * 4);
    band[x] = sum; if (sum > hi) hi = sum;
    if (sum < band[minX]) minX = x;
  }
  const floor = band[minX] + (hi - band[minX]) * 0.04;
  let a = minX, b = minX;
  while (a > from && band[a - 1] <= floor) a -= 1;
  while (b < to - 1 && band[b + 1] <= floor) b += 1;

  // The row where the two sides come closest: most coverage just outside the gap.
  const pad = Math.max(2, Math.round(bw * 0.02));
  let bestY = by + Math.round(bh / 2), best = -1;
  for (let y = by; y <= by2; y += 1) {
    let sum = 0;
    for (let x = Math.max(0, a - pad); x < a; x += 1) sum += cov((y * iw + x) * 4);
    for (let x = b + 1; x <= Math.min(iw - 1, b + pad); x += 1) sum += cov((y * iw + x) * 4);
    if (sum > best) { best = sum; bestY = y; }
  }

  return {
    split: ((a + b) / 2 - bx) / bw,
    gap: (b - a + 1) / bw,
    contactY: (bestY - by) / bh,
    w: bw, h: bh, bx, by, iw, ih,
  };
}

/** Where the picture lands in a buffer, in visually-square units. */
export interface Fit { ox: number; oy: number; dw: number; dh: number; W: number; H: number }

/**
 * How much of the band's height the hands should occupy. Driven by height
 * rather than contained, so the hands are as large as the band allows and the
 * forearms run off the left and right edges — which is how the reference
 * composes them. Containing the whole picture instead leaves the subject
 * small in a frame of empty ground.
 */
export const FILL_H = 0.74;

/**
 * Where the fingertips sit in the band, as fractions of it.
 *
 * The picture is placed by its contact point rather than centred by its
 * frame: the headline is flush right, so a centred composition puts the one
 * moment worth looking at directly behind the largest type on the page. Left
 * of centre and a little low keeps it in clear air while the forearms still
 * run off both edges.
 */
export const ANCHOR_X = 0.42;
export const ANCHOR_Y = 0.54;

export function fit(geo: Geometry, cols: number, rows: number): Fit {
  const W = cols, H = rows * RELIEF_RATIO;
  const s = (FILL_H * H) / geo.h;
  const dw = geo.w * s, dh = geo.h * s;
  return {
    ox: ANCHOR_X * W - geo.split * dw,
    oy: ANCHOR_Y * H - geo.contactY * dh,
    dw, dh, W, H,
  };
}

// Of buffer width, per side. Small on purpose: the picture already has its
// forearms at the frame edges, so a large rest gap pushes a whole hand out of
// frame — the reference rests both hands fully visible, just not touching.
export const REST_APART = 0.018;
/**
 * Both fractions of the band's height. Inside NEAR the hands are fully
 * together; from there out to REACH they ease apart. Without a NEAR zone the
 * closeness only reaches 1 within a couple of dozen pixels of one exact point,
 * which is not what "move your cursor close to the hands" should mean.
 */
export const NEAR = 0.16;
export const REACH = 0.95;
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

    // The picture is drawn whole, positioned so its content box lands exactly
    // on the fit rect. Cropping the bitmap itself would cost a second canvas
    // on every repaint, and this runs on every animation frame.
    const s = f.dw / geo.w;
    const px = f.ox - geo.bx * s, py = f.oy - geo.by * s;
    const pw = geo.iw * s, ph = geo.ih * s;

    ctx.save();
    ctx.scale(1, 1 / RELIEF_RATIO);
    ctx.clearRect(0, 0, f.W, f.H);
    ctx.imageSmoothingEnabled = true;

    // Left half, moved right.
    ctx.save();
    ctx.beginPath(); ctx.rect(-f.W, 0, f.W + splitX + inward, f.H); ctx.clip();
    ctx.drawImage(img, px + inward, py, pw, ph);
    ctx.restore();

    // Right half, moved left, darkened. Brushed metal is bright, and bright
    // paints sparse — it has to read lighter than the human hand, as the
    // reference's second hand does, without disappearing.
    ctx.save();
    ctx.beginPath(); ctx.rect(splitX - inward, 0, f.W * 2, f.H); ctx.clip();
    ctx.drawImage(img, px - inward, py, pw, ph);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.8;
    ctx.drawImage(img, px - inward, py, pw, ph);
    ctx.restore();

    ctx.restore();
  };
}
