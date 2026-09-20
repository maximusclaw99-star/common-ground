#!/usr/bin/env bash
# One-time local setup: venv, deps, git hooks, .env scaffold.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v uv >/dev/null 2>&1; then
  [ -d .venv ] || uv venv .venv -q
  uv pip install -q --python .venv/bin/python -r requirements.txt
else
  [ -d .venv ] || python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

chmod +x scripts/pre-commit scripts/load.sh
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$ROOT" ] && [ -d "$ROOT/.git" ]; then
  git -C "$ROOT" config core.hooksPath .githooks
  echo "pre-commit secret scan active: core.hooksPath -> .githooks"
fi

[ -f .env ] || { cp .env.example .env; echo "created .env — fill in DATABRICKS_HOST and DATABRICKS_TOKEN"; }
echo "done. next: put DATABRICKS_HOST / DATABRICKS_TOKEN in the repo-root .env.local (or export them) then ./scripts/load.sh"
