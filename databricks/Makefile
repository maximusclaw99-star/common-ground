.PHONY: setup generate load views check-secrets

setup:            ## venv + deps + git hooks + .env scaffold
	./scripts/setup.sh

generate:         ## regenerate data/seed/*.jsonl (deterministic)
	.venv/bin/python data/generate_mock.py

load:             ## generate + schema + upload + COPY INTO + views  (needs DATABRICKS_HOST/TOKEN)
	./scripts/load.sh

views:            ## only re-create views + materialized match tables
	./scripts/load.sh --views-only

check-secrets:    ## scan the whole tree for anything that looks like a token
	@git grep -nE 'dapi[0-9a-f]{20,}|RAPIDAPI_KEY[[:space:]]*=[[:space:]]*[^[:space:]]+|Bearer [A-Za-z0-9_\-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}' -- . ':!scripts/pre-commit' ':!Makefile' && { echo "✗ secrets found"; exit 1; } || echo "✓ no secrets found"
