# Security notes

What protects the public demo, what does not, and what to change before it is anything more than a demo.
Audited 2026-09-20.

## Secrets

- No secret is in the repo or its history (scanned for Databricks, Vercel, GitHub, Anthropic, AWS, Slack and
  JWT patterns before the repo went public). `.env*` is gitignored except `.env.example`, which holds names only.
- `.githooks/pre-commit` blocks a commit that adds a token. `npm install` activates it in every clone
  (`prepare` sets `core.hooksPath`); `databricks/scripts/setup.sh` does the same.
- Runtime secrets live in Vercel project environment variables and `~/common-ground/.env.local`:
  `DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_TOKEN`. Nothing is exposed under `NEXT_PUBLIC_`.
- The Databricks token is a personal access token with the owner's full workspace rights, because Free Edition
  offers nothing narrower. It expires 2026-10-03. Rotate it there and in Vercel; revoke the superseded ones.

## What a stranger can do on the public URL

- Upload a PDF (type and 15 MB checked before any byte is read) and have it read by `ai_query` in the warehouse.
- Run the plan agent on any listed posting (model serving, tool calls, a rewrite).
- Both are rate-limited per browser and per server instance (`src/lib/limit.ts`: 6 resume reads and 8 agent
  runs per ten minutes per session; 40 and 60 per instance). The limit is per instance, so the true ceiling is
  that times Vercel's instance count. A shared limiter is the upgrade if the demo gets real traffic.

## Data a stranger leaves behind

- `workspace.jobsearch.demo_sessions`: the profile extracted from their resume and their answers, keyed by a
  random cookie id. No name, email or password is asked for. The PDF itself is never stored.
- `workspace.jobsearch.agent_runs`: each agent run's plan, trace and tailored resume.
- Databricks job `retention-demo-data` (daily, 09:00 ET) deletes sessions older than 14 days and runs older
  than 30. Everything else in the warehouse is synthetic.

## Application

- Every warehouse statement is parameterised (`:name` bindings via the Statement Execution API); table names
  are constants. No SQL is built from user input.
- The demo cookie is `httpOnly`, `sameSite=lax`, `secure` in production, random UUID, 30 days.
- The cron endpoint requires `CRON_SECRET` with a constant-time compare and is inert without it.
- Response headers: `nosniff`, `X-Frame-Options: DENY`, strict referrer policy, a locked-down
  `Permissions-Policy`, HSTS; `X-Powered-By` off.
- Model output is rendered as text (no `dangerouslySetInnerHTML`, no markdown renderer). Every extracted
  profile is validated with zod before it is stored or ranked.
- `npm audit --omit=dev`: 0 vulnerabilities at the time of the audit.

## Not done, and why

- **No Content-Security-Policy.** Next's bootstrap scripts are inline; a real CSP needs a per-request nonce
  threaded through the app shell. Worth doing before any non-demo use.
- **No sign-in on the demo.** By design: a browser is a student. Supabase auth exists in the code and turns on
  with `NEXT_PUBLIC_SUPABASE_*`; the demo does not use it.
- **Per-instance rate limits** (see above).
- **Synthetic people only.** The pool is generated; there is no scraping and no real person's data in the
  warehouse besides what a visitor uploads about themselves.
