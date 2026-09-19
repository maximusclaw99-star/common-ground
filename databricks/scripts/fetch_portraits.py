#!/usr/bin/env python3
"""
Download the randomuser.me portrait set into public/people/ once, so the demo never depends on a
third-party host at judging time. Skips files that already exist. 200 files, ~2 MB total.

    python databricks/scripts/fetch_portraits.py

These are photos of models who consented to mockup use (randomuser.me terms). If that ever feels
wrong for the audience, swap generate_mock.py's photo_url to DiceBear notionists SVGs instead.
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "people"
N = 100  # randomuser.me has men/0..99 and women/0..99


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fetched = skipped = failed = 0
    for gender in ("men", "women"):
        for i in range(N):
            dest = OUT / f"{gender}-{i}.jpg"
            if dest.exists() and dest.stat().st_size > 1000:
                skipped += 1
                continue
            url = f"https://randomuser.me/api/portraits/{gender}/{i}.jpg"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "common-ground-hackathon/1.0"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    dest.write_bytes(r.read())
                fetched += 1
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f"  failed {url}: {e}", file=sys.stderr)
    print(f"portraits: fetched={fetched} skipped={skipped} failed={failed} -> {OUT}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
