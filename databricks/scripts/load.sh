#!/usr/bin/env bash
# Regenerate mock data and (re)load everything into Databricks.
# Needs DATABRICKS_HOST and DATABRICKS_TOKEN in the environment (or in .env).
set -euo pipefail
cd "$(dirname "$0")/.."

# Next reads .env.local at the repo root; reuse it so one file configures both sides.
for f in ../.env.local ../.env .env; do
  if [ -f "$f" ] && [ -z "${DATABRICKS_TOKEN:-}" ]; then set -a; . "$f"; set +a; fi
done

PY=.venv/bin/python
[ -x "$PY" ] || PY=python3

exec "$PY" scripts/load.py "$@"
