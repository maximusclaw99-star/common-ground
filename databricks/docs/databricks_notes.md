# Databricks Free Edition — what worked, what didn't

Tested 2026-09-19 against a fresh Free Edition workspace (serverless only, no account console).
Everything below was exercised by `scripts/load.py`, `scripts/create_genie_space.py`, or a direct REST call.

## Worked

| Feature | How we use it | Notes |
|---|---|---|
| **Unity Catalog** (schema, Delta tables, PK/FK constraints, comments) | `sql/00_schema.sql` | Constraints are informational (not enforced) but Genie and the UI read them. |
| **UC Volumes + Files API** | `scripts/load.py` uploads `data/seed/*.jsonl` to `/Volumes/workspace/jobsearch/seed` | `PUT /api/2.0/fs/files/Volumes/...?overwrite=true`, body is raw bytes. |
| **COPY INTO** from JSON | `sql/01_load.sql` | Arrays come through natively; we `CAST` dates/timestamps in the SELECT. `force=true` so re-runs reload. |
| **SQL Statement Execution API** | `scripts/dbsql.py` | The frontend should use this too. `wait_timeout=30s` + poll. Warehouse id: first warehouse in `/api/2.0/sql/warehouses` (Free Edition: "Serverless Starter Warehouse"). |
| **Managed MCP server** (`/api/2.0/mcp/sql`) | Claude Code / Cursor talk to the data directly | PAT in an `Authorization: Bearer` header works. No OAuth app needed. |
| **`ai_query()` on hosted foundation models** | `v_skill_gap_advice`, `v_tailored_resume`, `tailor_resume()` TVF | Pay-per-token endpoints available on Free Edition (as of test): `databricks-meta-llama-3-3-70b-instruct`, `databricks-gpt-oss-120b`, `databricks-gpt-oss-20b`, `databricks-llama-4-maverick`, `databricks-qwen3-next-80b-a3b-instruct`, `databricks-qwen35-122b-a10b`, `databricks-gemma-3-12b`, `databricks-meta-llama-3-1-8b-instruct`. Embeddings: `databricks-gte-large-en`, `databricks-bge-large-en`, `databricks-qwen3-embedding-0-6b`. **No Claude models** on Free Edition — we use Llama 3.3 70B. |
| **SQL table-valued function** with `ai_query` inside | `workspace.jobsearch.tailor_resume(student_id, position_id)` | Scalar subquery inside the TVF body works. |
| **Vector Search** endpoint + delta-sync index | `positions_index` on `positions.description`, embedded with `databricks-gte-large-en` | `POST /api/2.0/vector-search/endpoints` (STANDARD) returned ONLINE immediately; index creation accepted. Source table needs `delta.enableChangeDataFeed = true`. Provisioning took a while — see status below. |
| **Genie space via API** | `scripts/create_genie_space.py` | `POST /api/2.0/genie/spaces` with `title`, `description`, `warehouse_id`, `serialized_space` (a JSON string). Format learned from `GET .../spaces/{id}?include_serialized_space=true` on the starter space. Space id `01f1b4688b5719a2beb2c2efdc999999` (recreated 2026-09-19 after adding photo_url) (`/genie/rooms/<id>` in the workspace). |
| **Genie conversation API** | tested with `start-conversation` + poll | Asked "top 3 people s001 should reach out to"; Genie wrote the correct `matches_people` query and a natural-language answer citing the Women-in-CS hook. Note: message JSON contains raw control chars — parse with `json.loads(..., strict=False)`. |
| **Change Data Feed** table property | `positions`, `students` | Set in DDL. Required by Vector Search delta-sync. |

## Genie API gotchas (each one cost a 400)

1. `serialized_space` is required and must be a JSON **string**, not an object.
2. `data_sources.tables` must be sorted by `identifier`.
3. Every `sample_question`, `text_instruction`, `example_question_sql` needs an `id`: 32 lowercase hex chars, no hyphens (`uuid4().hex`).
4. Each of those lists must be sorted by `id`.

`scripts/create_genie_space.py` handles all four.

## Didn't work / not available

| Feature | Result |
|---|---|
| **Account console / OAuth apps** | Free Edition has no account console, so no custom OAuth app. This rules out the claude.ai "custom connector" (needs a client id). PAT-based clients (Claude Code, Cursor, `mcp-remote`) work fine. |
| **Databricks CLI** | Not used — didn't want a CLI dependency for teammates. Everything is REST via stdlib `urllib`. |
| **Claude models via `ai_query`** | Not on the Free Edition endpoint list. Use `databricks-meta-llama-3-3-70b-instruct` (best quality of the available set for instruction following). |

## Cost / quota notes

- Free Edition has usage limits; `ai_query` views are one model call per row. Always filter `WHERE student_id = ...` before selecting from `v_skill_gap_advice` or `v_tailored_resume`. Never `SELECT *` them unfiltered.
- The materialized `matches_*` tables exist so the frontend and Genie don't re-score 3,500 pairs on every request. Refresh with `make views`.

## Vector Search status

At push time (2026-09-19): endpoint `connect-vs` is ONLINE; index `positions_index` reported `PROVISIONING_ENDPOINT (ready=False)`. The endpoint went ONLINE within seconds but the index stayed in `PROVISIONING_ENDPOINT` for 15+ minutes — this looks like a Free Edition provisioning lag rather than an error. Re-check before the demo; the semantic-search query is a backup, not a core beat.

Check with:

```
curl -s -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "$DATABRICKS_HOST/api/2.0/vector-search/indexes/workspace.jobsearch.positions_index" | jq .status
```

Once `ready: true`, semantic search works from SQL:

```sql
SELECT id, title, search_score
FROM vector_search(index => 'workspace.jobsearch.positions_index',
                   query_text => 'hands-on backend engineering with mentorship at a small team',
                   num_results => 5);
```

If the endpoint stays in `PROVISIONING_ENDPOINT` for more than ~20 minutes, delete and recreate it:
`DELETE /api/2.0/vector-search/endpoints/connect-vs`, then re-run the create calls in `scripts/create_vector_index.py`.
