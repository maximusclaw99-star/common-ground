#!/usr/bin/env python3
"""
prep-relief.py — turn any picture into a source for TB.asciiRelief.

    python3 tools/prep-relief.py IN.jpg OUT.png
        [--crop L,T,R,B]         crop box in source pixels, applied first
        [--rect L,T,R,B]         subject box for segmentation (default: the crop
                                 inset 4%); everything outside is background
        [--no-segment]           keep the whole picture, just grayscale it
        [--width 480]            output width in px; height follows
        [--feather 3]            soft edge on the mask, in output px
        [--lift 0.0]             raise the subject's darkness before output;
                                 0.15–0.3 makes a light subject denser
        [--gamma 1.0]            contrast curve on the subject's shading
        [--data-uri]             also print a data: URI for inlining

Output is a PNG whose RGB is the subject's grayscale shading and whose alpha
is the subject mask. TB.asciiRelief reads density as alpha × (1 − luminance),
so background (alpha 0) paints nothing, highlights paint sparse glyphs and
shadows paint dense ones. Nothing here is clever: GrabCut with a rectangle
prior does the separation, and it only works when the subject sits on a
ground that differs from it in colour.
"""
import argparse
import base64
import io
import sys

import cv2
import numpy as np
from PIL import Image


def box(s):
    parts = [int(float(x)) for x in s.split(',')]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError('expected L,T,R,B')
    return parts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--crop', type=box)
    ap.add_argument('--rect', type=box)
    ap.add_argument('--no-segment', action='store_true')
    ap.add_argument('--width', type=int, default=480)
    ap.add_argument('--feather', type=float, default=3.0)
    ap.add_argument('--lift', type=float, default=0.0)
    ap.add_argument('--gamma', type=float, default=1.0)
    ap.add_argument('--iters', type=int, default=6)
    ap.add_argument('--data-uri', action='store_true')
    a = ap.parse_args()

    img = cv2.imread(a.src, cv2.IMREAD_COLOR)
    if img is None:
        sys.exit(f'could not read {a.src}')

    if a.crop:
        l, t, r, b = a.crop
        img = img[t:b, l:r]
    h, w = img.shape[:2]

    # Work at a sane size: GrabCut is O(pixels) and 1200px wide is plenty.
    scale = min(1.0, 1200 / w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    if a.no_segment:
        mask = np.full((h, w), 255, np.uint8)
    else:
        if a.rect:
            l, t, r, b = [int(v * scale) for v in a.rect]
        else:
            mx, my = int(w * 0.04), int(h * 0.04)
            l, t, r, b = mx, my, w - mx, h - my
        rect = (l, t, max(1, r - l), max(1, b - t))

        gc = np.zeros((h, w), np.uint8)
        bg = np.zeros((1, 65), np.float64)
        fg = np.zeros((1, 65), np.float64)
        cv2.grabCut(img, gc, rect, bg, fg, a.iters, cv2.GC_INIT_WITH_RECT)
        mask = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

        # Drop specks, close pinholes.
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0

    # Shading curve on the subject only: gamma, then an optional lift that
    # darkens everything so a pale subject still paints dense glyphs.
    gray = np.power(gray, a.gamma)
    gray = np.clip(gray * (1.0 - a.lift), 0, 1)

    # Resample to output size.
    ow = a.width
    oh = max(1, int(round(h * ow / w)))
    gray_o = cv2.resize(gray, (ow, oh), interpolation=cv2.INTER_AREA)
    mask_o = cv2.resize(mask, (ow, oh), interpolation=cv2.INTER_AREA)
    if a.feather > 0:
        mask_o = cv2.GaussianBlur(mask_o, (0, 0), a.feather)

    rgb = (gray_o * 255).astype(np.uint8)
    out = np.dstack([rgb, rgb, rgb, mask_o])
    Image.fromarray(out, 'RGBA').save(a.out, optimize=True)

    covered = (mask_o > 128).mean()
    print(f'{a.out}: {ow}x{oh}, subject covers {covered:.0%} of the frame')

    if a.data_uri:
        buf = io.BytesIO()
        Image.fromarray(out, 'RGBA').save(buf, 'PNG', optimize=True)
        uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
        print(f'data URI: {len(uri)} chars')
        print(uri)


if __name__ == '__main__':
    main()
