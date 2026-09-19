#!/usr/bin/env python3
"""
Build the portrait pool in public/people/ once, so the demo never depends on a third-party host.

Two sets:
  men-N.jpg / women-N.jpg        200 randomuser.me portraits (photos of consenting models), N in 0..99
  ai-men-N.jpg / ai-women-N.jpg  AI-generated faces from this-person-does-not-exist.com — nobody real — resized
                                 to 128px (~6 KB each) so 1,000 of them stay under 6 MB in the repo

    python databricks/scripts/fetch_portraits.py               # 200 photos + 500 per gender AI faces (~15 min, rate-limited)
    python databricks/scripts/fetch_portraits.py --ai 300      # fewer AI faces

Skips files that already exist, so re-running only fills gaps. The generator (data/generate_mock.py)
counts whatever is present and assigns portraits round-robin, so any pool size works.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "people"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) common-ground-hackathon/1.0"}


def fetch(url: str, dest: Path, timeout: int = 25) -> bool:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
        if len(data) < 1000:
            return False
        dest.write_bytes(data)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  failed {url}: {e}", file=sys.stderr)
        return False


def shrink(path: Path, px: int = 128) -> None:
    """macOS sips is always there; elsewhere try Pillow; otherwise keep the original."""
    try:
        subprocess.run(["sips", "-Z", str(px), "-s", "formatOptions", "72", str(path), "--out", str(path)],
                       check=True, capture_output=True)
        return
    except Exception:  # noqa: BLE001
        pass
    try:
        from PIL import Image  # type: ignore
        im = Image.open(path)
        im.thumbnail((px, px))
        im.save(path, quality=72)
    except Exception:  # noqa: BLE001
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ai", type=int, default=500, help="AI faces per gender to fetch")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    fetched = skipped = failed = 0
    for gender in ("men", "women"):
        for i in range(100):
            dest = OUT / f"{gender}-{i}.jpg"
            if dest.exists() and dest.stat().st_size > 1000:
                skipped += 1
                continue
            ok = fetch(f"https://randomuser.me/api/portraits/{gender}/{i}.jpg", dest)
            fetched += ok
            failed += not ok

    # AI faces: this-person-does-not-exist.com hands back a JSON pointer to a freshly generated
    # image; the image itself is ~100 KB, so it is resized on arrival. Paced, because bursts get reset.
    for gender, param in (("men", "male"), ("women", "female")):
        for i in range(args.ai):
            dest = OUT / f"ai-{gender}-{i}.jpg"
            if dest.exists() and dest.stat().st_size > 1000:
                skipped += 1
                continue
            ok = False
            for attempt in range(4):
                try:
                    q = f"https://this-person-does-not-exist.com/new?time={int(time.time() * 1000)}{i}&gender={param}&age=26-35&etnic=all"
                    req = urllib.request.Request(q, headers=UA)
                    with urllib.request.urlopen(req, timeout=25) as r:
                        src = json.loads(r.read()).get("src")
                    if src and fetch("https://this-person-does-not-exist.com" + src, dest):
                        ok = True
                        break
                except Exception as e:  # noqa: BLE001
                    print(f"  failed ai-{gender}-{i} (attempt {attempt + 1}): {e}", file=sys.stderr)
                time.sleep(2.0 * (attempt + 1))
            time.sleep(0.4)
            if ok:
                shrink(dest)
                fetched += 1
            else:
                failed += 1
            if (i + 1) % 50 == 0:
                print(f"  ai-{gender}: {i + 1}/{args.ai}", flush=True)

    total = sum(f.stat().st_size for f in OUT.glob("*.jpg"))
    print(f"portraits: fetched={fetched} skipped={skipped} failed={failed} -> {OUT} ({total / 1e6:.1f} MB)")
    if failed and fetched == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
