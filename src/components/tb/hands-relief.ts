/**
 * Relief source: two hands reaching toward each other, fingertips not quite
 * touching.
 *
 * A paint function rather than an image. The AsciiRelief README calls that the
 * better option — it ships no file, costs nothing to load and redraws at
 * whatever grid the viewport produces — and it means the picture inside the
 * treatment is ours, which is what the system asks for.
 *
 * It is painted at grid resolution, under 200 x 80 cells, so this is a
 * silhouette rather than an illustration — and the buffer is squashed 1.6x
 * vertically before sampling, so vertical detail costs 1.6x what horizontal
 * detail does. That is why the index finger is raised and the other three are
 * one dropped mass: the notch between them is the feature that has to survive,
 * and anything finer than it does not. The layer reads density as
 * alpha x (1 - luminance), so everything here is black and alpha alone carries
 * the shading. Nothing is random: the same grid must produce the same field on
 * every repaint, or the texture would jitter on a theme change or a resize.
 */

/** Must match the `ratio` passed to asciiRelief: buffer cells are 1:1.6. */
export const RELIEF_RATIO = 1.6;

type Ctx = CanvasRenderingContext2D;

/** A limb. A round-capped stroke reads as flesh at this resolution. */
function limb(ctx: Ctx, pts: number[][], width: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/**
 * One hand in local units: wrist at the origin, reaching along +x, 1.0 is the
 * length from wrist to fingertip.
 *
 * Deliberately four masses, not five fingers. A glyph grid cannot resolve
 * individual curled fingers — they turn to noise — so the three of them are
 * one knuckle mass, set far enough below the extended index that the notch
 * between them survives. That notch, the raised thumb and the long index are
 * the whole reason this reads as a hand.
 */
function hand(ctx: Ctx) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";

  limb(ctx, [[-1.30, 0.16], [-0.10, 0.02]], 0.28, 0.95);                 // forearm
  limb(ctx, [[-0.05, 0.02], [0.26, 0.04]], 0.40, 0.92);                  // palm
  limb(ctx, [[0.28, 0.28], [0.46, 0.33], [0.58, 0.22]], 0.24, 0.84);     // curled fingers
  limb(ctx, [[0.30, -0.20], [0.70, -0.26], [1.00, -0.27]], 0.17, 0.90);  // index, extended
  limb(ctx, [[0.04, -0.26], [0.26, -0.52], [0.44, -0.48]], 0.16, 0.85);  // thumb
}

interface Placement { x: number; y: number; rot: number; mirror: boolean }

function place(ctx: Ctx, p: Placement, scale: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.mirror) ctx.scale(-1, 1);
  ctx.rotate(p.rot);
  ctx.scale(scale, scale);
  hand(ctx);
  ctx.restore();
}

/**
 * Contour banding, carved out rather than drawn on. The stand-in this replaces
 * is "banded like a contour map", and a flat silhouette resolves to a solid
 * block of identical glyphs — the bands are what make it read as plotted
 * output rather than a blob.
 *
 * Kept deliberately light. The silhouette is the subject; bands that cut too
 * deep shred it into stripes and the hands stop reading as hands at all.
 */
function carveContours(ctx: Ctx, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "butt";
  ctx.strokeStyle = "#000";

  const spacing = h / 9;
  for (let i = -1; i * spacing < h + spacing; i += 1) {
    const y = i * spacing;
    ctx.globalAlpha = 0.11;
    ctx.lineWidth = spacing * 0.13;
    ctx.beginPath();
    // A shallow wave, so the bands follow the forms instead of cutting
    // straight across them.
    for (let x = -2; x <= w + 2; x += 2) {
      const yy = y + Math.sin((x / w) * Math.PI * 1.4 + i * 0.4) * spacing * 0.55;
      if (x === -2) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function handsReliefSource() {
  return (ctx: Ctx, cols: number, rows: number) => {
    // Buffer cells are taller than they are wide, so squash vertically first
    // and then compose in units that are visually square.
    const w = cols;
    const h = rows * RELIEF_RATIO;

    ctx.save();
    ctx.scale(1, 1 / RELIEF_RATIO);
    ctx.clearRect(0, 0, w, h);

    // Wrist-to-fingertip. Small enough that each whole hand is visible with
    // its forearm running off the edge, rather than one forearm filling the
    // frame — the gesture is the subject, not the limb.
    // Small enough that each hand sits in its own space with the forearm
    // running off an edge. Drawn any larger, both crop into featureless
    // masses — at this grid there is no such thing as a detail that survives
    // being cut off.
    const scale = 0.22 * w;

    place(ctx, { x: 0.26 * w, y: 0.62 * h, rot: -0.14, mirror: false }, scale);
    place(ctx, { x: 0.74 * w, y: 0.44 * h, rot: 0.14, mirror: true }, scale);

    carveContours(ctx, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  };
}
