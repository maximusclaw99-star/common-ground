# Databricks data layer

The warehouse behind Common Ground. Everything is mock; every person is synthetic. The pool is **1,100 Virginia Tech
alumni** at 67 real employers — the Big Four, MBB, Booz Allen, Google, Microsoft, Databricks, Goldman, JPMorgan, Capital One
and the rest — built so that a VT resume finds hooks: every student organization on the Gobbler Connect list
(`data/vt_clubs_raw.txt`, 543 after dropping administrative units) has a couple of alumni. Employer names are real;
the people, their `@<firm>.example.com` emails, and their photos are not. What matters is that each one carries the
small, nameable things a coffee chat runs on — the same things `src/lib/affinity` scores:

| Ladder tier | What the data carries | Example |
|---|---|---|
| 2 same school + org | `education[].activities` | "You were both in Beta Alpha Psi at Virginia Tech" |
| 3 same school, made your move | `roles[]` history with `function` | cybersecurity analyst → consulting senior manager |
| 4 shared employer / client / program | `roles[].clients`, `roles[].programs` | "Deloitte Analyst Program", "CMS" |
| 5 hometown / high school / community | `hometown`, `high_school`, `communities[]` | "Deep Run High School", "Army ROTC" |
| 7 specific shared interest | `interests[]`, `projects[]` | "Formula 1", "built a responsible-AI checklist" |
| 8 something they published | `posts[]` with `publishedAt` | a 3-day-old lightning talk |
| 9 same event | `events[]` with `date` | Deloitte Tech Case Competition, yesterday |
| 10 one step ahead | `seniority` | analyst → associate |

Fourteen people (`p9001`–`p9014`) are planted around the demo student in `src/lib/session/demo-store.ts` so the
dashboard has a hook on every rung the moment `PEOPLE_PROVIDER=databricks` is set.

Every person and student carries a `photo_url` into `public/people/`: 200 randomuser.me portraits plus ~1,000 AI-generated
faces (this-person-does-not-exist.com — nobody real), fetched once by `scripts/fetch_portraits.py`, resized to 128 px and
committed so the demo never depends on a third-party host. The generator hands them out round-robin per gender, so almost
nobody on a page shares a face.

Verticals are `swe`, `consulting`, `finance`, `accounting`. A club that implies a vertical (Accounting Society, Cyber
Security Club, FinTech Club, The Consulting Group) sends its alumni there; the rest are spread by weight. Big firms are
weighted 3:1.5:1 over mid and small so the names you expect show up most.

## Turn it on in the app

```bash
# repo-root .env.local
PEOPLE_PROVIDER=databricks
DATABRICKS_HOST=https://dbc-xxxxxxxx-xxxx.cloud.databricks.com
DATABRICKS_WAREHOUSE_ID=<from SQL Warehouses -> Connection details>
DATABRICKS_TOKEN=<personal access token>
```

`npm run dev` — the dashboard now ranks the warehouse's 314 people instead of the 11-person fixture cast, and
`/jobs` shows the warehouse's 120 openings scored for the student, grouped by the month each window opens.

- `src/lib/people/databricks.ts` reads `workspace.jobsearch.v_people_provider`, which already emits `Person`'s
  column names; the file is transport, not mapping.
- `src/lib/positions/databricks.ts` reads `positions` + `companies` + `position_requirements` and scores in the app
  (`src/lib/positions/score.ts`) with the same weights as `v_student_position_matches`, because the student on the
  page is not a row in the warehouse's `students` table. `POSITIONS_PROVIDER` follows `PEOPLE_PROVIDER`.
- Skill-gap advice on `/jobs` is one `ai_query()` call for the top opening's headline gap, the same prompt as
  `v_skill_gap_advice`, raced against an 8-second deadline so it can never block the page.

## Rebuild the warehouse

```bash
cd databricks
make setup        # venv + faker + pre-commit secret scan
make load         # generate -> schema -> upload to volume -> COPY INTO -> views -> snapshots
make views        # views + snapshot tables only
```

Reads `DATABRICKS_HOST`/`DATABRICKS_TOKEN` from the repo-root `.env.local`. Idempotent. Falls back to batched
`INSERT` if Volumes are unavailable.

Optional, already done on the shared workspace: `scripts/create_genie_space.py` (plain-English questions over the
schema) and `scripts/create_vector_index.py` (semantic search over position descriptions).

## What's in `workspace.jobsearch`

**Tables** — `students`, `people`, `companies`, `positions`, `position_requirements`, `connection_paths` (one row per
shared thing between a student and a person: 11,210 hooks across 9 types).

**Views**
- `v_people_provider` — the app's `Person` shape. What the web reads.
- `v_student_people_matches` — per student: ranked people, `hook` (opener text), `talking_points[]` (every shared thing).
- `v_student_position_matches` — per student: scored positions with `reasons[]`.
- `v_skill_gaps` — what a posting asks for that the student lacks; `required` marks hard blockers.
- `v_opening_timeline` — when application windows open.
- `v_skill_gap_advice`, `v_tailored_resume`, `tailor_resume(student, position)` — the only places an LLM runs
  (`ai_query()` on Llama 3.3 70B). One call per row: always filter by student.
- `v_student_home` — top-5 people + top-5 positions per student in one row.

**Snapshots** — `matches_people`, `matches_positions`, refreshed by `make views`.

## Querying from anywhere

```bash
curl -s -X POST "$DATABRICKS_HOST/api/2.0/sql/statements" \
  -H "Authorization: Bearer $DATABRICKS_TOKEN" -H "Content-Type: application/json" \
  -d '{"warehouse_id":"'"$DATABRICKS_WAREHOUSE_ID"'",
       "statement":"SELECT person_name, company, hook, talking_points FROM workspace.jobsearch.v_student_people_matches WHERE student_id = :sid ORDER BY match_score DESC LIMIT 5",
       "parameters":[{"name":"sid","value":"s001"}],
       "wait_timeout":"30s","disposition":"INLINE","format":"JSON_ARRAY"}'
```

Rows come back positionally in `result.data_array`; zip with `manifest.schema.columns`. Array and struct columns
arrive as JSON strings, with integers inside structs stringified. `scripts/dbsql.py` is a 100-line reference client.

## Files

```
data/generate_mock.py       deterministic generator (Faker, seed 20260919); plants the Sam Rivera cast
data/seed/*.jsonl           committed mock data + demo_story.json
sql/00_schema.sql           schema, volume, tables, constraints, comments
sql/01_load.sql             COPY INTO from the volume (structs rebuilt in DDL order)
sql/02_views.sql            matching views, AI views, tailor_resume(), v_people_provider
sql/03_materialize.sql      snapshot tables + v_student_home
scripts/dbsql.py            stdlib client: Statement Execution API + Files API
scripts/load.py             end-to-end loader with INSERT fallback
scripts/create_genie_space.py / create_vector_index.py
scripts/pre-commit          blocks commits containing Databricks / GitHub / RapidAPI tokens
notebooks/01_explore.py     Databricks notebook walking the schema and views
docs/databricks_notes.md    what worked / didn't on Free Edition, with the exact errors
docs/demo.md                queries to run live
```

No tokens live in this repo. Every script reads from the environment; the pre-commit hook (`.githooks/pre-commit`, active after `npm install`) refuses anything that
looks like one. `make check-secrets` scans the tree.

## The plan agent

`/plan` in the app. Pick an opening; a Databricks-hosted model (Llama 3.3 70B, tool calling through Model Serving's
chat endpoint) decides which tools to call and returns a plan with its trace:

| Tool | Where it runs | What it is |
|---|---|---|
| `skill_gaps` | app (`src/lib/positions/gaps.ts`) | the posting's skills/certs the student lacks; in-progress certs marked as such |
| `learning_options(requirement)` | **Unity Catalog function** over `learning_catalog` (45 real certs and courses, cost, hours, weeks, URL) | how to close one gap, cheapest-and-fastest first |
| `rewrite_resume` | Databricks chat → Roman's `TailoredResumeSchema` + `findFabrications()` | the resume for this role, from the confirmed profile only, retried once with the check's findings |
| `finish` | — | the ordered plan |

Every run is written to `workspace.jobsearch.agent_runs` with its full trace, so Genie can answer "what did the agent
recommend most often" or "how many fabrications did the check catch". If the model is unavailable the same tools run
in a fixed order and the page says so; mock mode does the same without a model. `databricks/sql/04_agent.sql` +
`data/learning_catalog.json` are the warehouse side; `make load` installs them.

## The openings are real: the Summer 2027 Internships Directory

`workspace.jobsearch.internships` holds the directory export (6,632 postings, 1,060 employers, 17 categories,
live apply URLs) — the app's openings source in Databricks mode (`src/lib/positions/databricks.ts`). The source
carries no posting text, requirements or dates, so:

- `category_requirements` (data/category_requirements.json) is what each category typically asks for, and every
  opening page says "typical for … — read the posting itself";
- dates are stand-ins flagged `datesKnown: false`; the UI says "posted" / "just posted", never a countdown;
- `/jobs` groups by category (just-posted first) instead of by month, and caps each group at the 24 best fits;
- every opening has its own page, `/jobs/[id]`: what they ask for with have / in-progress / missing marks, where
  you stand, the people you can reach at that employer, and the plan agent on a button. The old `/plan` tab is gone.

`make load` uploads the JSONL to the volume and runs `sql/05_directory.sql`.
